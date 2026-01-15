// src/routes/ingest.js
// Single-URL ingestion with HTML snapshot and content extraction

const crypto = require('crypto');
const { pool } = require('../db');

// Extract content using Readability-style algorithm
function extractContent(html) {
  // Simple content extraction (can be enhanced with @mozilla/readability later)
  const content = {
    title: '',
    headings: [],
    body: '',
    lists: [],
    tables: []
  };

  try {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      content.title = titleMatch[1].trim();
    }

    // Extract headings (h1-h4)
    const headingRegex = /<h([1-4])[^>]*>([^<]+)<\/h\1>/gi;
    let headingMatch;
    while ((headingMatch = headingRegex.exec(html)) !== null) {
      content.headings.push({
        level: parseInt(headingMatch[1]),
        text: headingMatch[2].replace(/<[^>]*>/g, '').trim()
      });
    }

    // Extract main content area (simplified)
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/is) || 
                     html.match(/<article[^>]*>([\s\S]*?)<\/article>/is) ||
                     html.match(/<body[^>]*>([\s\S]*?)<\/body>/is);
    
    if (mainMatch) {
      let bodyContent = mainMatch[1];
      
      // Clean up content
      bodyContent = bodyContent
        .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove scripts
        .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove styles
        .replace(/<nav[^>]*>.*?<\/nav>/gis, '') // Remove navigation
        .replace(/<footer[^>]*>.*?<\/footer>/gis, '') // Remove footer
        .replace(/<aside[^>]*>.*?<\/aside>/gis, '') // Remove sidebars
        .replace(/<[^>]*>/g, '') // Remove all HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      content.body = bodyContent;

      // Extract lists (simple pattern)
      const listMatches = bodyContent.match(/(?:^|\n)[\*\-\+]\s+.+/gm);
      if (listMatches) {
        content.lists = listMatches.map(item => item.replace(/^[\*\-\+]\s+/, '').trim());
      }

      // Extract tables (simple pattern)
      const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gis;
      let tableMatch;
      while ((tableMatch = tableRegex.exec(html)) !== null) {
        content.tables.push({
          html: tableMatch[0] // Keep raw HTML for tables
        });
      }
    }

  } catch (error) {
    console.error('Content extraction error:', error);
  }

  return content;
}

// Compute content hash for change detection
function computeContentHash(content) {
  const contentString = JSON.stringify(content);
  return crypto.createHash('sha256').update(contentString).digest('hex');
}

// POST /v1/ingest - Single URL ingestion
async function ingestUrl(req, res) {
  try {
    const { domain, url } = req.body;
    
    if (!domain || !url) {
      return res.status(400).json({ error: 'domain and url are required' });
    }

    // Validate URL format
    let canonicalUrl;
    try {
      canonicalUrl = new URL(url).href;
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check robots.txt (simplified)
    const robotsUrl = new URL('/robots.txt', new URL(url).origin).href;
    // TODO: Actually fetch and parse robots.txt in v2

    // Fetch HTML snapshot
    const response = await fetch(canonicalUrl, {
      headers: {
        'User-Agent': 'Croutons-Ingestor/1.0'
      }
    });

    if (!response.ok) {
      return res.status(400).json({ 
        error: 'Failed to fetch URL',
        status: response.status,
        url: canonicalUrl
      });
    }

    const html = await response.text();

    // Store raw HTML snapshot
    await pool.query(`
      INSERT INTO html_snapshots (domain, source_url, html)
      VALUES ($1, $2, $3)
      ON CONFLICT (domain, source_url) 
      DO UPDATE SET 
        html = EXCLUDED.html,
        fetched_at = NOW()
    `, [domain, canonicalUrl, html]);

    // Extract content
    const extractedContent = extractContent(html);
    const contentHash = computeContentHash(extractedContent);

    res.json({
      ok: true,
      data: {
        domain,
        source_url: canonicalUrl,
        content_hash: contentHash,
        extracted: extractedContent,
        fetched_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  ingestUrl
};
