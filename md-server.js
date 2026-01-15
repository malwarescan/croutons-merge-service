// md-server.js
// Lightweight Express service for md.croutons.ai hosting

import express from 'express';
import cors from 'cors';
import { pool } from './src/db.js';
import { emitSourceParticipation } from './src/routes/events.js';

const app = express();
const PORT = process.env.PORT || 8081;

// Basic middleware FIRST
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET'],
  allowedHeaders: ['Content-Type']
}));

// Rate limiting (simple in-memory)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const record = rateLimitStore.get(ip);
  
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
    return next();
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    });
  }

  record.count++;
  next();
}

// Request normalization
function normalizeRequest(req, res, next) {
  const segments = req.path.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return res.status(400).send('Bad request');
  }

  const domain = segments[0];
  const pathSegments = segments.slice(1);
  
  // Remove .md extension if present
  if (pathSegments.length > 0) {
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment.endsWith('.md')) {
      pathSegments[pathSegments.length - 1] = lastSegment.slice(0, -3);
    }
  }
  
  // Normalize path
  let path = pathSegments.join('/');
  if (!path) {
    path = 'index';
  }
  
  // Safety checks
  if (path.includes('..') || /[^\w\-\/\.]/.test(path)) {
    return res.status(400).send('Invalid path');
  }
  
  req.normalizedDomain = domain;
  req.normalizedPath = path;
  
  next();
}

// Logging
function logRequest(req, status) {
  console.log('[md-server]', {
    timestamp: new Date().toISOString(),
    domain: req.normalizedDomain,
    path: req.normalizedPath,
    status,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    requestId: Math.random().toString(36).substr(2, 9)
  });
}

// Health check (must come before wildcard)
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Main markdown serving endpoint
app.get('*', rateLimit, normalizeRequest, async (req, res) => {
  try {
    const { normalizedDomain: domain, normalizedPath: path } = req;
    
    // Rule A: Check if domain is verified
    const domainCheck = await pool.query(
      'SELECT verified_at FROM verified_domains WHERE domain = $1',
      [domain]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ error: 'domain_not_found', domain });
    }
    
    if (!domainCheck.rows[0].verified_at) {
      logRequest(req, 403);
      res.set('Cache-Control', 'no-store');
      return res.status(403).send('Forbidden');
    }
    
    // Rule B: Check if active markdown exists
    const markdownCheck = await pool.query(
      'SELECT content, content_hash, generated_at FROM markdown_versions WHERE domain = $1 AND path = $2 AND is_active = true',
      [domain, path]
    );
    
    if (markdownCheck.rows.length === 0) {
      logRequest(req, 404);
      res.set('Cache-Control', 'no-store');
      return res.status(404).send('Not found');
    }
    
    // Rule C: Return markdown
    const { content, content_hash, generated_at } = markdownCheck.rows[0];
    
    logRequest(req, 200);
    res.set({
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'ETag': `"${content_hash}"`,
      'Last-Modified': new Date(generated_at).toUTCString()
    });
    
    // Emit source participation event
    await emitSourceParticipation(
      domain, 
      'alternate_link', 
      req.get('User-Agent') || ''
    );
    
    // Size limit (2MB)
    if (content.length > 2 * 1024 * 1024) {
      return res.status(500).send('Content too large');
    }
    
    res.send(content);
    
  } catch (error) {
    console.error('[md-server] Error:', error);
    logRequest(req, 500);
    res.set('Cache-Control', 'no-store');
    res.status(500).send('Internal server error');
  }
});

// Cleanup rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW * 2);

// Debug: Log all registered routes on boot
console.log('=== REGISTERED ROUTES ===');
console.log(
  app._router.stack
    .map(r => r.route?.path || (r.regexp && r.regexp.source))
    .filter(Boolean)
);
console.log('========================');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`md-server listening on ${PORT}`);
});
