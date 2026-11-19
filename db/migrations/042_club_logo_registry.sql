-- Renumbered from 037_club_logo_registry.sql to avoid the existing provider
-- snapshot migration. Statements remain idempotent for previously imported registries.
BEGIN;

CREATE TABLE IF NOT EXISTS club_logo_registry (
  club_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  competition TEXT NOT NULL CHECK (competition IN ('eredivisie', 'eerste-divisie')),
  season TEXT NOT NULL,
  logo_path TEXT NOT NULL,
  source_url TEXT,
  license_info TEXT,
  external_team_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  alias_of_club_id TEXT REFERENCES club_logo_registry(club_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, season, competition)
);

CREATE TABLE IF NOT EXISTS club_logo_aliases (
  alias_key TEXT PRIMARY KEY,
  alias TEXT NOT NULL,
  club_id TEXT NOT NULL REFERENCES club_logo_registry(club_id) ON DELETE CASCADE,
  season TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_logo_aliases_club_idx ON club_logo_aliases(club_id);

CREATE OR REPLACE FUNCTION club_name_key(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(trim(coalesce(input, '')), '[^[:alnum:]]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION resolve_club_logo(input_name TEXT, input_team_id TEXT DEFAULT NULL)
RETURNS TABLE (club_id TEXT, canonical_name TEXT, logo_path TEXT, competition TEXT, season TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT c.club_id, c.canonical_name, c.logo_path, c.competition, c.season
  FROM club_logo_registry c
  LEFT JOIN club_logo_aliases a ON a.club_id = c.club_id
  WHERE (input_team_id IS NOT NULL AND c.external_team_ids ? input_team_id)
     OR a.alias_key = club_name_key(input_name)
  ORDER BY c.season DESC, c.competition, c.club_id
  LIMIT 1;
$$;

COMMIT;
