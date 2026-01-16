// src/routes/automate.js
// Full automation: domain → concepts → artifacts → activation → serving

import { pool } from '../db.js';
import crypto from 'crypto';

// Truth Scope v1 - High-friction authority concepts for flood barriers
const TRUTH_SCOPE_KEYWORDS = [
  'flood barrier', 'flood protection', 'water damage prevention',
  'hydrostatic pressure', 'flood mitigation', 'structural integrity',
  'flood resistant design', 'water intrusion', 'flood defense systems',
  'flood control', 'water barrier', 'flood prevention', 'flood safety'
];

// Regulatory alignment keywords
const REGULATORY_KEYWORDS = [
  'FEMA', 'NFIP', 'ASCE', 'building codes', 'compliance',
  'floodplain management', 'mitigation strategies', 'regulatory standards',
  'authority having jurisdiction', 'flood resistant construction'
];

// High-friction authority concepts for flood barriers
const AUTHORITY_CONCEPTS = [
  {
    concept: 'engineered-systems',
    keywords: ['engineered', 'structural', 'hydrostatic', 'pressure', 'load distribution'],
    focus: 'Technical engineering and structural performance'
  },
  {
    concept: 'residential-mitigation', 
    keywords: ['residential', 'home', 'property', 'mitigation', 'protection'],
    focus: 'Residential applications and property protection'
  },
  {
    concept: 'installation-compliance',
    keywords: ['installation', 'compliance', 'codes', 'standards', 'anchoring'],
    focus: 'Installation requirements and regulatory compliance'
  },
  {
    concept: 'maintenance-lifecycle',
    keywords: ['maintenance', 'lifecycle', 'inspection', 'durability', 'longevity'],
    focus: 'Long-term maintenance and lifecycle management'
  },
  {
    concept: 'regulatory-standards',
    keywords: ['regulatory', 'standards', 'FEMA', 'compliance', 'certification'],
    focus: 'Regulatory frameworks and compliance standards'
  }
];

// Generate canonical markdown artifact
function generateCanonicalArtifact(domain, concept, crawledContent = []) {
  const authorityConcept = AUTHORITY_CONCEPTS.find(ac => ac.concept === concept);
  
  const artifact = {
    domain,
    path: concept,
    content: `# ${concept.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}

## Metadata
domain: ${domain}
concept_path: ${concept}
version: v1
generated_at: ${new Date().toISOString().split('T')[0]}
auto_generated: true

## Overview
${generateOverview(concept, authorityConcept)}

## Technical Specifications
${generateTechnicalSpecs(concept, authorityConcept)}

## Compliance Requirements
${generateComplianceRequirements(concept, authorityConcept)}

## Performance Metrics
${generatePerformanceMetrics(concept, authorityConcept)}

## References
${generateReferences(concept, authorityConcept)}

---

*Content automatically generated via Croutons AI*
*Template: Canonical Markdown v1*
*Source: ${domain} ${concept} documentation*
*Regulatory Alignment: FEMA/ASCE compliant*`
  };
  
  return artifact;
}

function generateOverview(concept, authorityConcept) {
  const overviews = {
    'engineered-systems': 'Engineered flood barrier systems are designed to resist hydrostatic and hydrodynamic water forces acting on structures during flood events. These systems are intended for high-risk environments where passive or temporary measures are insufficient.',
    'residential-mitigation': 'Residential flood mitigation using barrier systems focuses on preventing water ingress at structural openings such as doors, garages, and foundation vents. Protection strategies must balance effectiveness with practical implementation.',
    'installation-compliance': 'Flood barrier installation compliance addresses anchoring mechanics, substrate assessment, and alignment with applicable building codes. Proper installation is critical for system performance and regulatory compliance.',
    'maintenance-lifecycle': 'Flood barrier maintenance ensures long-term performance through inspection, material monitoring, and replacement scheduling. System longevity depends on proactive maintenance and timely component replacement.',
    'regulatory-standards': 'Flood barrier regulation is governed by recognition frameworks rather than product approval programs. Understanding regulatory context is essential for proper system specification and compliance.'
  };
  
  return overviews[concept] || `Comprehensive ${concept} framework for flood protection systems and regulatory compliance.`;
}

function generateTechnicalSpecs(concept, authorityConcept) {
  const specs = {
    'engineered-systems': `- Designed to withstand calculated water column pressure (inches or feet of head)
- Structural resistance based on load distribution across mounting surfaces
- Material standards commonly include 6061-T6 aluminum and reinforced elastomers
- Performance tested under FM 2510 and ASTM standards`,
    'residential-mitigation': `- Door barriers rated by width, height, and water depth capacity
- Garage barriers require lateral load resistance and proper sealing
- Foundation barriers must comply with ventilation and access codes
- Systems designed for repeated deployment and removal`,
    'installation-compliance': `- Mechanical fasteners rated for shear and pull-out forces
- Seal compression tolerances measured in millimeters
- Installation torque values defined per fastener specification
- Substrate assessment required for proper anchoring`,
    'maintenance-lifecycle': `- EPDM seals degrade through UV exposure and compression set
- Aluminum components resist corrosion but require joint inspection
- Typical seal lifespan: 5–10 years depending on exposure
- Structural components exceed 20 years with proper maintenance`,
    'regulatory-standards': `- FEMA recognizes compliant installations within mitigation strategies
- Products may be "recognized" or "accepted" but not "approved"
- Local AHJ may impose additional requirements beyond federal standards
- Compliance supports NFIP rating but does not guarantee coverage`
  };
  
  return specs[concept] || `- Technical specifications aligned with ${authorityConcept.focus}\n- Performance standards based on industry best practices\n- Compliance with relevant regulatory frameworks`;
}

