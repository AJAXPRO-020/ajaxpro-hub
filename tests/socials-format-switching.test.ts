import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";
import { renderSocials } from "../api-impl/socials/index";

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:"ajax-psv",home_team:"Ajax",away_team:"PSV",competition:"Eredivisie",kickoff_at:"2026-08-08T18:00:00Z",provider_status:"FT",goals_home:2,goals_away:1,finished_at:"2026-08-08T20:00:00Z"};
const secondFixture:SocialMatchdayFixture={...fixture,fixture_key:"fortuna-ajax",home_team:"Fortuna Sittard",away_team:"Ajax",kickoff_at:"2026-09-12T18:00:00Z",goals_home:1,goals_away:5};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("de eerste render toont alleen het actieve Stats-workspace en de gedeelde instellingen",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.match(html,/data-format-workspace="stats" data-stats-workspace>/);
  assert.match(html,/data-format-workspace="outblinker" data-outblinker-workspace hidden>/);
  assert.match(html,/data-format-workspace="top-three" data-top-three-workspace hidden>/);
  assert.match(html,/data-socials-root/);
  assert.doesNotMatch(html,/name="social-theme"/);
  assert.match(html,/name="social-output"/);
  assert.equal((html.match(/data-socials-format-reset/g)??[]).length,1);
  assert.match(html,/data-socials-format-status/);
});

test("formatkaarten tonen geen extra wedstrijdcontext-tags",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.doesNotMatch(html,/class="status"/);
  assert.match(html,/data-match-context="required"/);
  assert.equal((html.match(/data-match-context="required"/g)??[]).length,4);
});

test("formatwissel toggelt uitsluitend workspaces en bewaart de module-state",()=>{
  const main=read("../socials/main.mjs");
  assert.match(main,/const formatDefinitions=\[statsFormat,outblinkerFormat,topThreeFormat,quoteFormat,videoFormat\]/);
  assert.match(main,/new Map\(formatDefinitions\.map/);
  assert.match(main,/root\.querySelectorAll\("\[data-format-workspace\]"\)/);
  assert.match(main,/workspace\.hidden=workspace\.dataset\.formatWorkspace!==id/);
  assert.match(main,/formats\.get\(activeId\)\?\.controller\.reset\?\.\(\)/);
  assert.doesNotMatch(main,/activeId==="stats"|activeId==="outblinker"/);

  const stats=read("../socials/formats/stats.mjs");
  const outblinker=read("../socials/formats/outblinker.mjs");
  assert.match(stats,/return \{activate:render,deactivate\(\)\{\},reset,getRequirementStatus/);
  assert.match(outblinker,/return \{activate:render,deactivate\(\)\{\},reset\(\)/);
  assert.match(outblinker,/const selections=new Map\(\)/);
});

test("de centrale editor verwerkt requirements zonder format-uitzonderingen",()=>{
  const main=read("../socials/main.mjs");
  assert.match(main,/definition\.requirements\.every/);
  assert.match(main,/controller\.getRequirementStatus/);
  assert.match(main,/workspace\.dataset\.formatReady=String\(ready\)/);
  assert.doesNotMatch(main,/switch\s*\(activeId\)|if\s*\(activeId\s*===/);
});

test("de globale datastatus is uitsluitend aan de geselecteerde wedstrijd gekoppeld",()=>{
  const main=read("../socials/main.mjs");
  assert.match(main,/const globalDataRequirements=\["matchData","matchStats","playerStats"\]/);
  assert.match(main,/const globalDataStatus=\(\)=>/);
  assert.match(main,/playerStats:Array\.isArray\(payload\?\.players\)&&payload\.players\.length>0/);
  assert.doesNotMatch(main,/globalDataRequirements=.*playerPhoto/);
  assert.match(main,/renderGlobalDataStatus\(\);/);
});

test("CSS maakt hidden-workspaces ook met de bestaande grid-layout onzichtbaar",()=>{
  assert.match(read("../socials.css"),/\.socials-shell \[hidden\]\{display:none!important\}/);
});

test("de editor volgt wedstrijd, format, instellingen en preview zonder dubbele wedstrijdkeuze",async()=>{
  const html=await renderSocials(session,async()=>[fixture,secondFixture]).then(response=>response.text());
  assert.ok(html.indexOf("data-socials-stats-fetch")<html.indexOf("socials-format-section"));
  assert.ok(html.indexOf("socials-format-section")<html.indexOf("data-format-workspace=\"stats\""));
  assert.equal((html.match(/data-socials-match-select/g)??[]).length,1);
  assert.equal((html.match(/data-match-select/g)??[]).length,0);
  assert.match(html,/data-format-awaiting/);
  assert.match(html,/data-format-controls/);
});

test("gedeelde previewcontrols verhuizen generiek mee met het actieve format",()=>{
  const main=read("../socials/main.mjs");
  assert.match(main,/data-socials-preview-controls/);
  assert.match(main,/preview\.querySelector\("\.socials-preview-heading"\)\?\.after\(previewControls\)/);
  assert.doesNotMatch(main,/activeId==="stats"|activeId==="outblinker"/);
});

test("lokale voorbeeldmodus is expliciet en blijft buiten de normale pagina",async()=>{
  const normal=await renderSocials(session,async()=>[fixture],async()=>[],async()=>new Set(),false).then(response=>response.text());
  const local=await renderSocials(session,async()=>[fixture],async()=>[],async()=>new Set(),true).then(response=>response.text());
  assert.doesNotMatch(normal,/data-socials-local-video-preview/);
  assert.match(local,/data-socials-local-video-preview="true"/);
  const video=read("../socials/formats/video.mjs");
  assert.match(video,/const previewMode=root\.dataset\.socialsLocalVideoPreview==='true'/);
  assert.match(video,/if\(previewMode\|\|submitting/);
  assert.match(video,/render uitgeschakeld/);
});

test("storyboard gebruikt de bestaande canvas-template en de volledige tijdlijn",()=>{
  const storyboard=read("../socials/video-storyboard.mjs");
  const builder=read("../scripts/build-socials-storyboard.mjs");
  assert.match(builder,/assets\/social-video\/template\.json/);
  assert.match(storyboard,/storyboard-frame\.html/);
  assert.match(storyboard,/__shotstackSeek/);
  assert.match(storyboard,/\['07','OUTRO','14–17 SEC',16\]/);
  assert.match(storyboard,/canvas\.toBlob\(resolve,'image\/png'\)/);
});
