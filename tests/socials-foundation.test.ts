import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { socialFormats, socialOutputFormats } from "../lib/socials";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Socials registreert formats met een eigen matchContext-behoefte",()=>{
  assert.deepEqual(socialFormats.map(format=>({id:format.id,matchContext:format.matchContext})),[
    {id:"stats",matchContext:"required"},
    {id:"video",matchContext:"required"},
    {id:"outblinker",matchContext:"required"},
    {id:"top-three",matchContext:"required"},
    {id:"quote",matchContext:"none"},
  ]);
});

test("Socials registreert uitsluitend de twee afgesproken outputformaten",()=>{
  assert.deepEqual(socialOutputFormats.map(({width,height})=>[width,height]),[[1080,1350],[1080,1920]]);
});

test("Socials toont uitsluitend wedstrijden binnen veertien dagen rond nu",()=>{
  const source=read("../lib/socials-match-context.ts");
  assert.match(source,/FROM matchday_fixtures/);
  assert.match(source,/kickoff_at > now\(\) - interval '14 days'/);
  assert.match(source,/kickoff_at < now\(\) \+ interval '14 days'/);
  assert.match(source,/ORDER BY kickoff_at ASC/);
  assert.doesNotMatch(source,/INSERT|UPDATE|DELETE|CREATE TABLE/i);
});

test("Socials blijft onderdeel van club-tools en maakt geen eigen API-entrypoint",()=>{
  const tools=read("../api/club-tools.ts");
  assert.match(tools,/permissions\.toolsSocials/);
  assert.match(tools,/renderSocials/);
  assert.throws(()=>read("../api/socials.ts"));
});
