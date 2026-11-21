BEGIN;

CREATE TABLE IF NOT EXISTS ajax_player_photos (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES ajax_players(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('official','normal','meme')),
  image_url TEXT NOT NULL CHECK (image_url ~ '^(https://|/)'),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, photo_type, image_url)
);

CREATE INDEX IF NOT EXISTS ajax_player_photos_player_order_idx
  ON ajax_player_photos (player_id, photo_type, sort_order, id);

CREATE UNIQUE INDEX IF NOT EXISTS ajax_player_photos_one_default_normal_idx
  ON ajax_player_photos (player_id) WHERE photo_type = 'normal' AND is_default;

-- De bestaande image_url blijft de officiële bron en wordt alleen geregistreerd.
INSERT INTO ajax_player_photos (player_id, photo_type, image_url, sort_order)
SELECT id, 'official', image_url, 0
FROM ajax_players
WHERE image_url IS NOT NULL AND image_url <> ''
ON CONFLICT (player_id, photo_type, image_url) DO NOTHING;

COMMIT;
