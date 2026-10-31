import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import type { FotMobSocialsMatch } from "../lib/fotmob-socials-parser";
import { renderSocials } from "../api-impl/socials/index";
import { loadSocialsMatchStats, SocialsMatchStatsError } from "../lib/socials-match-stats";
import type { SocialMatchdayFixture } from "../lib/socials-match-context";
import { confirmedFotMobResult } from "../lib/socials-stats-snapshots";

const fixture:SocialMatchdayFixture={fixture_key:"fortuna-ajax",home_team:"Fortuna Sittard",away_team:"Ajax",competition:"Eredivisie",kickoff_at:"2026-09-12T18:00:00.000Z",provider_status:"FT",goals_home:1,goals_away:5,finished_at:"2026-09-12T19:58:53.000Z"};
const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const normalized:FotMobSocialsMatch={
  match:{fotmobId:5781747,homeTeam:"Fortuna Sittard",awayTeam:"Ajax",homeScore:1,awayScore:5,date:"2026-09-12T18:00:00.000Z",finished:true},
  teamStats:{possession:65,xg:4.5,xgot:5.75,shots:27,shotsOnTarget:10,corners:11,passes:618,accuratePasses:562,passAccuracy:90.9,bigChances:9,fouls:12,yellowCards:5,redCards:0},
  opponentTeamStats:{possession:35,xg:.92,xgot:.72,shots:8,shotsOnTarget:4,corners:3,passes:332,accuratePasses:272,passAccuracy:81.9,bigChances:1,fouls:5,yellowCards:1,redCards:0},
  players:[{fotmobId:298448,optaId:109065,name:"Davy Klaassen",minutes:32,goals:1,assists:0,xg:.66,xa:null,xgot:.99,shots:2,shotsOnTarget:1,chancesCreated:0,passes:13,accuratePasses:10,passAccuracy:76.9,tackles:0,interceptions:0,recoveries:1,groundDuelsWon:null,aerialDuelsWon:0,duelsWon:null,rating:7.35}],
};

test("alleen een expliciet afgeronde FotMob-snapshot bevestigt de eindstand",()=>{
  assert.deepEqual(confirmedFotMobResult(normalized.match),{homeScore:1,awayScore:5});
  assert.equal(confirmedFotMobResult({...normalized.match,finished:false}),null);
  assert.equal(confirmedFotMobResult({...normalized.match,finished:undefined}),null);
  assert.equal(confirmedFotMobResult({...normalized.match,homeScore:null}),null);
});

test("gebruikt de geselecteerde bestaande wedstrijdcontext voor resolver en parser",async()=>{
  let resolverInput:unknown,parserUrl="";
  const result=await loadSocialsMatchStats("fortuna-ajax",{
    fixtureLoader:async()=>[fixture],
    resolver:async input=>{resolverInput=input;return {fotmobId:5781747,url:"https://www.fotmob.com/matches/fortuna-sittard-vs-ajax/1v4fod"}},
    parser:async url=>{parserUrl=url;return normalized},
  });
  assert.deepEqual(resolverInput,{date:"2026-09-12",homeTeam:"Fortuna Sittard",awayTeam:"Ajax"});
  assert.equal(parserUrl,"https://www.fotmob.com/matches/fortuna-sittard-vs-ajax/1v4fod");
  assert.deepEqual(result,{fixtureKey:"fortuna-ajax",...normalized});
  assert.equal(result.teamStats.xg,4.5);
  assert.equal(result.opponentTeamStats.xg,.92);
  assert.equal(result.players[0].xg,.66);
  assert.equal(result.players[0].xa,null);
});

test("toekomstige fixtures krijgen nog geen beschikbare wedstrijdstats",async()=>{
  const upcoming={...fixture,fixture_key:"ajax-willem-ii",home_team:"Ajax",away_team:"Willem II",kickoff_at:"2099-09-20T18:00:00.000Z",provider_status:"NS",goals_home:null,goals_away:null,finished_at:null};
  await assert.rejects(loadSocialsMatchStats(upcoming.fixture_key,{fixtureLoader:async()=>[upcoming]}),error=>error instanceof SocialsMatchStatsError&&error.status===409&&error.message==="Nog geen wedstrijdstats beschikbaar.");
});

test("lege providerdata wordt niet als beschikbare wedstrijdstats geaccepteerd",async()=>{
  const empty={...normalized,teamStats:Object.fromEntries(Object.keys(normalized.teamStats).map(key=>[key,null])) as typeof normalized.teamStats,opponentTeamStats:Object.fromEntries(Object.keys(normalized.opponentTeamStats).map(key=>[key,null])) as typeof normalized.opponentTeamStats};
  await assert.rejects(loadSocialsMatchStats("fortuna-ajax",{fixtureLoader:async()=>[fixture],resolver:async()=>({fotmobId:5781747,url:"https://www.fotmob.com/matches/fortuna-sittard-vs-ajax/1v4fod"}),parser:async()=>empty}),error=>error instanceof SocialsMatchStatsError&&error.status===409&&error.message==="Nog geen wedstrijdstats beschikbaar.");
});

test("meldt duidelijk wanneer de resolver geen wedstrijd vindt",async()=>{
  await assert.rejects(loadSocialsMatchStats("fortuna-ajax",{fixtureLoader:async()=>[fixture],resolver:async()=>null}),error=>error instanceof SocialsMatchStatsError&&error.status===404&&error.message==="Wedstrijd niet gevonden.");
});

test("rendert precies één handmatige Stats ophalen-actie voor de bestaande context",async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.equal((html.match(/data-socials-stats-fetch/g)??[]).length,1);
  assert.match(html,/Stats ophalen/);
  assert.match(html,/Fortuna Sittard — Ajax/);
  assert.match(html,/Nog geen stats opgeslagen/);
});

test("houdt providerlogica buiten de UI en stats uitsluitend in editorstate",()=>{
  const source=readFileSync(new URL("../socials/match-stats.mjs",import.meta.url),"utf8");
  assert.match(source,/view=socials-match-stats&fixture=/);
  assert.match(source,/matchStatsByFixture=new Map\(\)/);
  assert.match(source,/Stats ophalen…|Stats beschikbaar\.|Nog geen wedstrijdstats beschikbaar\.|Wedstrijd niet gevonden\.|Fout bij ophalen\./);
  assert.match(source,/stillSelected/);
  assert.doesNotMatch(source,/fotmob|expected_goals|localStorage|sessionStorage/);
});

test("formatwissels en reset voegen geen tweede stats-fetch toe",()=>{
  const fetchSource=readFileSync(new URL("../socials/match-stats.mjs",import.meta.url),"utf8");
  const editorSource=readFileSync(new URL("../socials/main.mjs",import.meta.url),"utf8");
  assert.equal((fetchSource.match(/fetch\(`/g)??[]).length,1);
  assert.doesNotMatch(editorSource,/fetch\(|XMLHttpRequest/);
  assert.match(editorSource,/controller\.reset/);
});
