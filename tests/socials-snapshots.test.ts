import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loadMatchStats=async()=>{
  // @ts-expect-error Browsermodule met pure statushelper.
  return import("../socials/match-stats.mjs");
};

const finished={fixture_key:"fortuna-ajax",kickoff_at:"2026-09-12T18:00:00.000Z"};
const upcoming={fixture_key:"ajax-willem-ii",kickoff_at:"2099-09-20T18:00:00.000Z"};

test("snapshotstatus onderscheidt opgeslagen, ontbrekende en toekomstige wedstrijd",async()=>{
  const {fixtureStatsState}=await loadMatchStats();
  assert.equal(fixtureStatsState(finished,new Set(["fortuna-ajax"]),Date.parse("2026-09-15")),"available");
  assert.equal(fixtureStatsState(finished,new Set(),Date.parse("2026-09-15")),"missing");
  assert.equal(fixtureStatsState(upcoming,new Set(),Date.parse("2026-09-15")),"upcoming");
});

test("selector leest opgeslagen snapshots zonder import en importeert alleen via expliciete actie",()=>{
  const source=readFileSync(new URL("../socials/match-stats.mjs",import.meta.url),"utf8");
  assert.match(source,/view=socials-match-stats&fixture=/);
  assert.match(source,/view=socials-match-stats-import/);
  assert.match(source,/method:"POST"/);
  assert.match(source,/button\.hidden=state==="upcoming"/);
  assert.match(source,/Statistieken verversen/);
  assert.doesNotMatch(source,/fotmob|localStorage|sessionStorage/);
});

test("snapshotmigration bewaart alleen genormaliseerde JSON per fixture",()=>{
  const migration=readFileSync(new URL("../db/migrations/032_socials_match_stats_snapshots.sql",import.meta.url),"utf8");
  assert.match(migration,/CREATE TABLE IF NOT EXISTS socials_match_stats_snapshots/);
  assert.match(migration,/fixture_key TEXT PRIMARY KEY REFERENCES matchday_fixtures/);
  assert.match(migration,/fotmob_match_id BIGINT NOT NULL/);
  assert.match(migration,/snapshot JSONB NOT NULL/);
});
