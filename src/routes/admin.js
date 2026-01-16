// src/routes/admin.js
// Admin endpoints for markdown management

import { pool } from '../db.js';

// POST /v1/admin/activate - Activate markdown version (protected)
async function activateMarkdown(req, res) {
  try {
    const { domain, path, content_hash } = req.body;
    
    if (!domain || !path || !content_hash) {
      return res.status(400).json({ 
        error: 'domain, path, and content_hash required',
        message: 'All three parameters are required to activate a specific markdown version'
      });
    }

    // Check if the specific version exists
    const versionCheck = await pool.query(`
      SELECT id, content_hash, is_active 
      FROM markdown_versions 
      WHERE domain = $1 AND path = $2 AND content_hash = $3
    `, [domain, path, content_hash]);

    if (versionCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'markdown_version_not_found',
        message: 'No markdown version found with the specified domain, path, and content_hash'
      });
    }

    const targetVersion = versionCheck.rows[0];

    // If this version is already active, no action needed
    if (targetVersion.is_active) {
      return res.json({
        ok: true,
        message: 'Version is already active',
        data: {
          domain,
          path,
          content_hash,
          is_active: true
        }
      });
    }

    // Start transaction for atomic activation
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Step 1: Deactivate all other versions for this (domain, path)
      await client.query(`
        UPDATE markdown_versions 
        SET is_active = false, updated_at = NOW()
        WHERE domain = $1 AND path = $2
      `, [domain, path]);

      // Step 2: Activate the target version
      const activationResult = await client.query(`
        UPDATE markdown_versions 
        SET is_active = true, updated_at = NOW()
        WHERE domain = $1 AND path = $2 AND content_hash = $3
        RETURNING id, is_active, updated_at
      `, [domain, path, content_hash]);

      await client.query('COMMIT');

      res.json({
        ok: true,
        message: 'Markdown version activated successfully',
        data: {
          domain,
          path,
          content_hash,
          id: activationResult.rows[0].id,
          is_active: activationResult.rows[0].is_active,
          updated_at: activationResult.rows[0].updated_at
        }
      });

    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[admin] Activation error:', error);
    res.status(500).json({ 
      error: 'activation_failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// POST /v1/admin/deactivate - Deactivate markdown version (protected)
async function deactivateMarkdown(req, res) {
  try {
    const { domain, path, content_hash } = req.body;
    
    if (!domain || !path || !content_hash) {
      return res.status(400).json({ 
        error: 'domain, path, and content_hash required',
        message: 'All three parameters are required to deactivate a specific markdown version'
      });
    }

    // Check if the specific version exists and is active
    const versionCheck = await pool.query(`
      SELECT id, content_hash, is_active 
      FROM markdown_versions 
      WHERE domain = $1 AND path = $2 AND content_hash = $3
    `, [domain, path, content_hash]);

    if (versionCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'markdown_version_not_found',
        message: 'No markdown version found with the specified domain, path, and content_hash'
      });
    }

    const targetVersion = versionCheck.rows[0];

    // If this version is already inactive, no action needed
    if (!targetVersion.is_active) {
      return res.json({
        ok: true,
        message: 'Version is already inactive',
        data: {
          domain,
          path,
          content_hash,
          is_active: false
        }
      });
    }

    // Deactivate the target version
    const deactivationResult = await pool.query(`
      UPDATE markdown_versions 
      SET is_active = false, updated_at = NOW()
      WHERE domain = $1 AND path = $2 AND content_hash = $3
      RETURNING id, is_active, updated_at
    `, [domain, path, content_hash]);

    res.json({
      ok: true,
      message: 'Markdown version deactivated successfully',
      data: {
        domain,
        path,
        content_hash,
        id: deactivationResult.rows[0].id,
        is_active: deactivationResult.rows[0].is_active,
        updated_at: deactivationResult.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('[admin] Deactivation error:', error);
    res.status(500).json({ 
      error: 'deactivation_failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// GET /v1/admin/versions - List all versions for a domain/path (protected)
async function listMarkdownVersions(req, res) {
  try {
    const { domain, path } = req.query;
    
    if (!domain || !path) {
      return res.status(400).json({ 
        error: 'domain and path query parameters required',
        message: 'Both domain and path must be provided as query parameters'
      });
    }

    const versions = await pool.query(`
      SELECT id, content_hash, is_active, created_at, updated_at, generated_at
      FROM markdown_versions 
      WHERE domain = $1 AND path = $2
      ORDER BY created_at DESC
    `, [domain, path]);

    res.json({
      ok: true,
      data: {
        domain,
        path,
        versions: versions.rows,
        total: versions.rows.length,
        active_count: versions.rows.filter(v => v.is_active).length
      }
    });

  } catch (error) {
    console.error('[admin] List versions error:', error);
    res.status(500).json({ 
      error: 'list_failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// POST /v1/admin/activate-by-id - Activate by version ID (protected)
async function activateMarkdownById(req, res) {
  try {
    const { version_id } = req.body;
    
    if (!version_id) {
      return res.status(400).json({ 
        error: 'version_id required',
        message: 'Version ID is required to activate a specific markdown version'
      });
    }

    // Check if the version exists
    const versionCheck = await pool.query(`
      SELECT id, domain, path, content_hash, is_active 
      FROM markdown_versions 
      WHERE id = $1
    `, [version_id]);

    if (versionCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'markdown_version_not_found',
        message: 'No markdown version found with the specified ID'
      });
    }

    const targetVersion = versionCheck.rows[0];

    // If this version is already active, no action needed
    if (targetVersion.is_active) {
      return res.json({
        ok: true,
        message: 'Version is already active',
        data: {
          version_id,
          domain: targetVersion.domain,
          path: targetVersion.path,
          content_hash: targetVersion.content_hash,
          is_active: true
        }
      });
    }

    // Start transaction for atomic activation
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Step 1: Deactivate all other versions for this (domain, path)
      await client.query(`
        UPDATE markdown_versions 
        SET is_active = false, updated_at = NOW()
        WHERE domain = $1 AND path = $2
      `, [targetVersion.domain, targetVersion.path]);

      // Step 2: Activate the target version
      const activationResult = await client.query(`
        UPDATE markdown_versions 
        SET is_active = true, updated_at = NOW()
        WHERE id = $1
        RETURNING id, is_active, updated_at
      `, [version_id]);

      await client.query('COMMIT');

      res.json({
        ok: true,
        message: 'Markdown version activated successfully by ID',
        data: {
          version_id,
          domain: targetVersion.domain,
          path: targetVersion.path,
          content_hash: targetVersion.content_hash,
          id: activationResult.rows[0].id,
          is_active: activationResult.rows[0].is_active,
          updated_at: activationResult.rows[0].updated_at
        }
      });

    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[admin] Activation by ID error:', error);
    res.status(500).json({ 
      error: 'activation_failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export {
  activateMarkdown,
  deactivateMarkdown,
  listMarkdownVersions,
  activateMarkdownById
};
