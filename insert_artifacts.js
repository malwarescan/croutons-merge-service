#!/usr/bin/env node

// insert_artifacts.js
// Script to insert Canonical Truth Artifacts v1 for FloodBarrierPros.com

import { readFileSync } from 'fs';
import crypto from 'crypto';
import pg from 'pg';

// Simple database connection setup
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/croutons',
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

async function insertCanonicalArtifacts() {
  try {
    console.log('[insert] Starting insertion of Canonical Truth Artifacts v1...');
    console.log('[insert] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    
    // Read the SQL file
    const sqlContent = readFileSync('./insert_canonical_artifacts.sql', 'utf8');
    
    // Generate content hashes for each markdown artifact
    const markdownContents = {
      'engineered-systems-v1-hash': generateContentHash('engineered-systems'),
      'residential-mitigation-v1-hash': generateContentHash('residential-mitigation'),
      'installation-compliance-v1-hash': generateContentHash('installation-compliance'),
      'maintenance-lifecycle-v1-hash': generateContentHash('maintenance-lifecycle'),
      'regulatory-standards-v1-hash': generateContentHash('regulatory-standards')
    };
    
    // Replace placeholders with actual hashes
    let processedSQL = sqlContent;
    for (const [placeholder, hash] of Object.entries(markdownContents)) {
      processedSQL = processedSQL.replace(new RegExp(`\\$${placeholder}`, 'g'), hash);
    }
    
    // Execute the SQL
    await pool.query(processedSQL);
    
    console.log('[insert] Successfully inserted 5 Canonical Truth Artifacts v1');
    console.log('[insert] All artifacts stored as drafts (is_active = false)');
    
    // List what was inserted
    const result = await pool.query(`
      SELECT domain, path, content_hash, is_active, created_at 
      FROM markdown_versions 
      WHERE domain = 'floodbarrierpros.com' 
        AND path IN ('engineered-systems', 'residential-mitigation', 'installation-compliance', 'maintenance-lifecycle', 'regulatory-standards')
      ORDER BY created_at DESC
    `);
    
    console.log('[insert] Inserted artifacts:');
    result.rows.forEach(row => {
      console.log(`  - ${row.path}: ${row.content_hash} (active: ${row.is_active})`);
    });
    
  } catch (error) {
    console.error('[insert] Error inserting artifacts:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function generateContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Run the insertion
insertCanonicalArtifacts();
