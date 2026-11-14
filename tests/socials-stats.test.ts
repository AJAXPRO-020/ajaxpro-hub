import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { renderSocials } from "../api-impl/socials/index";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";
import { isValidStatsValue, statsFields } from "../lib/socials-stats";

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:"ajax-psv",home_team:"Ajax",away_team:"PSV",competition:"Eredivisie",kickoff_at:"2026-08-08T18:00:00Z",provider_status:"FT",goals_home:2,goals_away:1,finished_at:"2026-08-08T20:00:00Z"};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const loadStatsFormat=async()=>{
  // @ts-expect-error De pure browserhelper is ook in Node uitvoerbaar.
  return import("../socials/formats/stats.mjs");
};

test("Wedstrijd in cijfers biedt betrouwbare vergelijkbare teamvelden",()=>{
  assert.deepEqual(statsFields.map(field=>field.label),["xG","xGOT","Balbezit","Schoten","Schoten op doel","Grote kansen","Corners"]);
  assert.deepEqual(statsFields.map(field=>field.kind),["decimal","decimal","percentage","integer","integer","integer","integer"]);
});

test("Stats gebruikt een expliciete responsive label- en invoerstructuur",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.equal((html.match(/class="stats-field-label"/g)??[]).length,statsFields.length);
  assert.doesNotMatch(html,/class="stats-field"[^>]*>\s*<legend/);
});

test("Stats-validatie accepteert lege en passende waarden en weigert ongeldige invoer",()=>{
  for(const id of statsFields.map(field=>field.id))assert.equal(isValidStatsValue(id,""),true);
  assert.equal(isValidStatsValue("xg","1.42"),true);
  assert.equal(isValidStatsValue("xg","1.234"),false);
  assert.equal(isValidStatsValue("possession","54.5"),true);
  assert.equal(isValidStatsValue("possession","101"),false);
  assert.equal(isValidStatsValue("shots","12"),true);
  assert.equal(isValidStatsValue("shots","12.5"),false);
  assert.equal(isValidStatsValue("unknown","1"),false);
});

test("Stats rendert vaste Ajax- en tegenstandervelden met beide outputformaten",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.equal((html.match(/data-stat-id=/g)??[]).length,14);
  assert.equal((html.match(/data-team="ajax"/g)??[]).length,7);
  assert.equal((html.match(/data-team="opponent"/g)??[]).length,7);
  assert.match(html,/value="portrait-4x5"[^>]*data-width="1080" data-height="1350"/);
  assert.match(html,/value="vertical-9x16"[^>]*data-width="1080" data-height="1920"/);
  assert.match(html,/Download PNG · template volgt/);
  assert.match(html,/\/socials\/main\.mjs/);
});

