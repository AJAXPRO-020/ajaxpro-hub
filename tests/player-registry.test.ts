import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { GET } from "../api/motm-public";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("centrale spelersregistratie voedt MOTM, Socials, contracten en lineup maker",()=>{
  const migration=read("../db/migrations/012_player_registry.sql");
  const motm=read("../api-impl/motm/manage.ts");
  const socials=read("../api-impl/socials/index.ts");
  const contracts=read("../contracten-ui.js");
  const lineup=read("../../opstelling-maker/script.js");
  assert.match(migration,/CREATE TABLE IF NOT EXISTS ajax_players/);
  assert.match(motm,/activePlayersFromDatabase/);
  assert.match(socials,/loadPlayers/);
  assert.match(contracts,/\/api\/players\?include=contracts/);
  assert.match(contracts,/!player\.active&&player\.loanClub/);
  assert.match(lineup,/https:\/\/ajaxpro\.fans\/api\/players/);
  assert.match(lineup,/const photo=current\.photo\|\|centralPhoto/);
});

test("huurafspraken zijn centraal opgeslagen en transparant gelabeld",()=>{
  const migration=read("../db/migrations/017_add_loan_deal_details.sql");
  const registry=read("../lib/player-registry.ts");
  const contracts=read("../contracten-ui.js");
  const contractsHtml=read("../lib/contracts-content.ts");
  assert.match(migration,/ADD COLUMN IF NOT EXISTS loan_deal JSONB/);
  assert.match(migration,/"status": "reported"/);
  assert.match(registry,/loanDeal:mapLoanDeal\(row\.loan_deal\)/);
  assert.match(contracts,/Huurconstructie/);
  assert.match(contracts,/Niet bevestigd/);
  assert.match(contracts,/contract-card__facts/);
  assert.match(contractsHtml,/loan-deal__status--confirmed/);
  assert.match(contractsHtml,/loan-deal__status--reported/);
  assert.doesNotMatch(contractsHtml,/Nog in te vullen/);
  assert.match(contractsHtml,/Tijdelijk elders<\/dt><dd>8 spelers/);
  assert.match(read("../api/contracts.ts"),/permissions\.membersAccess/);
  assert.match(read("../api/contracts.ts"),/contracten-ui\.js/);
});

test("deadline day-mutaties worden via de centrale spelersregistratie uitgerold",()=>{
  const migration=read("../db/migrations/027_transfer_deadline_selection_update.sql");
  assert.match(migration,/'kehrer', 'Thilo Kehrer'/);
  assert.match(migration,/'adingra', 'Simon Adingra'/);
  assert.match(migration,/loan_club = 'Werder Bremen'/);
  assert.match(migration,/loan_club = 'FC Kopenhagen'/);
  assert.match(migration,/loan_club = 'De Graafschap'/);
  assert.match(migration,/loan_club = 'Lommel SK'/);
  assert.match(migration,/WHERE id = 'van-de-pavert'/);
  assert.match(migration,/contract_end = '2029-06-30' WHERE id = 'dies-janse'/);
});

test("herkomst en transferconstructie staan centraal en blijven transparant",()=>{
  const migration=read("../db/migrations/028_add_arrival_deal_details.sql");
  const registry=read("../lib/player-registry.ts");
  const contracts=read("../contracten-ui.js");
  const css=read("../contracten.css");
  assert.match(migration,/ADD COLUMN IF NOT EXISTS arrival_deal JSONB/);
  assert.match(migration,/Barcelona behoudt volgens de berichtgeving 50%/);
  assert.match(migration,/"status"\s*:\s*"partly_reported"/);
  assert.match(registry,/arrivalDeal:mapArrivalDeal\(row\.arrival_deal\)/);
  assert.match(contracts,/Herkomst & transferdeal/);
  assert.match(contracts,/Deels gemeld/);
  assert.match(contracts,/const dealPanel=loan\?loanDealPanel/);
  assert.match(css,/contract-card--incoming::before/);
});

test("registry behoudt Ouazane en valt terug als optionele kolommen ontbreken",()=>{
  const guard=read("../db/migrations/030_protect_always_retained_players.sql");
  const registry=read("../lib/player-registry.ts");
  assert.match(guard,/OLD\.id = 'ouazane'/);
  assert.match(guard,/BEFORE DELETE ON ajax_players/);
  assert.match(registry,/ALWAYS_RETAINED_PLAYER_IDS = \["ouazane"\]/);
  assert.match(registry,/code!=="42703"/);
  assert.match(registry,/const fallbackQuery/);
  assert.match(registry,/console\.warn\("Player registry optional schema missing; using fallback query"/);
  assert.match(registry,/return \(await query\(\)\)\.map\(mapPlayer\)/);
  assert.match(registry,/impact:"\/api\/players blijft beschikbaar/);
});

test("spelersendpoint blijft onderdeel van de bestaande MOTM-serverless functie",()=>{
  const config=JSON.parse(read("../vercel.json"));
  const route=config.rewrites.find((rewrite:any)=>rewrite.source==="/api/players");
  assert.equal(route.destination,"/api/motm-public?action=players");
  assert.equal(existsSync(new URL("../api/players.ts",import.meta.url)),false);
});

test("historische MOTM-wedstrijden blijven snapshots gebruiken",()=>{
  const schema=read("../db/migrations/001_motm.sql");
  assert.match(schema,/name_snapshot TEXT NOT NULL/);
  assert.match(schema,/image_url_snapshot TEXT NOT NULL/);
});

test("publieke spelersendpoint levert alleen actieve spelers en beperkte CORS",async()=>{
  const response=await GET(new Request("https://ajaxpro.fans/api/motm-public?action=players",{headers:{Origin:"https://opstelling.ajaxpro.fans"}}));
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),"https://opstelling.ajaxpro.fans");
  assert.equal(response.headers.get("Vary"),"Origin");
  assert.equal(payload.players.length,28);
  assert.equal(payload.players.some((player:any)=>player.id==="bissouma"),true);
  assert.equal(payload.players.some((player:any)=>player.id==="amrabat"),true);
  assert.equal(payload.players.some((player:any)=>player.id==="tsygankov"),true);
  assert.equal(payload.players.some((player:any)=>player.id==="kehrer"),true);
  assert.equal(payload.players.some((player:any)=>player.id==="adingra"),true);
  assert.equal(payload.players.some((player:any)=>player.id==="godts"),false);
  assert.equal(payload.players.some((player:any)=>player.id==="dies-janse"),true);
  assert.equal(payload.players.some((player:any)=>player.id==="ouazane"),true);
  assert.equal(payload.players.some((player:any)=>player.id==="jofre-torrents"),true);
  assert.equal(payload.players.some((player:any)=>player.id==="konadu"),false);
  assert.equal(payload.players.some((player:any)=>player.id==="sutalo"),false);
  assert.equal(payload.players.some((player:any)=>player.id==="itakura"),false);
  assert.equal(payload.players.some((player:any)=>player.id==="regeer"),false);
  assert.equal(payload.players.some((player:any)=>player.id==="carrizo"),false);
  assert.ok(payload.players.every((player:any)=>!Object.keys(player).some((key)=>/^(contract|loan|arrival)/i.test(key))));
  const denied=await GET(new Request("https://ajaxpro.fans/api/motm-public?action=players",{headers:{Origin:"https://example.com"}}));
  assert.equal(denied.headers.has("Access-Control-Allow-Origin"),false);
  assert.equal(denied.headers.get("Vary"),"Origin");
});
