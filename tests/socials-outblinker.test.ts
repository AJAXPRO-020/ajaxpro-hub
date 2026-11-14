import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const loadOutblinker=async()=>{
  // De browsermodule bevat bewust geen apart declaration-bestand.
  // @ts-expect-error De pure selectiehelpers zijn ook in Node uitvoerbaar.
  return import("../socials/formats/outblinker.mjs");
};

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("beste speler gebruikt rating en minuten als tie-breaker",async()=>{
  const {bestRatedPlayer}=await loadOutblinker();
  const selected=bestRatedPlayer([
    {name:"Korte invalbeurt",rating:8.4,minutes:12},
    {name:"Volledige wedstrijd",rating:8.4,minutes:90},
    {name:"Lagere rating",rating:8.1,minutes:90},
  ]);
  assert.equal(selected?.name,"Volledige wedstrijd");
});

test("ontbrekende ratings leveren geen automatische speler op",async()=>{
  const {bestRatedPlayer}=await loadOutblinker();
  assert.equal(bestRatedPlayer([{name:"Speler A",minutes:90},{name:"Speler B",minutes:20}]),null);
});

test("automatische stats tonen rating en opvallende beschikbare prestaties eerst",async()=>{
  const {automaticStatsFor}=await loadOutblinker();
  assert.deepEqual(automaticStatsFor({rating:8.7,goals:2,assists:1,xa:.42,passes:80,minutes:90}),["rating","goals","assists","xa","passes"]);
  assert.deepEqual(automaticStatsFor({rating:7.2,goals:0,assists:0,tackles:4,interceptions:3,recoveries:5,passes:80}),["rating","tackles","interceptions","recoveries","passes"]);
});

test("ontbrekende stats worden niet als nul toegevoegd",async()=>{
  const {automaticStatsFor}=await loadOutblinker();
  assert.deepEqual(automaticStatsFor({rating:null,goals:null,assists:null,xg:null,xa:null,passes:0}),["passes"]);
});

test("outblinker behoudt handmatige bediening en herstelknop",()=>{
  const source=read("../socials/formats/outblinker.mjs");
  const html=read("../api-impl/socials/index.ts");
  assert.match(source,/manualPlayerSelection/);
  assert.match(source,/data-outblinker-reset-automatic/);
  assert.match(html,/Herstel voorstel/);
});
