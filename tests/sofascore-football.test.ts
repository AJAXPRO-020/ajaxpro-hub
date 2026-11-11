import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { importSofaScoreMatch } from "../lib/sofascore-football";

const fixture={fixture_key:"twente-ajax",home_team:"FC Twente",away_team:"Ajax",competition:"Eredivisie",kickoff_at:"2026-11-08T13:30:00.000Z",provider_status:"FT",goals_home:2,goals_away:2,finished_at:"2026-11-08T15:30:00.000Z"} as const;
const event={id:16316872,customId:"djbsfjb",startTimestamp:1794144600,status:{type:"finished"},homeTeam:{id:2955,name:"FC Twente"},awayTeam:{id:2953,name:"AFC Ajax"},homeScore:{current:2},awayScore:{current:2}};
const player=(name:string,id:number,teamId:number,stats:Record<string,number>)=>({player:{id,name},teamId,statistics:stats});

test("SofaScore normaliseert wedstrijd, formaties en rijke spelersstatistieken",async()=>{
  const responses:Record<string,unknown>={
    "/sport/football/scheduled-events/2026-11-08":{events:[event]},
    "/event/16316872/lineups":{confirmed:true,home:{formation:"4-2-3-1",players:[]},away:{formation:"4-3-3",players:[player("Oscar Gloukh",1155158,2953,{minutesPlayed:87,expectedAssists:.469138,keyPass:4,progressiveBallCarriesCount:9,rating:8.8})]}},
    "/event/16316872/statistics":{statistics:[{period:"ALL",groups:[{statisticsItems:[{name:"Ball possession",home:"56%",away:"44%"}]}]}]},
    "/event/16316872/incidents":{incidents:[{incidentType:"goal",time:66,player:{id:1403090,name:"Rayane Bounida"},xg:.03}]},
  };
  const urls:string[]=[];
  const result=await importSofaScoreMatch(fixture,{now:()=>new Date("2026-11-11T12:00:00Z"),fetcher:async input=>{const path=new URL(String(input)).pathname.replace("/api/v1","");urls.push(path);return new Response(JSON.stringify(responses[path]),{status:200,headers:{"Content-Type":"application/json"}})}});
  assert.equal(result.provider,"sofascore");
  assert.equal(result.providerMatchId,16316872);
  assert.equal(result.match.awayTeam,"AFC Ajax");
  assert.equal(result.lineups.awayFormation,"4-3-3");
  assert.deepEqual(result.players[0],{providerPlayerId:1155158,teamId:2953,name:"Oscar Gloukh",minutes:87,goals:null,assists:null,xg:null,xa:.469138,keyPasses:4,totalPasses:null,accuratePasses:null,tackles:null,interceptions:null,recoveries:null,duelsWon:null,shots:null,shotsOnTarget:null,progressiveBallCarries:9,progressiveBallCarryDistance:null,rating:8.8});
  assert.equal(result.incidents.length,1);
  assert.deepEqual(urls.sort(),["/sport/football/scheduled-events/2026-11-08","/event/16316872/lineups","/event/16316872/statistics","/event/16316872/incidents"].sort());
});

test("SofaScore-migratie breidt de bestaande JSONB-snapshot additief uit",()=>{
  const migration=readFileSync(new URL("../db/migrations/037_sofascore_provider_snapshots.sql",import.meta.url),"utf8");
  assert.match(migration,/ALTER TABLE socials_match_stats_snapshots/);
  assert.match(migration,/provider_snapshots JSONB NOT NULL/);
  assert.match(migration,/DEFAULT '\{\}'::jsonb/);
});
