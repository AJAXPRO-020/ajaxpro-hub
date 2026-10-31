import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { adminToolsForSession, clubIntroForSession, renderToolsGrid, teamToolsForSession, toolsForSession } from "../lib/portal-tools.config";

const roles={owner:"1268471493046566987",admin:"1268471493046566986",moderator:"1268471493034246376",helper:"1271472085788786718",analyst:"1422264769863221319"};
process.env.PORTAL_TEAM_TOOL_ROLE_IDS=Object.values(roles).join(",");
process.env.MOTM_MANAGER_ROLE_IDS=[roles.owner,roles.admin,roles.moderator,roles.helper].join(",");
process.env.MOTM_DELETE_ROLE_IDS=[roles.owner,roles.admin].join(",");
const session=(discordRoleIds:string[],userId="1"):Session=>({userId,username:"Test",avatarUrl:"/avatar.png",discordRoleIds,issuedAt:1,expiresAt:2});
const ids=(roleIds:string[])=>toolsForSession(session(roleIds)).map(tool=>tool.id);

test("gewoon lid ziet geen tools of beheer",()=>assert.deepEqual(ids([]),[]));
test("analist ziet alle teamtools en Jeugddossiers-beheer",()=>assert.deepEqual(ids([roles.analyst]),["tactics","screenshot","socials","jeugddossiers-admin"]));
test("helper ziet teamtools en beheer",()=>assert.deepEqual(new Set(ids([roles.helper])),new Set(["tactics","screenshot","socials","motm-admin","jeugddossiers-admin"])));
test("moderator ziet teamtools en beheer",()=>assert.deepEqual(new Set(ids([roles.moderator])),new Set(["tactics","screenshot","socials","system-status","motm-admin","jeugddossiers-admin"])));
test("Discord Admin-rol ziet de bestaande tools en beheer",()=>assert.deepEqual(new Set(ids([roles.admin])),new Set(["tactics","screenshot","socials","system-status","motm-admin","jeugddossiers-admin"])));
test("meerdere rollen leveren gecombineerde rechten op",()=>assert.deepEqual(new Set(ids([roles.analyst,roles.helper])),new Set(["tactics","screenshot","socials","motm-admin","jeugddossiers-admin"])));
test("lege Tools-grid bevat geen kaarten",()=>assert.doesNotMatch(renderToolsGrid(toolsForSession(session([]))),/tool-card--/));
test("publieke tools komen niet voor in Club-config of HTML",()=>{const html=renderToolsGrid(toolsForSession(session([roles.owner])));for(const title of ["Opstellingmaker","Contractenoverzicht","Bingo"])assert.doesNotMatch(html,new RegExp(title))});
test("sectiehelpers houden Analistentools en Beheer contextueel gescheiden",()=>{const owner=session([roles.owner]);assert.deepEqual(teamToolsForSession(owner).map(tool=>tool.id),["tactics","screenshot","socials"]);assert.deepEqual(adminToolsForSession(owner).map(tool=>tool.id),["motm-admin","jeugddossiers-admin"])});
test("Club-intro past zich aan gewone leden, analisten en beheerders aan",()=>{
  assert.equal(clubIntroForSession(session([])),"Stem op de Man of the Match en bekijk de uitslagen.");
  assert.equal(clubIntroForSession(session([roles.analyst])),"Stem mee en open je AjaxPro-tools.");
  assert.equal(clubIntroForSession(session([roles.owner])),"Stem mee, open je AjaxPro-tools en beheer de Man of the Match.");
});
test("Tools-grid heeft één structuur zonder rolsecties",()=>{const html=renderToolsGrid(toolsForSession(session([roles.owner])));assert.match(html,/Tactiekbord/);assert.match(html,/Screenshot Editor/);assert.match(html,/href="\/club\/tools\/socials"/);assert.match(html,/MOTM-stemmingen beheren/);assert.match(html,/Jeugddossiers beheren/);assert.doesNotMatch(html,/Analistentools|Beheer<\/h2>|Voor analisten|Voor staf/)});
