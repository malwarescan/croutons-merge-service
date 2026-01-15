// src/routes/rebuild.js
// Rebuild policy: hash change + schedule

const crypto = require('crypto');
const { pool } = require('../db');
const { checkEndorsement } = require('./endorsement.js');

// Extract content from HTML (reuse from ingest.js)
function extractContent(html) {
  const content = {
    title: '',
    headings: [],
    body: '',
    lists: [],
    tables: []
  };

  try {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      content.title = titleMatch[1].trim();
    }

    const headingRegex = /<h([1-4])[^>]*>([^<]+)<\/h\1>/gi;
    let headingMatch;
    while ((headingMatch = headingRegex.exec(html)) !== null) {
      content.headings.push({
        level: parseInt(headingMatch[1]),
        text: headingMatch[2].replace(/<[^>]*>/g, '').trim()
      });
    }

    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/is) || 
                     html.match(/<article[^>]*>([\s\S]*?)<\/article>/is) ||
                     html.match(/<body[^>]*>([\s\S]*?)<\/body>/is);
    
    if (mainMatch) {
      let bodyContent = mainMatch[1];
      
      bodyContent = bodyContent
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<nav[^>]*>.*?<\/nav>/gis, '')
        .replace(/<footer[^>]*>.*?<\/footer>/gis, '')
        .replace(/<aside[^>]*>.*?<\/aside>/gis, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      content.body = bodyContent;

      const listMatches = bodyContent.match(/(?:^|\n)[\*\-\+]\s+.+/gm);
      if (listMatches) {
        content.lists = listMatches.map(item => item.replace(/^[\*\-\+]\s+/, '').trim());
      }

      const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gis;
      let tableMatch;
      while ((tableMatch = tableRegex.exec(html)) !== null) {
        content.tables.push({
          html: tableMatch[0]
        });
      }
    }

  } catch (error) {
    console.error('Content extraction error:', error);
  }

  return content;
}

// Compute content hash
function computeContentHash(content) {
  const contentString = JSON.stringify(content);
  return crypto.createHash('sha256').update(contentString).digest('hex');
}

// Derive path from URL
function derivePath(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    let path = url.pathname;
    path = path.replace(/^\/+|\/+$/g, '');
    if (!path) {
      path = 'index';
    }
    return path;
  } catch (error) {
    console.error('Path derivation error:', error);
    return 'index';
  }
}

// Hash-based rebuild on ingestion
async function rebuildOnIngestion(req, res) {
  try {
    const { domain, source_url, content_hash, extracted_content } = req.body;
    
    if (!domain || !source_url || !content_hash || !extracted_content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const path = derivePath(source_url);
    
    // Check latest hash for this domain/path
    const latestResult = await pool.query(
      'SELECT content_hash FROM markdown_versions WHERE domain = $1 AND path = $2 ORDER BY generated_at DESC LIMIT 1',
      [domain, path]
    );
    
    const latestHash = latestResult.rows.length > 0 ? latestResult.rows[0].content_hash : null;
    
    // If same hash, no-op
    if (latestHash === content_hash) {
      return res.json({
        ok: true,
        action: 'noop',
        reason: 'Content unchanged',
        content_hash
      });
    }
    
    // Different hash - create new version
    const newContent = await pool.query(`
      INSERT INTO markdown_versions (domain, path, content, content_hash, is_active)
      VALUES ($1, $2, $3, $4, false)
      RETURNING id, generated_at
    `, [domain, path, null, content_hash]); // Content will be filled by render step
    
    res.json({
      ok: true,
      action: 'new_version_created',
      old_hash: latestHash,
      new_hash: content_hash,
      version_id: newContent.rows[0].id
    });

  } catch (error) {
    console.error('Rebuild on ingestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Scheduled rebuild for all active markdown
async function scheduledRebuild(req, res) {
  try {
    const results = [];
    
    // Get all active markdown versions
    const activeVersions = await pool.query(`
      SELECT domain, path, source_url, content_hash
      FROM markdown_versions 
      WHERE is_active = true
    `);
    
    for (const version of activeVersions.rows) {
      try {
        // Fetch source HTML
        const response = await fetch(version.source_url, {
          headers: {
            'User-Agent': 'Croutons-Rebuilder/1.0'
          },
          timeout: 5000
        });
        
        if (!response.ok) {
          results.push({
            domain: version.domain,
            path: version.path,
            action: 'fetch_failed',
            reason: `HTTP ${response.status}`
          });
          continue;
        }
        
        const html = await response.text();
        const extractedContent = extractContent(html);
        const newHash = computeContentHash(extractedContent);
        
        // Check if hash changed
        if (newHash === version.content_hash) {
          results.push({
            domain: version.domain,
            path: version.path,
            action: 'noop',
            reason: 'Content unchanged'
          });
          continue;
        }
        
        // Hash changed - create new version
        const newVersion = await pool.query(`
          INSERT INTO markdown_versions (domain, path, content, content_hash, is_active)
          VALUES ($1, $2, $3, $4, false)
          RETURNING id, generated_at
        `, [version.domain, version.path, null, newHash]);
        
        // Check endorsement for new version
        const endorsement = await checkEndorsement(version.domain, version.path);
        
        if (endorsement.valid) {
          // Activate new version, deactivate old
          await pool.query(`
            UPDATE markdown_versions 
            SET is_active = CASE 
              WHEN id = $1 THEN true 
              ELSE false 
            END
            WHERE domain = $2 AND path = $3
          `, [newVersion.rows[0].id, version.domain, version.path]);
          
          results.push({
            domain: version.domain,
            path: version.path,
            action: 'rebuilt_activated',
            old_hash: version.content_hash,
            new_hash: newHash,
            version_id: newVersion.rows[0].id
          });
        } else {
          results.push({
            domain: version.domain,
            path: version.path,
            action: 'rebuilt_deactivated',
            reason: 'Endorsement missing',
            old_hash: version.content_hash,
            new_hash: newHash
          });
        }
        
      } catch (error) {
        results.push({
          domain: version.domain,
          path: version.path,
          action: 'error',
          reason: error.message
        });
      }
    }
    
    res.json({
      ok: true,
      data: results,
      total_processed: activeVersions.rows.length
    });

  } catch (error) {
    console.error('Scheduled rebuild error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  rebuildOnIngestion,
  scheduledRebuild
};
