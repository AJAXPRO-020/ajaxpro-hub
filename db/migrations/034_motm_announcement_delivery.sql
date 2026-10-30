BEGIN;

ALTER TABLE motm_matches
  ADD COLUMN IF NOT EXISTS announcement_status TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS announcement_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS announcement_error TEXT;

UPDATE motm_matches
SET announcement_status = 'sent'
WHERE announcement_sent_at IS NOT NULL AND announcement_status = 'not_sent';

ALTER TABLE motm_matches
  DROP CONSTRAINT IF EXISTS motm_announcement_status;

ALTER TABLE motm_matches
  ADD CONSTRAINT motm_announcement_status
  CHECK (announcement_status IN ('not_sent', 'sending', 'sent', 'failed', 'unknown'));

COMMIT;
