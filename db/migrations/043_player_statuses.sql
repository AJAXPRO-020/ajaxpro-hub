BEGIN;

ALTER TABLE ajax_players
  ADD COLUMN IF NOT EXISTS selection_group TEXT
    CHECK (selection_group IS NULL OR selection_group IN ('first_team','youth','outside')),
  ADD COLUMN IF NOT EXISTS contract_form TEXT
    CHECK (contract_form IS NULL OR contract_form IN ('owned','loaned_in','no_contract','unknown')),
  ADD COLUMN IF NOT EXISTS loaned_out BOOLEAN NOT NULL DEFAULT false;

-- Alleen statussen die zonder redactionele interpretatie uit bestaande data volgen.
UPDATE ajax_players
SET selection_group = CASE
      WHEN loan_club IS NOT NULL THEN 'outside'
      ELSE selection_group
    END,
    contract_form = CASE
      WHEN lower(COALESCE(contract_note, '')) LIKE 'gehuurd van %' THEN 'loaned_in'
      WHEN lower(COALESCE(contract_note, '')) LIKE 'arbeidsovereenkomst beëindigd%' THEN 'no_contract'
      ELSE contract_form
    END,
    loaned_out = loan_club IS NOT NULL
WHERE selection_group IS NULL OR contract_form IS NULL OR loaned_out IS DISTINCT FROM (loan_club IS NOT NULL);

COMMIT;
