import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { matchCenterMarkup, registryPlayerForMatchPlayer, type MatchCenterFixture } from "../lib/match-center";

const match=(fixtureKey:string,homeTeam:string,awayTeam:string,homeScore:number,awayScore:number):MatchCenterFixture=>({fixtureKey,homeTeam,awayTeam,competition:"Europa League",kickoffAt:"2026-10-22T19:00:00.000Z",homeScore,awayScore,players:[],snapshot:{fixtureKey,match:{fotmobId:6112393,homeTeam,awayTeam,homeScore,awayScore,date:"2026-10-22T19:00:00.000Z"},teamStats:{xg:2.1,xgot:null,possession:60,shots:10,shotsOnTarget:5,corners:3,passes:500,accuratePasses:440,passAccuracy:88,bigChances:2,fouls:null,yellowCards:null,redCards:null},opponentTeamStats:{xg:1.2,xgot:null,possession:40,shots:8,shotsOnTarget:3,corners:2,passes:300,accuratePasses:240,passAccuracy:80,bigChances:1,fouls:null,yellowCards:null,redCards:null},players:[{fotmobId:1,optaId:null,name:"Test speler",minutes:90,goals:null,assists:null,xg:null,xa:null,xgot:null,shots:null,shotsOnTarget:null,chancesCreated:null,passes:null,accuratePasses:null,passAccuracy:null,tackles:null,interceptions:null,recoveries:null,groundDuelsWon:null,aerialDuelsWon:null,duelsWon:null,rating:8.2}]}});

test("Match Center blijft een Members-route en gebruikt alleen een opgeslagen snapshot",()=>{
  const config=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
  assert.equal(config.rewrites.find((route:any)=>route.source==="/club/members/match-center")?.destination,"/api/members?view=match-center");
  const source=readFileSync(new URL("../lib/match-center.ts",import.meta.url),"utf8");
  assert.match(source,/loadSocialsStatsAvailability/);
  assert.match(source,/loadSocialsMatchStatsSnapshot/);
  assert.doesNotMatch(source,/fetch\(|fotmob\.com/);
});

test("Match Center toont ontbrekende spelerwaarden niet als nul",()=>{
  const active=match("ajax-willem-ii","Ajax","Willem II",5,1);
  const html=matchCenterMarkup({matches:[active],active});
  assert.match(html,/FotMob/);
  assert.doesNotMatch(html,/>Goals<\/dt><dd>0<\/dd>/);
  assert.doesNotMatch(html,/>xG<\/dt><dd>0,00<\/dd>/);
  assert.doesNotMatch(html,/>xGOT<\/span>/);
});

test("wedstrijdselector deelt aangeleverde fixtures en schakelt grenzen uit",()=>{
  const older=match("ajax-willem-ii","Ajax","Willem II",5,1),active=match("ajax-atalanta","Ajax","Atalanta",2,0);
  const html=matchCenterMarkup({matches:[active,older],active});
  assert.match(html,/value="ajax-atalanta" selected/);
  assert.match(html,/value="ajax-willem-ii"/);
  assert.match(html,/match=ajax-willem-ii/);
  assert.match(html,/Volgende wedstrijd/);
  assert.match(matchCenterMarkup({matches:[active],active}),/Geen wedstrijd/);
});

test("spelerfoto gebruikt veilige naamkoppeling met fallback",()=>{
  const player:any={id:"gloukh",name:"Oscar Gloukh"};
  assert.equal(registryPlayerForMatchPlayer("Oscar Gloukh",[player]),player);
  assert.equal(registryPlayerForMatchPlayer("Onbekend",[player]),null);
});

test("editorial statistieken houden Ajax links, ook als Ajax uit speelt",()=>{
  const active=match("groningen-ajax","FC Groningen","Ajax",1,2);
  const html=matchCenterMarkup({matches:[active],active});
  assert.match(html,/Ajax 2,10, tegenstander 1,20/);
  assert.match(html,/Ajax 60%, tegenstander 40%/);
  assert.match(html,/--bar-share:64%/);
  assert.match(html,/aria-label="Ajax: rood; tegenstander: neutraal"|AJAX \/ TEGENSTANDER/);
});

test("keepers gebruiken alleen opgeslagen relevante cijfers en hetzelfde kaartgrid",()=>{
  const active=match("ajax-example","Ajax","Tegenstander",2,1);
  const keeper={...active.snapshot.players[0],name:"Marc ter Stegen",rating:8.8,passes:42,passAccuracy:91.7,aerialDuelsWon:3,recoveries:7,goals:null,assists:null,xg:null,xa:null};
  const forward={...active.snapshot.players[0],name:"Lange Voorbeeldnaam van een Aanvaller",rating:8.7,goals:1,assists:1,xg:.62,xa:.2};
  const midfielder={...active.snapshot.players[0],name:"Middenvelder",rating:8.3,goals:null,assists:1,xg:.12,xa:.3};
  active.snapshot.players=[keeper,forward,midfielder];
  active.players=[{id:"ter-stegen",name:keeper.name,position:"Doelman",imageUrl:"/players/ter-stegen.png"} as any];
  const html=matchCenterMarkup({matches:[active],active});
  assert.equal((html.match(/class="match-center-player"/g)??[]).length,3);
  assert.match(html,/Passnauwkeurigheid/);
  assert.match(html,/Luchtduels/);
  assert.doesNotMatch(html,/Reddingen|<dd>0<\/dd>/);
  assert.match(html,/Lange Voorbeeldnaam van een Aanvaller/);
});
