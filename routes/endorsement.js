// src/routes/endorsement.js
// Endorsement verification for activation gating

const { pool } = require('../db');
const { emitMarkdownActivated, emitMarkdownDeactivated } = require('./events.js');

// Parse <head> section and extract <link> tags
function parseHeadLinks(html) {
  const links = [];
  
  // Extract <head> content
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/is);
  if (!headMatch) {
    return links;
  }
  
  const headContent = headMatch[1];
  
  // Extract all <link> tags
  const linkRegex = /<link[^>]*>/gi;
  let linkMatch;
  
  while ((linkMatch = linkRegex.exec(headContent)) !== null) {
    const linkTag = linkMatch[0];
    const link = {};
    
    // Extract attributes
    const attrRegex = /(\w+)=["']([^"']+)["']/gi;
    let attrMatch;
    
    while ((attrMatch = attrRegex.exec(linkTag)) !== null) {
      link[attrMatch[1].toLowerCase()] = attrMatch[2];
    }
    
    links.push(link);
  }
  
  return links;
}

// Normalize URL for comparison
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    // Force HTTPS
    parsed.protocol = 'https:';
    // Remove trailing slash
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    return parsed.href;
  } catch {
    return url;
  }
}

// Check endorsement on source page
async function checkEndorsement(domain, path) {
  try {
    // Get source URL from markdown_versions
    const sourceResult = await pool.query(
      'SELECT source_url FROM markdown_versions WHERE domain = $1 AND path = $2 LIMIT 1',
      [domain, path]
    );
    
    if (sourceResult.rows.length === 0) {
      return { valid: false, error: 'Markdown version not found' };
    }
    
    const sourceUrl = sourceResult.rows[0].source_url;
    
    // Fetch source HTML
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Croutons-Endorsement-Checker/1.0'
      },
      timeout: 5000 // 5 second timeout
    });
    
    if (!response.ok) {
      return { valid: false, error: `Failed to fetch source: ${response.status}` };
    }
    
    const html = await response.text();
    
    // Parse <head> and extract <link> tags
    const links = parseHeadLinks(html);
    
    // Build expected endorsement URL
    const expectedHref = normalizeUrl(`https://md.croutons.ai/${domain}/${path}.md`);
    
    // Find matching endorsement
    const endorsement = links.find(link => 
      link.rel === 'alternate' && 
      link.type === 'text/markdown' &&
      normalizeUrl(link.href) === expectedHref
    );
    
    if (!endorsement) {
      return { 
        valid: false, 
        error: 'Endorsement missing or incorrect',
        expected: expectedHref,
        found: links.filter(l => l.rel === 'alternate' && l.type === 'text/markdown')
      };
    }
    
    return { 
      valid: true, 
      endorsement,
      sourceUrl,
      expectedHref
    };
    
  } catch (error) {
    console.error('Endorsement check error:', error);
    return { valid: false, error: 'Internal error during endorsement check' };
  }
}

// Emit activation event
async function emitActivation(domain, path, reason) {
  try {
    await emitMarkdownActivated(domain, path, reason);
  } catch (error) {
    console.error('Failed to emit activation event:', error);
  }
}

// Emit deactivation event
async function emitDeactivation(domain, path, reason) {
  try {
    await emitMarkdownDeactivated(domain, path, reason);
  } catch (error) {
    console.error('Failed to emit deactivation event:', error);
  }
}

// Enhanced activation with endorsement check
async function activateMarkdownWithEndorsement(req, res) {
  try {
    const { domain, path, is_active } = req.body;
    
    if (!domain || !path || typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'domain, path, and is_active required' });
    }
    
    // Only allow activation (is_active=true) with endorsement check
    if (is_active) {
      const endorsement = await checkEndorsement(domain, path);
      
      if (!endorsement.valid) {
        return res.status(400).json({ 
          error: 'Endorsement missing or incorrect',
          details: endorsement.error,
          expected: endorsement.expectedHref
        });
      }
    }
    
    // Update markdown version
    const result = await pool.query(`
      UPDATE markdown_versions 
      SET is_active = $1, updated_at = NOW()
      WHERE domain = $2 AND path = $3
      RETURNING id, is_active, updated_at
    `, [is_active, domain, path]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Markdown version not found' });
    }

    // Emit activation/deactivation events
    if (is_active) {
      await emitActivation(domain, 'endorsement_verified');
    } else {
      await emitDeactivation(domain, path, 'manual_deactivation');
    }

    res.json({
      ok: true,
      data: {
        domain,
        path,
        is_active: result.rows[0].is_active,
        updated_at: result.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('Enhanced activation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Scheduled endorsement verification
async function verifyEndorsements(req, res) {
  try {
    // Get all active markdown versions
    const activeVersions = await pool.query(`
      SELECT domain, path, source_url 
      FROM markdown_versions 
      WHERE is_active = true
    `);
    
    const results = [];
    
    for (const version of activeVersions.rows) {
      const endorsement = await checkEndorsement(version.domain, version.path);
      
      if (!endorsement.valid) {
        // Deactivate if endorsement missing
        await pool.query(`
          UPDATE markdown_versions 
          SET is_active = false, updated_at = NOW()
          WHERE domain = $1 AND path = $2
        `, [version.domain, version.path]);
        
        await emitDeactivation(version.domain, version.path, 'endorsement_missing');
        
        results.push({
          domain: version.domain,
          path: version.path,
          action: 'deactivated',
          reason: endorsement.error
        });
      } else {
        results.push({
          domain: version.domain,
          path: version.path,
          action: 'verified',
          status: 'active'
        });
      }
    }
    
    res.json({
      ok: true,
      data: results
    });

  } catch (error) {
    console.error('Endorsement verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  activateMarkdownWithEndorsement,
  verifyEndorsements
};
