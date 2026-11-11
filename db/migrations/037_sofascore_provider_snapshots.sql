BEGIN;

ALTER TABLE socials_match_stats_snapshots
  ADD COLUMN IF NOT EXISTS provider_snapshots JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(provider_snapshots) = 'object');

COMMIT;
