ALTER TABLE press_conferences
  ADD COLUMN IF NOT EXISTS first_discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS first_source TEXT,
  ADD COLUMN IF NOT EXISTS discovery_lead_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS discovered_sources JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE press_conferences
SET first_source = COALESCE(first_source, CASE
  WHEN source_url ILIKE '%ajax.nl%' THEN 'ajax.nl'
  WHEN source_url ILIKE '%youtube.com%' THEN 'youtube'
  WHEN source_url ILIKE '%xmltv.live%' THEN 'espn-xmltv'
  ELSE 'unknown'
END),
discovered_sources = CASE WHEN discovered_sources = '[]'::jsonb THEN jsonb_build_array(COALESCE(first_source, CASE
  WHEN source_url ILIKE '%ajax.nl%' THEN 'ajax.nl'
  WHEN source_url ILIKE '%youtube.com%' THEN 'youtube'
  WHEN source_url ILIKE '%xmltv.live%' THEN 'espn-xmltv'
  ELSE 'unknown' END)) ELSE discovered_sources END,
discovery_lead_seconds = COALESCE(discovery_lead_seconds, CASE WHEN starts_at IS NOT NULL THEN EXTRACT(EPOCH FROM (starts_at-first_discovered_at))::integer END);

CREATE INDEX IF NOT EXISTS press_conferences_first_discovered_idx ON press_conferences(first_discovered_at DESC);
