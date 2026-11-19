import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { readFileSync } from "node:fs";
import { permissions } from "../lib/permissions.config";
import {
  PORTAL_MEMBERSHIP_CACHE_SECONDS,
  ROLE_PERMISSION_CACHE_SECONDS,
  DiscordRoleCheckUnavailable,
  authorizeSessionCurrentRoles,
  authorizeSessionPermission,
  clearPermissionCache,
  clearPermissionCacheForUser,
} from "../lib/server-permissions";

const managerRole = "manager-role";
const toolRole = "tool-role";
process.env.MOTM_MANAGER_ROLE_IDS = managerRole;
process.env.PORTAL_TEAM_TOOL_ROLE_IDS = toolRole;

const session = (roles: string[] = [managerRole], issuedAt = 1_000, userId = "user"): Session => ({
  userId,
  username: "Beheerder",
  avatarUrl: "/avatar.png",
  discordRoleIds: roles,
  issuedAt,
  expiresAt: issuedAt + 30 * 24 * 60 * 60,
});

test.beforeEach(() => clearPermissionCache());

test("Discord-rolrefresh gebruikt het Bot-schema en lekt de token niet", () => {
  const source = readFileSync(new URL("../lib/discord-auth.ts", import.meta.url), "utf8");
  assert.match(source, /Authorization: `Bot \$\{botToken\}`/);
  assert.match(source, /requiredEnv\("DISCORD_BOT_TOKEN"\)/);
  assert.doesNotMatch(source, /Authorization: `Bearer \$\{botToken\}`/);
});

test("recente OAuth-snapshot geeft portal-, tool- en beheerrechten zonder extra Discord-call", async () => {
  let calls = 0;
  const fetchRoles = async () => { calls += 1; return [managerRole, toolRole]; };
  const current = session([managerRole, toolRole], 1_000, "recent");
  assert.ok(await authorizeSessionPermission(current, permissions.portalAccess, { nowSeconds: 1_001, fetchRoles }));
  assert.ok(await authorizeSessionPermission(current, permissions.toolsSocials, { nowSeconds: 1_001, fetchRoles }));
  assert.ok(await authorizeSessionPermission(current, permissions.motmManage, { nowSeconds: 1_001, fetchRoles }));
  assert.equal(calls, 0);
});

test("portal-membership wordt na maximaal één uur opnieuw gecontroleerd", async () => {
  let calls = 0;
  const fetchRoles = async () => { calls += 1; return []; };
  const current = session([], 10_000, "portal-refresh");
  assert.ok(await authorizeSessionPermission(current, permissions.portalAccess, { nowSeconds: 10_000 + PORTAL_MEMBERSHIP_CACHE_SECONDS - 1, fetchRoles }));
  assert.equal(calls, 0);
  assert.ok(await authorizeSessionPermission(current, permissions.portalAccess, { nowSeconds: 10_000 + PORTAL_MEMBERSHIP_CACHE_SECONDS, fetchRoles }));
  assert.equal(calls, 1);
});

test("ingetrokken guild-membership weigert portaltoegang na refresh", async () => {
  const fetchRoles = async () => { throw Object.assign(new Error("Unknown Member"), { status: 404 }); };
  assert.equal(await authorizeSessionPermission(session([], 20_000, "removed-member"), permissions.portalAccess, {
    nowSeconds: 20_000 + PORTAL_MEMBERSHIP_CACHE_SECONDS,
    fetchRoles,
  }), null);
});

test("Discord-storing geeft een tijdelijke fout zodra de membership-cache verlopen is", async () => {
  const fetchRoles = async () => { throw new Error("Discord unavailable"); };
  const current = session([], 30_000, "portal-outage");
  assert.ok(await authorizeSessionPermission(current, permissions.portalAccess, { nowSeconds: 30_001, fetchRoles }));
  await assert.rejects(authorizeSessionPermission(current, permissions.portalAccess, {
    nowSeconds: 30_000 + PORTAL_MEMBERSHIP_CACHE_SECONDS,
    fetchRoles,
  }), DiscordRoleCheckUnavailable);
});

