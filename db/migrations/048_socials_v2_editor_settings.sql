CREATE TABLE IF NOT EXISTS socials_v2_editor_settings (
  fixture_key text NOT NULL,
  generator_id text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_by_discord_user_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fixture_key, generator_id),
  CONSTRAINT socials_v2_editor_settings_generator_check CHECK (generator_id IN ('stats','shots-map','notable-stat','outblinker','top-three','card-video','quote','ajax-vandaag')),
  CONSTRAINT socials_v2_editor_settings_object_check CHECK (jsonb_typeof(settings) = 'object')
);

CREATE INDEX IF NOT EXISTS socials_v2_editor_settings_updated_at_idx
  ON socials_v2_editor_settings(updated_at DESC);
