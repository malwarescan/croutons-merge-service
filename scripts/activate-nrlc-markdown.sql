-- FIX NOW: activate latest markdown for nrlc.ai / index
-- Run against the md.croutons.ai database (the one that stores markdown_versions)

BEGIN;

-- 1) Inspect what exists (optional but recommended)
SELECT id, domain, path, is_active, created_at
FROM markdown_versions
WHERE domain = 'nrlc.ai' AND path = 'index'
ORDER BY created_at DESC
LIMIT 20;

-- 2) Deactivate any currently active versions for this page (safety)
UPDATE markdown_versions
SET is_active = FALSE
WHERE domain = 'nrlc.ai'
  AND path = 'index'
  AND is_active = TRUE;

-- 3) Activate the newest version for this page
UPDATE markdown_versions
SET is_active = TRUE
WHERE id = (
  SELECT id
  FROM markdown_versions
  WHERE domain = 'nrlc.ai'
    AND path = 'index'
  ORDER BY created_at DESC
  LIMIT 1
);

COMMIT;

-- 4) Confirm exactly one active row exists now
SELECT id, domain, path, is_active, created_at
FROM markdown_versions
WHERE domain = 'nrlc.ai' AND path = 'index'
ORDER BY created_at DESC
LIMIT 5;
