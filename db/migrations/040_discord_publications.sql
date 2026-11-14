BEGIN;

CREATE TABLE IF NOT EXISTS discord_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'unknown')),
  discord_message_id TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  error TEXT,
  actor_discord_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discord_publications_source_idx
  ON discord_publications(source_type, source_id);

CREATE INDEX IF NOT EXISTS discord_publications_status_idx
  ON discord_publications(status, attempted_at);

COMMIT;
