import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { players } from "../data/players";
import { renderSocials } from "../api-impl/socials/index";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";
import { socialFormats, socialOutputFormats } from "../lib/socials";

const loadOutblinker=async()=>{
  // De browsermodule heeft bewust geen apart declaration-bestand.
  // @ts-expect-error De pure mappinghelpers zijn ook in Node uitvoerbaar.
  return import("../socials/formats/outblinker.mjs");
};

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:"fortuna-ajax",home_team:"Fortuna Sittard",away_team:"Ajax",competition:"Eredivisie",kickoff_at:"2026-09-12T18:00:00Z",provider_status:"FT",goals_home:1,goals_away:5,finished_at:"2026-09-12T20:00:00Z"};
const brandt={fotmobId:516846,optaId:177591,name:"Julian Brandt",minutes:74,goals:1,assists:0,rating:8.07,xg:.77,xa:.09,xgot:1.51,shots:4,shotsOnTarget:4,chancesCreated:0,passes:58,accuratePasses:51,passAccuracy:87.9,tackles:0,interceptions:0,recoveries:2,groundDuelsWon:0,aerialDuelsWon:0,duelsWon:null};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Socials biedt Wedstrijd in cijfers, Uitblinker, Top 3 spelers en Quote aan",()=>{
  assert.deepEqual(socialFormats.map(({id,title})=>({id,title})),[
    {id:"stats",title:"Wedstrijd in cijfers"},
    {id:"video",title:"Wedstrijd in cijfers: video"},
    {id:"outblinker",title:"Uitblinker"},
    {id:"top-three",title:"Top 3 spelers"},
    {id:"quote",title:"Quote"},
  ]);
});

test("Uitblinker rendert alleen compacte formatcontrols en beide uitvoerformaten",async()=>{
  const html=await renderSocials(session,async()=>[fixture],async()=>players).then(response=>response.text());
  assert.match(html,/data-format-id="outblinker"/);
  assert.match(html,/data-format-workspace="outblinker" data-outblinker-workspace hidden/);
  assert.match(html,/data-outblinker-player-select disabled/);
  assert.equal((html.match(/data-outblinker-stat-slot=/g)??[]).length,5);
  assert.equal((html.match(/data-outblinker-preview-slot=/g)??[]).length,5);
  assert.match(html,/data-outblinker-photo/);
  assert.deepEqual(socialOutputFormats.map(({width,height})=>[width,height]),[[1080,1350],[1080,1920]]);
});

test("Brandt koppelt op genormaliseerde naam aan zijn bestaande AjaxPro-foto",async()=>{
  const {registryPlayerFor}=await loadOutblinker();
  const registry=registryPlayerFor(brandt,players);
  assert.equal(registry?.id,"brandt");
  assert.equal(registry?.imageUrl,"/assets/players/motm/julian-brandt_2627.png");
});

test("Brandt krijgt de vijf afgesproken automatische stats en nul blijft geldig",async()=>{
  const {automaticStatsFor,displayStatValue}=await loadOutblinker();
  assert.deepEqual(automaticStatsFor(brandt),["rating","goals","xg","shots","shotsOnTarget"]);
  assert.equal(displayStatValue(brandt,"rating"),"8,07");
  assert.equal(displayStatValue(brandt,"xg"),"0,77");
  assert.equal(displayStatValue(brandt,"assists"),"0");
  assert.equal(displayStatValue(brandt,"passes"),"51/58");
  assert.equal(displayStatValue(brandt,"passAccuracy"),"87,9%");
});

test("ontbrekende waarden worden niet automatisch gekozen en blijven een streep",async()=>{
  const {automaticStatsFor,displayStatValue,hasUsableStats}=await loadOutblinker();
  assert.equal(automaticStatsFor({...brandt,rating:null,goals:null,xg:null,shots:null,shotsOnTarget:null}).includes("duelsWon"),false);
  assert.equal(displayStatValue(brandt,"duelsWon"),"—");
  assert.equal(hasUsableStats(brandt),true);
  assert.equal(hasUsableStats({name:"Zonder stats",rating:null,goals:null,minutes:null}),false);
  assert.equal(hasUsableStats({name:"Nul is geldig",goals:0}),true);
});

test("Uitblinker toont namen zonder rugnummers en blokkeert een lege spelersvisual",()=>{
  const source=read("../socials/formats/outblinker.mjs");
  assert.match(source,/new Option\(player\.name,providerKey\(player\)\)/);
  assert.match(source,/preview\.hidden=!usable/);
  assert.match(source,/playerStats:hasUsableStats\(player\)/);
});

test("speler- en statwissels lezen alleen gedeelde editorstate en doen geen fetch",()=>{
  const source=read("../socials/formats/outblinker.mjs");
  assert.match(source,/sharedState\.getMatchStats/);
  assert.match(source,/socials:match-stats/);
  assert.match(source,/const selections=new Map\(\)/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|FotMob|fotmob\.com/);
});

test("Uitblinker declareert requirements en reset alleen eigen keuzes",()=>{
  const source=read("../socials/formats/outblinker.mjs");
  assert.match(source,/requirements:\["matchData","matchStats","playerStats","playerPhoto"\]/);
  assert.match(source,/reset\(\)\{selections\.clear\(\);selectedPlayerKey=/);
  assert.doesNotMatch(source,/matchStatsByFixture\.clear|selectedFixtureKey\s*=/);
});

test("Uitblinker heeft afzonderlijke 4:5- en 9:16-composities",()=>{
  const css=read("../socials.css");
  assert.match(css,/\.outblinker-preview\{[^}]*aspect-ratio:4\/5/);
  assert.match(css,/\.outblinker-preview\[data-aspect=vertical-9x16\]\{aspect-ratio:9\/16/);
  assert.match(css,/\.outblinker-preview__photo img\{[^}]*object-fit:contain/);
  assert.match(css,/\.outblinker-preview__stage h3\{[^}]*line-height:\.78/);
  assert.doesNotMatch(css,/\.outblinker-preview[^\n]*(progress|border-radius:999px)/);
});
