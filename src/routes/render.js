// src/routes/render.js
// Deterministic Markdown renderer

const crypto = require('crypto');
const { pool } = require('../db');
const { emitMarkdownGenerated } = require('./events.js');

// Derive path from source URL (canonical, deterministic)
function derivePath(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    let path = url.pathname;
    
    // Remove leading/trailing slashes
    path = path.replace(/^\/+|\/+$/g, '');
    
    // Empty path becomes 'index'
    if (!path) {
      path = 'index';
    }
    
    return path;
  } catch (error) {
    console.error('Path derivation error:', error);
    return 'index';
  }
}

// Deterministic Markdown renderer
function renderMarkdown(extractedContent, sourceUrl, contentHash) {
  const { title, headings, body, lists, tables } = extractedContent;
  const domain = new URL(sourceUrl).hostname;
  const path = derivePath(sourceUrl);
  const generatedAt = new Date().toISOString();
  
  // Build frontmatter (strict schema)
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `source_url: "${sourceUrl}"`,
    `source_domain: "${domain}"`,
    `generated_by: "croutons.ai"`,
    `generated_at: "${generatedAt}"`,
    `content_hash: "${contentHash}"`,
    '---',
    ''
  ].join('\n');

  // Render content (deterministic)
  let markdownContent = '';
  
  // Add main heading if title exists
  if (title) {
    markdownContent += `# ${title}\n\n`;
  }
  
  // Add headings in order
  if (headings && headings.length > 0) {
    headings.forEach(heading => {
      const prefix = '#'.repeat(heading.level);
      markdownContent += `${prefix} ${heading.text}\n\n`;
    });
  }
  
  // Add body content
  if (body) {
    markdownContent += `${body}\n\n`;
  }
  
  // Add lists
  if (lists && lists.length > 0) {
    lists.forEach(item => {
      markdownContent += `- ${item}\n`;
    });
    markdownContent += '\n';
  }
  
  // Add tables (convert to markdown table format)
  if (tables && tables.length > 0) {
    tables.forEach(table => {
      markdownContent += `${table.html}\n\n`;
    });
  }

  return frontmatter + markdownContent;
}

// POST /v1/render - Internal Markdown rendering
async function renderMarkdownRoute(req, res) {
  try {
    const { domain, source_url, content_hash, extracted_content } = req.body;
    
    if (!domain || !source_url || !content_hash || !extracted_content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if already exists
    const existing = await pool.query(
      'SELECT id FROM markdown_versions WHERE domain = $1 AND source_url = $2 AND content_hash = $3',
      [domain, source_url, content_hash]
    );
    
    if (existing.rows.length > 0) {
      return res.json({
        ok: true,
        message: 'Markdown already exists',
        duplicate: true
      });
    }

    // Render Markdown
    const path = derivePath(source_url);
    const markdownContent = renderMarkdown(extracted_content, source_url, content_hash);

    // Store markdown version
    await pool.query(`
      INSERT INTO markdown_versions (domain, path, content, content_hash, is_active)
      VALUES ($1, $2, $3, $4, false)
      ON CONFLICT (domain, path, content_hash) 
      DO NOTHING
    `, [domain, path, markdownContent, content_hash]);

    // Emit markdown.generated event
    await emitMarkdownGenerated(domain, path, content_hash);

    res.json({
      ok: true,
      data: {
        domain,
        path,
        source_url,
        content_hash,
        rendered_markdown: markdownContent,
        is_active: false // Phase 3 - no activation yet
      }
    });

  } catch (error) {
    console.error('Render error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  renderMarkdown: renderMarkdownRoute
};
