/* jshint node: true, esversion: 11 */
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway")
    ? { rejectUnauthorized: false }
    : false,
});

export async function insertJob(precog, prompt, context = {}) {
  const {
    rows: [job],
  } = await pool.query(
    `INSERT INTO precogs.jobs (precog, prompt, context)
     VALUES ($1, $2, $3)
     RETURNING id, status, created_at`,
    [precog, prompt, JSON.stringify(context)]
  );
  return job;
}

export async function getJob(jobId) {
  const { rows } = await pool.query(
    `SELECT * FROM precogs.jobs WHERE id = $1`,
    [jobId]
  );
  return rows[0] || null;
}

export async function updateJobStatus(jobId, status, error = null) {
  const updates = [];
  const params = [];
  let paramIdx = 1;

  updates.push(`status = $${paramIdx++}`);
  params.push(status);

  if (status === "running" && !updates.includes("started_at")) {
    updates.push(`started_at = NOW()`);
  }
  if (status === "done" || status === "error") {
    updates.push(`completed_at = NOW()`);
  }
  if (error) {
    updates.push(`error = $${paramIdx++}`);
    params.push(error);
  }

  params.push(jobId);
  await pool.query(
    `UPDATE precogs.jobs SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
    params
  );
}

export async function insertEvent(jobId, type, data) {
  await pool.query(
    `INSERT INTO precogs.events (job_id, type, data)
     VALUES ($1, $2, $3)`,
    [jobId, type, JSON.stringify(data)]
  );
}

export async function getJobEvents(jobId, limit = 1000) {
  const { rows } = await pool.query(
    `SELECT id, type, data, ts
     FROM precogs.events
     WHERE job_id = $1
     ORDER BY ts ASC
     LIMIT $2`,
    [jobId, limit]
  );
  return rows;
}

// Croutons functions
export async function getCrouton(id) {
  const { rows } = await pool.query(
    `SELECT 
       id::text,
       claim,
       entities,
       confidence,
       sources,
       created_at::text,
       updated_at::text
     FROM croutons.croutons 
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function getAllCroutons(limit = 1000) {
  const { rows } = await pool.query(
    `SELECT 
       id::text,
       claim,
       entities,
       confidence,
       sources,
       created_at::text,
       updated_at::text
     FROM croutons.croutons 
     ORDER BY updated_at DESC 
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function insertCrouton(claim, entities = [], confidence = null, sources = []) {
  const {
    rows: [crouton],
  } = await pool.query(
    `INSERT INTO croutons.croutons (claim, entities, confidence, sources)
     VALUES ($1, $2, $3, $4)
     RETURNING 
       id::text,
       claim,
       entities,
       confidence,
       sources,
       created_at::text,
       updated_at::text`,
    [claim, entities, confidence, sources]
  );
  return crouton;
}

// Source tracking functions
export async function getCroutonWithSourceTracking(id) {
  const { rows } = await pool.query(
    `SELECT 
       c.id::text,
       c.claim,
       c.entities,
       c.confidence,
       c.sources,
       c.created_at::text,
       c.updated_at::text,
       COALESCE(json_agg(
         json_build_object(
           'source_domain', sp.source_domain,
           'source_url', sp.source_url,
           'ai_readable_source', sp.ai_readable_source,
           'markdown_discovered', sp.markdown_discovered,
           'discovery_method', sp.discovery_method,
           'first_observed', sp.first_observed::text,
           'last_verified', sp.last_verified::text
         )
       ) FILTER (WHERE sp.id IS NOT NULL), '[]') as source_tracking
     FROM croutons.croutons c
     LEFT JOIN source_tracking.source_participation sp ON c.id = sp.crouton_id
     WHERE c.id = $1
     GROUP BY c.id, c.claim, c.entities, c.confidence, c.sources, c.created_at, c.updated_at`,
    [id]
  );
  return rows[0] || null;
}

export async function upsertSourceParticipation(croutonId, sourceUrl, discoveryMethod, aiReadable = false, markdownDiscovered = false) {
  const sourceDomain = await pool.query(
    `SELECT source_tracking.extract_domain($1) as domain`,
    [sourceUrl]
  );
  
  const domain = sourceDomain.rows[0].domain;
  
  const { rows } = await pool.query(
    `INSERT INTO source_tracking.source_participation 
       (crouton_id, source_domain, source_url, discovery_method, ai_readable_source, markdown_discovered)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (crouton_id, source_url) 
     DO UPDATE SET
       discovery_method = EXCLUDED.discovery_method,
       ai_readable_source = EXCLUDED.ai_readable_source,
       markdown_discovered = EXCLUDED.markdown_discovered,
       last_verified = NOW()
     RETURNING 
       crouton_id::text,
       source_domain,
       source_url,
       ai_readable_source,
       markdown_discovered,
       discovery_method,
       first_observed::text,
       last_verified::text`,
    [croutonId, domain, sourceUrl, discoveryMethod, aiReadable, markdownDiscovered]
  );
  
  return rows[0];
}

export async function getSourceDomainStats() {
  const { rows } = await pool.query(
    `SELECT 
       source_domain as domain,
       COUNT(*) as crouton_count,
       BOOL_OR(ai_readable_source) as markdown,
       ARRAY_AGG(DISTINCT discovery_method) as discovery_methods,
       MAX(last_verified) as last_seen
     FROM source_tracking.source_participation
     GROUP BY source_domain
     ORDER BY crouton_count DESC`,
    []
  );
  
  return rows.map(row => ({
    domain: row.domain,
    crouton_count: parseInt(row.crouton_count),
    markdown: row.markdown,
    discovery_methods: row.discovery_methods,
    last_seen: row.last_seen
  }));
}

export { pool };