test("Stats-preview rendert de vaste editorial hiërarchie zonder dashboardpatronen",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.match(html,/class="match-numbers-preview"/);
  assert.match(html,/WEDSTRIJD<br>IN CIJFERS/);
  assert.match(html,/data-preview-score="home"/);
  assert.match(html,/data-preview-score="away"/);
  for(const id of ["xg","possession","shots","shotsOnTarget"]){
    assert.match(html,new RegExp(`data-match-stat="${id}-home"`));
    assert.match(html,new RegExp(`data-match-stat="${id}-away"`));
  }
  assert.equal((html.match(/data-preview-slot=/g)??[]).length,4);
  assert.doesNotMatch(html,/data-match-stat="bigChances-(?:home|away)"/);
  assert.doesNotMatch(html,/<progress|progressbar/);
  assert.doesNotMatch(html,/EXPECTED GOALS|>EINDSTAND<|AJAXPRO\.NL/);
  assert.doesNotMatch(html,/match-numbers-preview__mark/);
  assert.match(html,/match-numbers-preview__footer" aria-hidden="true"><strong>AJAXPRO<\/strong>/);
  assert.equal((html.match(/match-numbers-preview__stat--lead/g)??[]).length,2);
  assert.match(html,/match-numbers-preview__footer" aria-hidden="true"/);
  assert.match(read("../socials.css"),/\.match-numbers-preview__header strong\{[^}]*line-height:\.84/);
});

test("Stats blokkeert zonder vereiste wedstrijdcontext",async()=>{
  const html=await renderSocials(session,async()=>[]).then(response=>response.text());
  assert.match(html,/data-stats-unavailable/);
  assert.match(html,/Stats is nu niet beschikbaar/);
  assert.match(html,/data-stats-workspace hidden/);
  assert.match(html,/data-format-id="stats"[^>]*aria-pressed="false"[^>]*disabled/);
});

test("Stats blijft een losse formatmodule met herstel naar opgehaalde defaults en zonder writes",()=>{
  const source=read("../socials/formats/stats.mjs");
  assert.match(source,/export const initStats/);
  assert.match(source,/const reset=.*applyLoadedStats\(true\);render\(\)/);
  assert.match(source,/export const statsFormat=\{id:"stats",label:"Wedstrijd in cijfers",requirements:\["matchData","matchStats"\],init:initStats\}/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
  assert.doesNotMatch(source,/matchSelect\.value\s*=/);
});

test("Stats gebruikt alleen genormaliseerde teamvelden uit de gedeelde editorstate",()=>{
  const source=read("../socials/formats/stats.mjs");
  assert.match(source,/sharedState\.getMatchStats/);
  assert.match(source,/socials:match-stats/);
  assert.match(source,/bigChances:"bigChances"/);
  assert.match(source,/opponentTeamStats/);
  assert.match(source,/toFixed\(2\)/);
  assert.doesNotMatch(source,/FotMob|fotmob/);
});

test("Fortuna en Ajax worden beide uit het genormaliseerde payload gevuld en null blijft leeg",async()=>{
  const {loadedStatsFor}=await loadStatsFormat();
  assert.deepEqual(loadedStatsFor({teamStats:{xg:4.5,possession:65,shots:27,shotsOnTarget:10,bigChances:9},opponentTeamStats:{xg:.92,possession:35,shots:8,shotsOnTarget:4,bigChances:1}}),{
    xg:{ajax:4.5,opponent:.92},xgot:{ajax:null,opponent:null},possession:{ajax:65,opponent:35},shots:{ajax:27,opponent:8},shotsOnTarget:{ajax:10,opponent:4},bigChances:{ajax:9,opponent:1},corners:{ajax:null,opponent:null},
  });
  assert.deepEqual(loadedStatsFor({teamStats:{xg:null},opponentTeamStats:{xg:null}}).xg,{ajax:null,opponent:null});
});

test("automatische selectie prioriteert inhoudelijke cijfers en vereist vergelijkbaarheid",async()=>{
  const {automaticStatSelection}=await loadStatsFormat();
  assert.deepEqual(automaticStatSelection({teamStats:{xg:1.9,xgot:2.1,possession:61,shots:15,shotsOnTarget:8,bigChances:4,corners:7},opponentTeamStats:{xg:.4,xgot:.7,possession:39,shots:7,shotsOnTarget:2,bigChances:1,corners:2}}),["xg","bigChances","shotsOnTarget","possession"]);
  assert.deepEqual(automaticStatSelection({teamStats:{xg:1.2,xgot:null,possession:55,shots:10,shotsOnTarget:null,bigChances:2,corners:null},opponentTeamStats:{xg:1.1,xgot:null,possession:null,shots:9,shotsOnTarget:null,bigChances:1,corners:null}}),["xg","bigChances","shots"]);
});

test("Wedstrijd in cijfers gebruikt een begrensde centrale vergelijkingsas in beide verhoudingen",()=>{
  const css=read("../socials.css");
  assert.match(css,/\.match-numbers-preview\{[^}]*grid-template-rows:13% 37% 17% 26% 7%/);
  assert.match(css,/\.match-numbers-preview__score\{[^}]*width:82%/);
  assert.match(css,/\.match-numbers-preview__xg\{[^}]*width:78%/);
  assert.match(css,/\.match-numbers-preview__evidence\{[^}]*width:78%[^}]*grid-template-columns:1fr/);
  assert.match(css,/\.match-numbers-preview__stat>p\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(13cqw,auto\) minmax\(0,1fr\)/);
  assert.match(css,/vertical-9x16[^\n]*match-numbers-preview__evidence\{width:82%/);
});
