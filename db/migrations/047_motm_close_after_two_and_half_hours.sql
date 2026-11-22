-- Nieuwe standaard: MOTM sluit 2,5 uur na de aftrap.
-- Alleen onaangepaste oude standaardplanningen worden bijgewerkt.
UPDATE motm_matches
SET scheduled_close_at = kickoff_at + INTERVAL '150 minutes'
WHERE status IN ('draft', 'open')
  AND deleted_at IS NULL
  AND scheduled_close_at IS NOT NULL
  AND scheduled_close_at = kickoff_at + INTERVAL '3 hours';
