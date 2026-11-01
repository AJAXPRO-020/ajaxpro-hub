import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { socialFormats, socialOutputFormats } from "../lib/socials";
import { resolvedScore } from "../socials/formats/stats.mjs";
import { socialFilename } from "../socials/filename.mjs";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Socials registreert formats met een eigen matchContext-behoefte",()=>{
  assert.deepEqual(socialFormats.map(format=>({id:format.id,matchContext:format.matchContext})),[
    {id:"stats",matchContext:"required"},
    {id:"video",matchContext:"required"},
    {id:"outblinker",matchContext:"required"},
    {id:"top-three",matchContext:"required"},
    {id:"quote",matchContext:"none"},
    {id:"ajax-vandaag",matchContext:"none"},
  ]);
});

test("Socials registreert uitsluitend de twee afgesproken outputformaten",()=>{
  assert.deepEqual(socialOutputFormats.map(({width,height})=>[width,height]),[[1080,1350],[1080,1920]]);
});

test("Socials toont recente afgeronde, recent begonnen en aankomende wedstrijden uit de centrale context",()=>{
  const source=read("../lib/socials-match-context.ts");
  assert.match(source,/FROM matchday_fixtures/);
  assert.match(source,/WITH recent_finished AS/);
  assert.match(source,/LIMIT 2/);
  assert.match(source,/WITH recent_finished AS[\s\S]*upcoming/);
  assert.match(source,/recently_started AS/);
  assert.match(source,/kickoff_at >= now\(\) - interval '72 hours'/);
  assert.match(source,/LIMIT 3/);
  assert.match(source,/ORDER BY kickoff_at ASC/);
  assert.doesNotMatch(source,/INSERT|UPDATE|DELETE|CREATE TABLE/i);
});

test("Socials blijft onderdeel van club-tools en maakt geen eigen API-entrypoint",()=>{
  const tools=read("../api/club-tools.ts");
  assert.match(tools,/permissions\.toolsSocials/);
  assert.match(tools,/renderSocials/);
  assert.throws(()=>read("../api/socials.ts"));
});

test("Wedstrijd in cijfers gebruikt de snapshotscore wanneer de fixture nog leeg is",()=>{
  assert.deepEqual(resolvedScore({goals_home:null,goals_away:null},{match:{homeScore:1,awayScore:1}}),{home:1,away:1});
  assert.deepEqual(resolvedScore({goals_home:2,goals_away:0},{match:{homeScore:1,awayScore:1}}),{home:2,away:0});
});

test("Social exports bevatten datum, wedstrijd, format en verhouding",()=>{
  assert.equal(socialFilename({date:"2026-10-31T20:00:00.000Z",home:"Ajax",away:"AZ",format:"wedstrijd-in-cijfers",ratio:"4x5"}),"ajax-az-2026-10-31-wedstrijd-in-cijfers-4x5.png");
  assert.equal(socialFilename({date:"2026-10-31",subject:"Marco van Basten is jarig",format:"ajax-vandaag-player",ratio:"9x16"}),"marco-van-basten-is-jarig-2026-10-31-ajax-vandaag-player-9x16.png");
});
