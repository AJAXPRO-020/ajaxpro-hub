CREATE TABLE IF NOT EXISTS press_conferences (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fixture_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('preview','review')),
  event_date DATE NOT NULL,
  starts_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('unconfirmed','announced','live','ended')),
  source_url TEXT NOT NULL,
  watch_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_priority SMALLINT NOT NULL DEFAULT 0,
  source_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fixture_key, kind, event_date)
);

CREATE TABLE IF NOT EXISTS press_conference_checks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok','unchanged','skipped','error')),
  detail TEXT,
  item_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS press_conference_source_cache (
  source_url TEXT PRIMARY KEY,
  lastmod TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS press_conferences_date_idx ON press_conferences(event_date DESC);
CREATE INDEX IF NOT EXISTS press_conference_checks_recent_idx ON press_conference_checks(source, checked_at DESC);

-- Beperkte eerste vulling: Ajax bevestigt in het artikel van 21 oktober
-- de persconferentie voor Ajax - Atalanta; een begintijd wordt niet genoemd.
INSERT INTO press_conferences(fixture_key,kind,event_date,status,source_url,watch_links,source_priority)
SELECT fixture_key,'preview','2026-10-21','ended',
  'https://www.ajax.nl/artikelen/persco-in-aanloop-naar-atalanta-thuis-woensdag-live-te-volgen/',
  '{}'::jsonb,2
FROM matchday_fixtures
WHERE kickoff_at::date='2026-10-22' AND lower(home_team)='ajax' AND lower(away_team)='atalanta'
ON CONFLICT(fixture_key,kind,event_date) DO NOTHING;

