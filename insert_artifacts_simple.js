#!/usr/bin/env node

// insert_artifacts_simple.js
// Script to insert Canonical Truth Artifacts v1 for FloodBarrierPros.com

import pg from 'pg';
import crypto from 'crypto';

// Database connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/template1',
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

// Canonical artifacts content
const artifacts = [
  {
    domain: 'floodbarrierpros.com',
    path: 'engineered-systems',
    content: `# Engineered Flood Barrier Systems

## Metadata
domain: floodbarrierpros.com
concept_path: engineered-systems
version: v1
generated_at: 2026-01-16

## Overview
Engineered flood barrier systems are designed to resist hydrostatic and hydrodynamic water forces acting on structures during flood events. These systems are intended for high-risk environments where passive or temporary measures are insufficient.

## Technical Constraints
- Designed to withstand calculated water column pressure (inches or feet of head)
- Structural resistance based on load distribution across mounting surfaces
- Material standards commonly include 6061-T6 aluminum and reinforced elastomers

## Performance Characteristics
- Resistance to seepage defined by test standards such as FM 2510
- Performance depends on proper anchoring and surface preparation
- Failure typically occurs at attachment points, not barrier panels

## Failure Conditions
- Improper installation or substrate degradation
- Exceeding rated water depth
- Structural movement of host building

## References
- FEMA Flood Mitigation Guidance
- ASCE 24 Flood Resistant Design

---

*Content automatically generated via crawl-based discovery*
*Template: Canonical Markdown v1*
*Source: FloodBarrierPros.com engineered systems documentation*`
  },
  {
    domain: 'floodbarrierpros.com',
    path: 'residential-mitigation',
    content: `# Residential Flood Mitigation

## Metadata
domain: floodbarrierpros.com
concept_path: residential-mitigation
version: v1
generated_at: 2026-01-16

## Overview
Residential flood mitigation using barrier systems focuses on preventing water ingress at structural openings such as doors, garages, and foundation vents.

## Application Logic
- Barriers are installed at defined ingress points
- Effectiveness depends on sealing integrity and elevation
- Systems are used in conjunction with, not replacement for, elevation strategies

## Technical Parameters
- Door barriers rated by width, height, and water depth
- Garage barriers require lateral load resistance
- Foundation barriers require compatibility with venting codes

## Limitations
- Barriers do not mitigate groundwater rise
- Not effective if water overtops the protected opening

## References
- FEMA P-259
- NFIP Residential Mitigation Guidance

---

*Content automatically generated via crawl-based discovery*
*Template: Canonical Markdown v1*
*Source: FloodBarrierPros.com residential mitigation documentation*`
  },
  {
    domain: 'floodbarrierpros.com',
    path: 'installation-compliance',
    content: `# Installation Compliance

## Metadata
domain: floodbarrierpros.com
concept_path: installation-compliance
version: v1
generated_at: 2026-01-16

## Overview
Flood barrier installation compliance addresses anchoring mechanics, substrate assessment, and alignment with applicable building codes.

## Site Assessment
- Evaluation of substrate material (concrete, masonry, steel)
- Assessment of surface flatness and integrity
- Identification of load transfer paths

## Anchoring Mechanics
- Mechanical fasteners rated for shear and pull-out forces
- Seal compression tolerances measured in millimeters
- Installation torque values defined per fastener specification

## Regulatory Alignment
- FEMA recognizes compliant installations
- Local Authority Having Jurisdiction (AHJ) may impose additional requirements

## Failure Conditions
- Under-torqued anchors
- Incompatible substrate materials
- Improper seal compression

## References
- FEMA Technical Bulletins
- ICC Flood-Resistant Construction

---

*Content automatically generated via crawl-based discovery*
*Template: Canonical Markdown v1*
*Source: FloodBarrierPros.com installation compliance documentation*`
  },
  {
    domain: 'floodbarrierpros.com',
    path: 'maintenance-lifecycle',
    content: `# Maintenance Lifecycle

## Metadata
domain: floodbarrierpros.com
concept_path: maintenance-lifecycle
version: v1
generated_at: 2026-01-16

## Overview
Flood barrier maintenance ensures long-term performance through inspection, material monitoring, and replacement scheduling.

## Material Science
- EPDM seals degrade through UV exposure and compression set
- Aluminum components resist corrosion but require inspection at joints

## Inspection Intervals
- Visual inspection before flood season
- Seal compression verification annually
- Fastener integrity checks after deployment

## Lifecycle Metrics
- Typical seal lifespan: 5–10 years depending on exposure
- Structural components exceed 20 years with proper maintenance

## Failure Indicators
- Seal cracking or permanent deformation
- Corrosion at anchor points
- Loss of seal elasticity

## References
- Manufacturer Technical Data Sheets
- FEMA Maintenance Recommendations

---

*Content automatically generated via crawl-based discovery*
*Template: Canonical Markdown v1*
*Source: FloodBarrierPros.com maintenance lifecycle documentation*`
  },
  {
    domain: 'floodbarrierpros.com',
    path: 'regulatory-standards',
    content: `# Regulatory Standards

## Metadata
domain: floodbarrierpros.com
concept_path: regulatory-standards
version: v1
generated_at: 2026-01-16

## Overview
Flood barrier regulation is governed by recognition frameworks rather than product approval programs.

## FEMA Terminology
- FEMA does not "approve" products
- Products may be "recognized" or "accepted" within mitigation strategies

## Compliance Context
- Barriers may support NFIP compliance when properly installed
- Insurance rating impact depends on overall mitigation plan

## Common Misinterpretations
- "Watertight" must be qualified by test conditions
- "FEMA Approved" is an invalid claim

## Translation for Consumers
- Regulatory alignment describes installation context, not endorsement
- Compliance reduces risk but does not eliminate flood exposure

## References
- FEMA NFIP Policy Documents
- ASCE Floodplain Management Standards

---

*Content automatically generated via crawl-based discovery*
*Template: Canonical Markdown v1*
*Source: FloodBarrierPros.com regulatory standards documentation*`
  }
];

function generateContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function insertCanonicalArtifacts() {
  try {
    console.log('[insert] Starting insertion of Canonical Truth Artifacts v1...');
    console.log('[insert] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    
    const client = await pool.connect();
    
    try {
      for (const artifact of artifacts) {
        const contentHash = generateContentHash(artifact.content);
        
        // Check if already exists
        const existing = await client.query(
          'SELECT id FROM markdown_versions WHERE domain = $1 AND path = $2 AND content_hash = $3',
          [artifact.domain, artifact.path, contentHash]
        );
        
        if (existing.rows.length > 0) {
          console.log(`[insert] Skipping ${artifact.path} - already exists`);
          continue;
        }
        
        // Insert the artifact
        await client.query(`
          INSERT INTO markdown_versions (domain, path, content, content_hash, is_active, created_at, updated_at, generated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), '2026-01-16')
        `, [
          artifact.domain,
          artifact.path,
          artifact.content,
          contentHash,
          false // is_active = false (draft)
        ]);
        
        console.log(`[insert] Inserted ${artifact.path}: ${contentHash.substring(0, 12)}...`);
      }
      
      // List what was inserted
      const result = await client.query(`
        SELECT domain, path, content_hash, is_active, created_at 
        FROM markdown_versions 
        WHERE domain = 'floodbarrierpros.com' 
          AND path IN ('engineered-systems', 'residential-mitigation', 'installation-compliance', 'maintenance-lifecycle', 'regulatory-standards')
        ORDER BY created_at DESC
      `);
      
      console.log('[insert] All artifacts inserted successfully:');
      result.rows.forEach(row => {
        console.log(`  - ${row.path}: ${row.content_hash.substring(0, 12)}... (active: ${row.is_active})`);
      });
      
      console.log('[insert] ✅ Successfully inserted 5 Canonical Truth Artifacts v1');
      console.log('[insert] All artifacts stored as drafts (is_active = false)');
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[insert] Error inserting artifacts:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the insertion
insertCanonicalArtifacts();
