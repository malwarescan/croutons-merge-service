// src/routes/admin.js
// Minimal admin endpoint for testing Phase 4

const { pool } = require('../db');

// POST /v1/admin/activate - Toggle markdown activation (protected)
async function activateMarkdown(req, res) {
  try {
    const { domain, path, is_active } = req.body;
    
    if (!domain || !path || typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'domain, path, and is_active required' });
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
    console.error('Admin activation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  activateMarkdown
};