test("toolrollen worden na maximaal vijftien minuten opnieuw gecontroleerd", async () => {
  let calls = 0;
  const fetchRoles = async () => { calls += 1; return [toolRole]; };
  const current = session([toolRole], 40_000, "tool-refresh");
  assert.ok(await authorizeSessionPermission(current, permissions.toolsSocials, { nowSeconds: 40_001, fetchRoles }));
  assert.ok(await authorizeSessionPermission(current, permissions.toolsSocials, {
    nowSeconds: 40_000 + ROLE_PERMISSION_CACHE_SECONDS,
    fetchRoles,
  }));
  assert.equal(calls, 1);
});

test("ingetrokken toolrol verdwijnt uit de teruggegeven actuele sessie en weigert toegang", async () => {
  const current = session([toolRole], 50_000, "removed-tool-role");
  assert.equal(await authorizeSessionPermission(current, permissions.toolsSocials, {
    nowSeconds: 50_000 + ROLE_PERMISSION_CACHE_SECONDS,
    fetchRoles: async () => [],
  }), null);
  const portalSession = await authorizeSessionPermission(current, permissions.portalAccess, {
    nowSeconds: 50_000 + ROLE_PERMISSION_CACHE_SECONDS + 1,
    fetchRoles: async () => { throw new Error("should use refreshed cache"); },
  });
  assert.ok(portalSession);
  assert.deepEqual(portalSession.discordRoleIds, []);
});

test("server-rendered navigatie krijgt na vijftien minuten actuele rollen", async () => {
  const current = session([toolRole], 55_000, "navigation-roles");
  const refreshed = await authorizeSessionCurrentRoles(current, {
    nowSeconds: 55_000 + ROLE_PERMISSION_CACHE_SECONDS,
    fetchRoles: async () => [],
  });
  assert.ok(refreshed);
  assert.deepEqual(refreshed.discordRoleIds, []);
});

test("ingetrokken beheerrol weigert beheer maar behoudt guild-membership", async () => {
  const current = session([managerRole], 60_000, "removed-manager-role");
  assert.equal(await authorizeSessionPermission(current, permissions.motmManage, {
    nowSeconds: 60_000 + ROLE_PERMISSION_CACHE_SECONDS,
    fetchRoles: async () => [],
  }), null);
  assert.ok(await authorizeSessionPermission(current, permissions.portalAccess, {
    nowSeconds: 60_000 + ROLE_PERMISSION_CACHE_SECONDS + 1,
  }));
});

test("beheerrechten hebben geen aparte één-uurs expiry meer", async () => {
  const current = session([managerRole], 70_000, "long-manager-session");
  assert.ok(await authorizeSessionPermission(current, permissions.motmManage, {
    nowSeconds: 70_000 + 12 * 60 * 60,
    fetchRoles: async () => [managerRole],
  }));
});

test("lege cache na cold start voert voor een oude sessie veilig een Discord-check uit", async () => {
  let calls = 0;
  clearPermissionCache();
  assert.ok(await authorizeSessionPermission(session([], 80_000, "cold-start"), permissions.portalAccess, {
    nowSeconds: 80_000 + PORTAL_MEMBERSHIP_CACHE_SECONDS,
    fetchRoles: async () => { calls += 1; return []; },
  }));
  assert.equal(calls, 1);
});

test("cache is per gebruiker en kan bij logout gericht worden verwijderd", async () => {
  let calls = 0;
  const current = session([toolRole], 90_000, "logout-user");
  assert.ok(await authorizeSessionPermission(current, permissions.toolsSocials, { nowSeconds: 90_001 }));
  clearPermissionCacheForUser(current.userId);
  assert.ok(await authorizeSessionPermission(current, permissions.toolsSocials, {
    nowSeconds: 90_000 + ROLE_PERMISSION_CACHE_SECONDS,
    fetchRoles: async () => { calls += 1; return [toolRole]; },
  }));
  assert.equal(calls, 1);
});

test("ongeldige issuedAt kan nooit permissions verlenen", async () => {
  assert.equal(await authorizeSessionPermission({ ...session([], 1_000, "nan"), issuedAt: Number.NaN }, permissions.portalAccess, { nowSeconds: 1_001 }), null);
  assert.equal(await authorizeSessionPermission({ ...session([], 1_000, "future"), issuedAt: 2_000 }, permissions.portalAccess, { nowSeconds: 1_001 }), null);
});
