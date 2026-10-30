import assert from "node:assert/strict";
import test from "node:test";
import { createSessionCookie, safeClubReturnTo } from "../lib/discord-auth";
import { permissions, rolesHavePermission } from "../lib/permissions.config";
import { getSessionWithPermission } from "../lib/server-permissions";
import { GET as getContracts } from "../api/contracts";
import { GET as getMembers } from "../api/members";
import { GET as getJeugddossiers } from "../api-impl/jeugddossiers";

test("OAuth returnTo accepteert alleen interne Club-paden", () => {
  assert.equal(safeClubReturnTo("/club/stemmen/ajax-psv"), "/club/stemmen/ajax-psv");
  for (const unsafe of ["https://evil.test/club/", "//evil.test/club", "/api/club", "/club\\evil.test", null]) {
    assert.equal(safeClubReturnTo(unsafe), "/club");
  }
});

test("motm.manage komt alleen uit de geconfigureerde rol-ID's", () => {
  process.env.MOTM_MANAGER_ROLE_IDS = "111, 222";
  assert.equal(rolesHavePermission(["222"], permissions.motmManage), true);
  assert.equal(rolesHavePermission(["Admin", "unknown", "22"], permissions.motmManage), false);
});

test("motm.delete komt uitsluitend uit de aparte Owner/Admin mapping",()=>{
  process.env.MOTM_DELETE_ROLE_IDS="1268471493046566987,1268471493046566986";
  assert.equal(rolesHavePermission(["1268471493046566986"],permissions.motmDelete),true);
  assert.equal(rolesHavePermission(["1271472085788786718"],permissions.motmDelete),false);
});

test("teamtoolrechten komen alleen uit de centrale environmentmapping",()=>{
  process.env.PORTAL_TEAM_TOOL_ROLE_IDS="333, 444";
  assert.equal(rolesHavePermission(["333"],permissions.toolsTactics),true);
  assert.equal(rolesHavePermission(["444"],permissions.toolsScreenshot),true);
  assert.equal(rolesHavePermission(["333"],permissions.toolsSocials),true);
  assert.equal(rolesHavePermission(["333"],permissions.motmDelete),false);
  assert.equal(rolesHavePermission(["222"],permissions.toolsTactics),false);
  assert.equal(rolesHavePermission(["222"],permissions.toolsSocials),false);
});

test("onbekende rollen krijgen geen andere aanvullende rechten", () => {
  assert.equal(rolesHavePermission(["unknown"], permissions.adminManage), false);
});

test("Members en Staff blijven gescheiden van specifieke beheerrechten", () => {
  process.env.PORTAL_MEMBERS_ROLE_IDS = "supporter,booster";
  process.env.PORTAL_STAFF_ROLE_IDS = "socials";
  process.env.PORTAL_TEAM_TOOL_ROLE_IDS = "dossier-manager";
  for (const role of ["supporter", "booster"]) {
    assert.equal(rolesHavePermission([role], permissions.membersAccess), true);
    assert.equal(rolesHavePermission([role], permissions.staffAccess), false);
    assert.equal(rolesHavePermission([role], permissions.jeugddossiersManage), false);
  }
  for (const role of ["socials", "1268471493034246376", "1268471493046566986"]) {
    assert.equal(rolesHavePermission([role], permissions.staffAccess), true);
    assert.equal(rolesHavePermission([role], permissions.membersAccess), true);
    assert.equal(rolesHavePermission([role], permissions.jeugddossiersManage), false);
  }
  assert.equal(rolesHavePermission(["dossier-manager"], permissions.jeugddossiersManage), true);
  assert.equal(rolesHavePermission(["dossier-manager"], permissions.membersAccess), false);
  assert.equal(rolesHavePermission(["ordinary"], permissions.membersAccess), false);
  assert.equal(rolesHavePermission(["ordinary"], permissions.staffAccess), false);
});

test("direct MOTM-beheer openen zonder geldige sessie blijft geweigerd",async()=>{
  assert.equal(await getSessionWithPermission(new Request("https://ajaxpro.fans/club/motm/beheer"),permissions.motmManage),null);
});

