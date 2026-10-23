BEGIN;
CREATE TABLE IF NOT EXISTS socials_video_jobs (
 id UUID PRIMARY KEY,
 fixture_key TEXT NOT NULL REFERENCES matchday_fixtures(fixture_key),
 requested_by TEXT NOT NULL,
 request_key UUID NOT NULL,
 data_hash TEXT NOT NULL,
 template_version TEXT NOT NULL,
 render_data JSONB NOT NULL,
 source_snapshot JSONB NOT NULL,
 source_fixture JSONB NOT NULL,
 render_id UUID UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('submitting','queued','fetching','rendering','done','failed','uncertain','expired')),
 output_url TEXT,
 available_until TIMESTAMPTZ,
 error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 checked_at TIMESTAMPTZ,
 UNIQUE(requested_by,request_key)
);
-- This low-volume tool deliberately permits one active render across all staff.
CREATE UNIQUE INDEX IF NOT EXISTS socials_video_one_active_idx ON socials_video_jobs ((true))
 WHERE status IN ('submitting','queued','fetching','rendering','uncertain');
CREATE INDEX IF NOT EXISTS socials_video_fixture_idx ON socials_video_jobs(fixture_key,created_at DESC);
COMMIT;
