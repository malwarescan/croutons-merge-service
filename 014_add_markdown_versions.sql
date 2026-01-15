-- migrations/014_add_markdown_versions.sql
-- Add markdown versions table for deterministic rendering

CREATE TABLE IF NOT EXISTS markdown_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain, path, content_hash)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_markdown_versions_domain ON markdown_versions(domain);
CREATE INDEX IF NOT EXISTS idx_markdown_versions_active ON markdown_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_markdown_versions_domain_path ON markdown_versions(domain, path);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_markdown_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_markdown_versions_updated_at
  BEFORE UPDATE ON markdown_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_markdown_versions_updated_at();