test("contractroute behoudt de sessie bij ontbrekend Members-recht", async () => {
  process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters-long";
  process.env.DISCORD_REDIRECT_URI = "https://ajaxpro.example/api/auth/discord-callback";
  process.env.PORTAL_MEMBERS_ROLE_IDS = "supporter,booster";
  process.env.PORTAL_STAFF_ROLE_IDS = "socials";
  let userId = 123456789;
  const requestFor = async (roles: string[]) => {
    const user = { id: String(userId++), username: "ajaxpro", global_name: "AjaxPro Lid", avatar: null };
    const cookie = await createSessionCookie(user, { roles });
    return new Request("https://ajaxpro.fans/club/members/contracten", { headers: { cookie: cookie.split(";", 1)[0] } });
  };
  const ordinary = await getContracts(await requestFor(["ordinary"]));
  assert.equal(ordinary.status, 403);
  assert.equal(ordinary.headers.get("location"), null);
  assert.equal(ordinary.headers.get("set-cookie"), null);
  for (const role of ["supporter", "booster", "socials", "1268471493034246376", "1268471493046566986"]) {
    const response = await getContracts(await requestFor([role]));
    assert.equal(response.status, 200, role);
  }
});

test("Members toont gewone leden alleen een veilige preview en behoudt hun sessie", async () => {
  process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters-long";
  process.env.DISCORD_REDIRECT_URI = "https://ajaxpro.example/api/auth/discord-callback";
  process.env.PORTAL_MEMBERS_ROLE_IDS = "supporter,booster";
  process.env.PORTAL_STAFF_ROLE_IDS = "socials";
  let userId = 223456789;
  const requestFor = async (path: string, roles: string[]) => {
    const user = { id: String(userId++), username: "ajaxpro", global_name: "AjaxPro Lid", avatar: null };
    const cookie = await createSessionCookie(user, { roles });
    return new Request(`https://ajaxpro.fans${path}`, { headers: { cookie: cookie.split(";", 1)[0] } });
  };
  const preview = await getMembers(await requestFor("/club/members", ["ordinary"]));
  const previewHtml = await preview.text();
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("location"), null);
  assert.equal(preview.headers.get("set-cookie"), null);
  assert.match(previewHtml, /class="members-preview"/);
  assert.match(previewHtml, /class="members-preview__veil">[\s\S]*class="members-preview__content" aria-hidden="true">[\s\S]*class="members-preview__message support-strip"/);
  assert.match(previewHtml, /class="members-preview__message support-strip"/);
  assert.match(previewHtml, /Wil je AjaxPro steunen\? Dat kan via Petje Af, maandelijks of per jaar\./);
  assert.match(previewHtml, /AjaxPro Supporters en Discord Server Boosters krijgen toegang tot Members\./);
  assert.match(previewHtml, /href="https:\/\/buymeacoffee\.com\/ajaxpro"[^>]*>Petje Af <span aria-hidden="true">↗<\/span><\/a>/);
  assert.doesNotMatch(previewHtml, /href="\/club\/members\/contracten"|href="\/club\/jeugddossiers"|<iframe|AjaxPro Members|DnMUfAFrWDQ|i\.ytimg\.com|members-video\.js/);
  for (const [path, get] of [["/club/members/contracten", getContracts], ["/club/jeugddossiers", getJeugddossiers], ["/api/members?view=match-center", getMembers]] as const) {
    const denied = await get(await requestFor(path, ["ordinary"]));
    assert.equal(denied.status, 403, path);
    assert.equal(denied.headers.get("location"), null);
    assert.equal(denied.headers.get("set-cookie"), null);
  }
  for (const role of ["supporter", "booster", "socials", "1268471493034246376", "1268471493046566986"]) {
    const allowed = await getMembers(await requestFor("/club/members", [role]));
    const html = await allowed.text();
    assert.equal(allowed.status, 200, role);
    assert.match(html, /href="\/club\/members\/contracten"/);
    assert.match(html, /href="\/club\/jeugddossiers"/);
    assert.match(html, /href="\/club\/members\/match-center"/);
    assert.match(html, /AjaxPro Videoarchief/);
    assert.match(html, /data-video-archive/);
    assert.equal((html.match(/data-video-card/g) ?? []).length, 62);
    assert.match(html, /src="\/members-video\.js"/);
    assert.match(allowed.headers.get("content-security-policy") ?? "", /frame-src https:\/\/www\.youtube-nocookie\.com/);
    assert.doesNotMatch(html, /class="members-preview"/);
  }
});
