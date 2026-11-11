BEGIN;

CREATE TABLE IF NOT EXISTS content_hub_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  scheduled_for DATE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('video', 'photo')),
  notes TEXT NOT NULL DEFAULT '',
  drive_file_id TEXT NOT NULL UNIQUE,
  drive_file_name TEXT NOT NULL,
  drive_mime_type TEXT NOT NULL,
  drive_file_size BIGINT NOT NULL CHECK (drive_file_size > 0),
  drive_parent_folder_id TEXT NOT NULL,
  created_by_discord_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleanup_after DATE NOT NULL,
  cleanup_attempts INTEGER NOT NULL DEFAULT 0,
  cleanup_last_error TEXT,
  drive_deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS content_hub_posts_scheduled_idx ON content_hub_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS content_hub_posts_cleanup_idx ON content_hub_posts(cleanup_after, drive_deleted_at);

COMMIT;
