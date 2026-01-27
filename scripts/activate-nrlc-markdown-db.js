#!/usr/bin/env node
/**
 * Direct database script to activate markdown for nrlc.ai/index
 * This runs SQL directly against the md.croutons.ai database
 */

import { pool } from '../src/db.js';

async function activateMarkdown() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('1) Inspecting existing markdown versions...');
    const inspectResult = await client.query(`
      SELECT id, domain, path, is_active, created_at
      FROM markdown_versions
      WHERE domain = 'nrlc.ai' AND path = 'index'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    console.log(`Found ${inspectResult.rows.length} version(s):`);
    inspectResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ID: ${row.id}, Active: ${row.is_active}, Created: ${row.created_at}`);
    });

    if (inspectResult.rows.length === 0) {
      console.log('❌ No markdown versions found for nrlc.ai/index');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    console.log('\n2) Deactivating any currently active versions...');
    const deactivateResult = await client.query(`
      UPDATE markdown_versions
      SET is_active = FALSE
      WHERE domain = 'nrlc.ai'
        AND path = 'index'
        AND is_active = TRUE
      RETURNING id
    `);
    console.log(`   Deactivated ${deactivateResult.rows.length} version(s)`);

    console.log('\n3) Activating the newest version...');
    const activateResult = await client.query(`
      UPDATE markdown_versions
      SET is_active = TRUE
      WHERE id = (
        SELECT id
        FROM markdown_versions
        WHERE domain = 'nrlc.ai'
          AND path = 'index'
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id, domain, path, is_active, created_at
    `);

    if (activateResult.rows.length === 0) {
      console.log('❌ Failed to activate - no rows updated');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    const activated = activateResult.rows[0];
    console.log(`   ✅ Activated version ID: ${activated.id}`);
    console.log(`   Created: ${activated.created_at}`);

    await client.query('COMMIT');
    console.log('\n✅ Transaction committed successfully!');

    console.log('\n4) Verifying activation...');
    const verifyResult = await client.query(`
      SELECT id, domain, path, is_active, created_at
      FROM markdown_versions
      WHERE domain = 'nrlc.ai' AND path = 'index'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    const activeCount = verifyResult.rows.filter(r => r.is_active).length;
    console.log(`   Active versions: ${activeCount}`);
    
    if (activeCount === 1) {
      console.log('✅ Exactly one active version confirmed!');
      console.log(`\n📄 Markdown should now be accessible at:`);
      console.log(`   https://md.croutons.ai/nrlc.ai/index.md`);
    } else {
      console.warn(`⚠️  Warning: Expected 1 active version, found ${activeCount}`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
activateMarkdown().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
