// src/routes/verify.js
// Domain verification endpoints for Croutons-as-a-Service

const crypto = require('crypto');
const dns = require('dns').promises;
const { pool } = require('../db');

// Generate verification token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /v1/verify/initiate
async function initiateVerification(req, res) {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Check if already verified
    const existing = await pool.query(
      'SELECT verified_at FROM verified_domains WHERE domain = $1',
      [domain]
    );
    
    if (existing.rows.length > 0 && existing.rows[0].verified_at) {
      return res.status(409).json({ 
        error: 'Domain already verified',
        domain,
        verified_at: existing.rows[0].verified_at
      });
    }

    const token = generateToken();
    
    // Upsert verification record
    await pool.query(`
      INSERT INTO verified_domains (domain, verification_token)
      VALUES ($1, $2)
      ON CONFLICT (domain) 
      DO UPDATE SET 
        verification_token = EXCLUDED.verification_token,
        updated_at = NOW()
    `, [domain, token]);

    const txtRecord = `croutons-verification=${token}`;

    res.json({
      domain,
      verification_token: token,
      txt_record: txtRecord,
      instructions: {
        step1: `Add this DNS TXT record to your domain:`,
        record: txtRecord,
        step2: `Wait 2-5 minutes for DNS propagation`,
        step3: `Call POST /v1/verify/check to confirm`
      }
    });

  } catch (error) {
    console.error('Verification initiation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /v1/verify/check
async function checkVerification(req, res) {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Get verification token from database
    const record = await pool.query(
      'SELECT verification_token, verified_at FROM verified_domains WHERE domain = $1',
      [domain]
    );
    
    if (record.rows.length === 0) {
      return res.status(404).json({ error: 'Verification not initiated' });
    }

    const { verification_token, verified_at } = record.rows[0];
    
    // Already verified
    if (verified_at) {
      return res.json({
        domain,
        status: 'already_verified',
        verified_at
      });
    }

    // Check DNS TXT record
    try {
      const txtRecords = await dns.resolveTxt(domain);
      const expectedRecord = `croutons-verification=${verification_token}`;
      
      const found = txtRecords.some(record => record === expectedRecord);
      
      if (!found) {
        return res.status(400).json({
          domain,
          status: 'failed',
          error: 'TXT record not found or incorrect',
          expected: expectedRecord,
          found: txtRecords
        });
      }

      // Mark as verified
      await pool.query(
        'UPDATE verified_domains SET verified_at = NOW(), updated_at = NOW() WHERE domain = $1',
        [domain]
      );

      res.json({
        domain,
        status: 'verified',
        verified_at: new Date().toISOString()
      });

    } catch (dnsError) {
      return res.status(400).json({
        domain,
        status: 'dns_error',
        error: 'DNS lookup failed',
        details: dnsError.message
      });
    }

  } catch (error) {
    console.error('Verification check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Middleware to check if domain is verified
async function requireVerifiedDomain(req, res, next) {
  const domain = req.body.domain || req.query.domain;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  const record = await pool.query(
    'SELECT verified_at FROM verified_domains WHERE domain = $1',
    [domain]
  );
  
  if (record.rows.length === 0 || !record.rows[0].verified_at) {
    return res.status(403).json({ 
      error: 'Domain not verified',
      domain,
      message: 'Domain must be verified before using this service'
    });
  }

  req.verifiedDomain = domain;
  next();
}

module.exports = {
  initiateVerification,
  checkVerification,
  requireVerifiedDomain
};
