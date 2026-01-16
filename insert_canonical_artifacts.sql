-- Insert Canonical Truth Artifacts v1 for FloodBarrierPros.com
-- These are draft versions (is_active = false) for manual activation

-- 1. Engineered Systems
INSERT INTO markdown_versions (domain, path, content, content_hash, is_active, created_at, updated_at, generated_at) VALUES
(
  'floodbarrierpros.com',
  'engineered-systems',
  $markdown_content_1$,
  'engineered-systems-v1-hash',
  false,
  NOW(),
  NOW(),
  '2026-01-16'
) ON CONFLICT (domain, path, content_hash) DO NOTHING;

-- 2. Residential Mitigation
INSERT INTO markdown_versions (domain, path, content, content_hash, is_active, created_at, updated_at, generated_at) VALUES
(
  'floodbarrierpros.com',
  'residential-mitigation',
  $markdown_content_2$,
  'residential-mitigation-v1-hash',
  false,
  NOW(),
  NOW(),
  '2026-01-16'
) ON CONFLICT (domain, path, content_hash) DO NOTHING;

-- 3. Installation Compliance
INSERT INTO markdown_versions (domain, path, content, content_hash, is_active, created_at, updated_at, generated_at) VALUES
(
  'floodbarrierpros.com',
  'installation-compliance',
  $markdown_content_3$,
  'installation-compliance-v1-hash',
  false,
  NOW(),
  NOW(),
  '2026-01-16'
) ON CONFLICT (domain, path, content_hash) DO NOTHING;

-- 4. Maintenance Lifecycle
INSERT INTO markdown_versions (domain, path, content, content_hash, is_active, created_at, updated_at, generated_at) VALUES
(
  'floodbarrierpros.com',
  'maintenance-lifecycle',
  $markdown_content_4$,
  'maintenance-lifecycle-v1-hash',
  false,
  NOW(),
  NOW(),
  '2026-01-16'
) ON CONFLICT (domain, path, content_hash) DO NOTHING;

-- 5. Regulatory Standards
INSERT INTO markdown_versions (domain, path, content, content_hash, is_active, created_at, updated_at, generated_at) VALUES
(
  'floodbarrierpros.com',
  'regulatory-standards',
  $markdown_content_5$,
  'regulatory-standards-v1-hash',
  false,
  NOW(),
  NOW(),
  '2026-01-16'
) ON CONFLICT (domain, path, content_hash) DO NOTHING;

-- Markdown content for Engineered Systems
$markdown_content_1$ = $R$# Engineered Flood Barrier Systems

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
*Source: FloodBarrierPros.com engineered systems documentation*
$R$

-- Markdown content for Residential Mitigation
$markdown_content_2$ = $R$# Residential Flood Mitigation

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
*Source: FloodBarrierPros.com residential mitigation documentation*
$R$

-- Markdown content for Installation Compliance
$markdown_content_3$ = $R$# Installation Compliance

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
*Source: FloodBarrierPros.com installation compliance documentation*
$R$

-- Markdown content for Maintenance Lifecycle
$markdown_content_4$ = $R$# Maintenance Lifecycle

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
*Source: FloodBarrierPros.com maintenance lifecycle documentation*
$R$

-- Markdown content for Regulatory Standards
$markdown_content_5$ = $R$# Regulatory Standards

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
*Source: FloodBarrierPros.com regulatory standards documentation*
$R$;
