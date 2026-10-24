import assert from "node:assert/strict";
import test from "node:test";
import { errorPage, matchHeading, matchTitle, page } from "../lib/motm-view";

const roles={analyst:"1422264769863221319"};
process.env.PORTAL_TEAM_TOOL_ROLE_IDS=roles.analyst;
process.env.PORTAL_STAFF_ROLE_IDS=roles.analyst;
const member={username:"Ajacied",avatarUrl:"https://cdn.discordapp.com/avatar.png",discordRoleIds:[]};
const analyst={...member,discordRoleIds:[roles.analyst]};

test("een gewoon lid ziet MOTM en vergrendelde Members maar geen Staff",async()=>{
  const html=await page("Stemmen","<main>Inhoud</main>","",member,"motm").text();
  assert.match(html,/portal-brand" href="\/club\/stand"/);
  assert.match(html,/href="\/club\/stand" class="active" aria-current="page"/);
  assert.match(html,/href="\/club\/stand" class="active" aria-current="page">MOTM<\/a>/);
  assert.match(html,/>Members 🔒<\/a>/);
  assert.match(html,/aria-label="MOTM-navigatie"[\s\S]*href="\/club\/stand"/);
  assert.doesNotMatch(html,/>Staff<\/a>/);
  assert.match(html,/Ajacied/);
  assert.match(html,/action="\/api\/auth\/logout"/);
});

test("de Club-shell toont Staff voor de geconfigureerde staffrol",async()=>{
  const html=await page("Tools","<main>Inhoud</main>","",analyst,"tools").text();
  assert.match(html,/>Staff<\/a>/);
  assert.equal((html.match(/>Members 🔒<\/a>/g)??[]).length,2);
  assert.match(html,/href="\/club\/tools"/);
  assert.doesNotMatch(html,/>Analistentools<\/a>|>Teamtools<\/a>/);
  assert.equal((html.match(/class="mobile-menu"/g)??[]).length,1);
  assert.equal((html.match(/class="desktop-nav"/g)??[]).length,1);
});

test("thuis- en uitwedstrijden gebruiken overal dezelfde centrale volgorde",()=>{
  const home={opponent:"PSV",home_or_away:"home" as const,status:"open"};
  const away={opponent:"Feyenoord",home_or_away:"away" as const,status:"open"};
  assert.equal(matchTitle(home),"Ajax — PSV");
  assert.equal(matchTitle(away),"Feyenoord — Ajax");
  for(const status of ["open","draft","closed"] as const)assert.equal(matchTitle({...away,status}),"Feyenoord — Ajax");
  assert.match(matchHeading({...away,competition:"Eredivisie",kickoff_at:"2026-08-02T12:00:00Z",home_score:null}),/Feyenoord — Ajax/);
});

test("een toegangsweigering blijft binnen de MOTM-context",async()=>{
  const html=await errorPage("Geen toegang","Geen Tools.",403,member,"/club","home").text();
  assert.match(html,/href="\/club\/stand"/);
  assert.doesNotMatch(html,/href="\/club\/stand" class="active"/);
});

test("Club- en MOTM-pagina's laden stylesheetversie 36 en het mobiele menuscript",async()=>{
  const html=await page("Club","<main>Inhoud</main>","",member,"home").text();
  assert.match(html,/\/motm\.css\?v=36/);
  assert.match(html,/\/portal-nav\.js/);
});

test("de gedeelde Club-shell kan een afgeschermde tool een eigen stylesheet geven",async()=>{
  const html=await page("Socials","<main>Socials</main>","",analyst,"tools",undefined,{stylesheets:["/socials.css"]}).text();
  assert.match(html,/href="\/socials\.css"/);
  assert.match(html,/>Staff<\/a>/);
});

test("een tool kan blob-afbeeldingen toestaan zonder MOTM-pagina's te verruimen",async()=>{
  const socials=page("Socials","<main>Socials</main>","",analyst,"tools",undefined,{imageSources:["blob:"]});
  const motm=page("MOTM","<main>MOTM</main>","",analyst,"motm");
  assert.match(socials.headers.get("content-security-policy")??"",/img-src 'self' https:\/\/cdn\.discordapp\.com blob:/);
  assert.doesNotMatch(motm.headers.get("content-security-policy")??"",/img-src[^;]*blob:/);
});

test("de generieke loginlink laat Club eerst een bestaande sessie controleren",async()=>{
  const html=await page("Club","<main>Inhoud</main>").text();
  assert.match(html,/class="profile-login" href="https:\/\/ajaxpro\.fans\/club">Inloggen<\/a>/);
  assert.doesNotMatch(html,/class="profile-login" href="\/api\/auth\/discord-login"/);
});
