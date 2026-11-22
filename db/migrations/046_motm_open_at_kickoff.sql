-- Nieuwe geplande MOTM-stemmingen openen bij de aftrap.
-- Alleen onaangepaste oude standaardplanningen worden bijgewerkt.
UPDATE motm_matches
SET scheduled_open_at = kickoff_at
WHERE status = 'draft'
  AND deleted_at IS NULL
  AND scheduled_open_at IS NOT NULL
  AND scheduled_open_at = kickoff_at + INTERVAL '2 hours';
