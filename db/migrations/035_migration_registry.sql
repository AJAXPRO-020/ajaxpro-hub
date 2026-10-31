BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_name TEXT PRIMARY KEY,
  checksum_sha256 TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by TEXT NOT NULL
);

-- Only 034 is recorded here because its production application is explicitly confirmed.
-- Earlier migrations remain unclassified until independently verified.
INSERT INTO schema_migrations(migration_name, checksum_sha256, applied_by)
VALUES('034_motm_announcement_delivery.sql', 'bc06d31f293c9bc069d0cfab52d3142abdd67d20fef2348ae9034c05094b8df4', 'baseline-confirmed-2026-10-31')
ON CONFLICT (migration_name) DO NOTHING;

-- 035 is the bootstrap itself; its marker is intentionally non-file-based to avoid a checksum cycle.
INSERT INTO schema_migrations(migration_name, checksum_sha256, applied_by)
VALUES('035_migration_registry.sql', 'bootstrap-035', 'bootstrap-035')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
