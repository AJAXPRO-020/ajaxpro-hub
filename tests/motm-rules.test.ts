import assert from "node:assert/strict";
import test from "node:test";
import { amsterdamFieldsToUtc, canVoteAt, defaultSchedule, rankResults, statusAt, toAmsterdamFields, voteLabel, winnerLabel } from "../lib/motm-rules";

const openAt = "2026-08-01T20:00:00.000Z";
const closeAt = "2026-08-02T20:00:00.000Z";
test("standaard MOTM-sluiting valt 2,5 uur na aftrap",()=>{const schedule=defaultSchedule(new Date("2026-08-01T18:00:00Z"));assert.equal(schedule.closeAt.toISOString(),"2026-08-01T20:30:00.000Z");});
test("standaard MOTM-opening valt bij de aftrap",()=>{const schedule=defaultSchedule(new Date("2026-08-01T18:00:00Z"));assert.equal(schedule.openAt.toISOString(),"2026-08-01T18:00:00.000Z");});
const match = (status: "draft"|"open"|"closed") => ({ status, scheduled_open_at: openAt, scheduled_close_at: closeAt });

test("concept vóór scheduled_open_at blijft Concept", () => {
  assert.equal(statusAt(match("draft"), new Date("2026-08-01T19:59:59Z")), "draft");
});

test("concept wordt na scheduled_open_at Open", () => {
  assert.equal(statusAt(match("draft"), new Date(openAt)), "open");
});

test("open stemming wordt na scheduled_close_at Gesloten", () => {
  assert.equal(statusAt(match("open"), new Date(closeAt)), "closed");
});

test("stemmen na scheduled_close_at wordt geweigerd", () => {
  assert.equal(canVoteAt(match("open"), new Date(closeAt)), false);
});

test("handmatig openen werkt vóór het geplande moment", () => {
  assert.equal(statusAt(match("open"), new Date("2026-08-01T18:00:00Z")), "open");
  assert.equal(canVoteAt(match("open"), new Date("2026-08-01T18:00:00Z")), true);
});

test("handmatig sluiten werkt vóór het geplande moment", () => {
  assert.equal(statusAt(match("closed"), new Date("2026-08-01T18:00:00Z")), "closed");
  assert.equal(canVoteAt(match("closed"), new Date("2026-08-01T18:00:00Z")), false);
});

const row = (id:string,votes:number) => ({ player_id:id,name_snapshot:id,image_url_snapshot:`/${id}.png`,votes });

test("spelers met nul stemmen verschijnen niet in de uitslag", () => {
  assert.deepEqual(rankResults([row("a",2),row("b",0)]).map(result=>result.player_id),["a"]);
});

test("gelijke hoogste score kiest de speler met de minste eerdere overwinningen", () => {
  const results=rankResults([row("a",3),row("b",3),row("c",1)]);
  assert.deepEqual(results.filter(result=>result.rank===1).map(result=>result.player_id),["a"]);
  const withHistory=rankResults([row("a",3),row("b",3),row("c",1)],new Map([["a",2],["b",0]]));
  assert.deepEqual(withHistory.filter(result=>result.rank===1).map(result=>result.player_id),["b"]);
});

test("iedere wedstrijd krijgt één unieke top drie, ook bij gelijke stemmen", () => {
  const results=rankResults([row("a",5),row("b",5),row("c",3),row("d",1),row("e",1),row("f",0)]);
  assert.deepEqual(results.map(result=>result.rank),[1,2,3]);
  assert.equal(new Set(results.map(result=>result.rank)).size,3);
});

test("enkelvoud en meervoud worden correct weergegeven", () => {
  assert.equal(voteLabel(1),"1 stem");
  assert.equal(voteLabel(2),"2 stemmen");
  assert.equal(winnerLabel(1),"1 winnaar");
  assert.equal(winnerLabel(2),"gedeelde winnaars");
});

test("Amsterdamse datum- en tijdvelden combineren en vullen correct terug",()=>{
  const utc=amsterdamFieldsToUtc("2026-08-02","20:30");
  assert.equal(utc?.toISOString(),"2026-08-02T18:30:00.000Z");
  assert.deepEqual(toAmsterdamFields(utc),{date:"2026-08-02",time:"20:30"});
});

test("ongeldige of niet-bestaande lokale datum/tijd wordt geweigerd",()=>{
  assert.equal(amsterdamFieldsToUtc("2026-08-02","25:00"),null);
  assert.equal(amsterdamFieldsToUtc("2026-03-29","02:30"),null);
  assert.equal(amsterdamFieldsToUtc("evil","12:00"),null);
});
