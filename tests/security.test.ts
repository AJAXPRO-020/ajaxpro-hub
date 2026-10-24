import assert from "node:assert/strict";
import test from "node:test";
import { safeClubReturnTo } from "../lib/discord-auth";
import { permissions, rolesHavePermission } from "../lib/permissions.config";
import { getSessionWithPermission } from "../lib/server-permissions";

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
    assert.equal(rolesHavePermission([role], permissions.membersAccess), false);
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