function generateComplianceRequirements(concept, authorityConcept) {
  return `- FEMA Technical Bulletin requirements applicable
- ASCE 24 Flood Resistant Design standards
- Local building code compliance mandatory
- Professional engineering review recommended for critical applications`;
}

function generatePerformanceMetrics(concept, authorityConcept) {
  return `- Performance validated under standardized test conditions
- Resistance to seepage defined by FM 2510 standards
- Load capacity verified through structural analysis
- System effectiveness depends on proper installation and maintenance`;
}

function generateReferences(concept, authorityConcept) {
  return `- FEMA Flood Mitigation Guidance
- ASCE 24 Flood Resistant Design
- NFIP Residential Mitigation Guidance
- Manufacturer Technical Data Sheets`;
}

function generateContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Main automation endpoint
export async function automateDomain(req, res) {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({
        error: 'domain_required',
        message: 'Domain parameter is required'
      });
    }
    
    console.log(`[automate] Starting full automation for domain: ${domain}`);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Step 1: Generate 5 canonical artifacts
      const artifacts = AUTHORITY_CONCEPTS.map(ac => 
        generateCanonicalArtifact(domain, ac.concept)
      );
      
      console.log(`[automate] Generated ${artifacts.length} canonical artifacts`);
      
      // Step 2: Insert artifacts as drafts
      const insertedArtifacts = [];
      
      for (const artifact of artifacts) {
        const contentHash = generateContentHash(artifact.content);
        
        // Check if already exists
        const existing = await client.query(
          'SELECT id FROM markdown_versions WHERE domain = $1 AND path = $2 AND content_hash = $3',
          [artifact.domain, artifact.path, contentHash]
        );
        
        if (existing.rows.length > 0) {
          console.log(`[automate] Skipping ${artifact.path} - already exists`);
          continue;
        }
        
        // Insert as draft
        const result = await client.query(`
          INSERT INTO markdown_versions (domain, path, content, content_hash, is_active, created_at, updated_at, generated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
          RETURNING id, content_hash, created_at
        `, [
          artifact.domain,
          artifact.path,
          artifact.content,
          contentHash,
          false // Start as draft
        ]);
        
        insertedArtifacts.push({
          ...artifact,
          id: result.rows[0].id,
          content_hash: contentHash,
          created_at: result.rows[0].created_at
        });
        
        console.log(`[automate] Inserted ${artifact.path}: ${contentHash.substring(0, 12)}...`);
      }
      
      // Step 3: Auto-activate all inserted artifacts
      const activatedArtifacts = [];
      
      for (const artifact of insertedArtifacts) {
        // Deactivate other versions for this path
        await client.query(`
          UPDATE markdown_versions 
          SET is_active = false, updated_at = NOW()
          WHERE domain = $1 AND path = $2
        `, [artifact.domain, artifact.path]);
        
        // Activate this version
        const activationResult = await client.query(`
          UPDATE markdown_versions 
          SET is_active = true, updated_at = NOW()
          WHERE id = $1
          RETURNING id, is_active, updated_at
        `, [artifact.id]);
        
        activatedArtifacts.push({
          ...artifact,
          is_active: activationResult.rows[0].is_active,
          updated_at: activationResult.rows[0].updated_at
        });
        
        console.log(`[automate] Activated ${artifact.path}`);
      }
      
      await client.query('COMMIT');
      
      console.log(`[automate] Successfully automated domain: ${domain}`);
      
      res.json({
        success: true,
        domain,
        automated_at: new Date().toISOString(),
        summary: {
          concepts_inferred: AUTHORITY_CONCEPTS.length,
          artifacts_generated: artifacts.length,
          artifacts_inserted: insertedArtifacts.length,
          artifacts_activated: activatedArtifacts.length
        },
        artifacts: activatedArtifacts.map(a => ({
          path: a.path,
          content_hash: a.content_hash,
          is_active: a.is_active,
          url: `https://md.croutons.ai/${a.domain}/${a.path}`
        }))
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[automate] Automation error:', error);
    res.status(500).json({
      error: 'automation_failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Quick status endpoint
export async function getAutomationStatus(req, res) {
  try {
    const { domain } = req.query;
    
    if (!domain) {
      return res.status(400).json({
        error: 'domain_required',
        message: 'Domain query parameter is required'
      });
    }
    
    const result = await pool.query(`
      SELECT path, content_hash, is_active, created_at, updated_at
      FROM markdown_versions 
      WHERE domain = $1 
        AND path IN ('engineered-systems', 'residential-mitigation', 'installation-compliance', 'maintenance-lifecycle', 'regulatory-standards')
      ORDER BY path
    `, [domain]);
    
    res.json({
      domain,
      total_artifacts: result.rows.length,
      active_artifacts: result.rows.filter(r => r.is_active).length,
      artifacts: result.rows.map(r => ({
        path: r.path,
        content_hash: r.content_hash,
        is_active: r.is_active,
        created_at: r.created_at,
        updated_at: r.updated_at,
        url: `https://md.croutons.ai/${domain}/${r.path}`
      }))
    });
    
  } catch (error) {
    console.error('[automate] Status error:', error);
    res.status(500).json({
      error: 'status_failed',
      message: error.message
    });
  }
}
