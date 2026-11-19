import assert from "node:assert/strict";
import test from "node:test";
import { createSessionCookie } from "../lib/discord-auth";
import { GET } from "../api/navigation-status";
import { clearPermissionCache } from "../lib/server-permissions";

process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters-long";
process.env.DISCORD_REDIRECT_URI = "https://ajaxpro.example/api/auth/discord-callback";
process.env.PORTAL_MEMBERS_ROLE_IDS = "booster-role";
process.env.PORTAL_STAFF_ROLE_IDS = "staff-role";

const user = { id: "123456789", username: "Ajacied", global_name: "Ajacied", avatar: null };
const cookie = async (roles: string[]) => (await createSessionCookie(user, { roles })).split(";", 1)[0];

test("publieke navigatiestatus geeft veilig uitgelogd terug zonder sessie", async () => {
  const response = await GET(new Request("https://ajaxpro.example/api/navigation-status"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test("navigatiestatus gebruikt bestaande Members- en Staff-permissions", async () => {
  clearPermissionCache();
  const response = await GET(new Request("https://ajaxpro.example/api/navigation-status", { headers: { cookie: await cookie(["booster-role", "staff-role"]) } }));
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.equal(status.authenticated, true);
  assert.equal(status.username, "Ajacied");
  assert.match(status.avatarUrl, /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/);
  assert.equal(status.membersAccess, true);
  assert.equal(status.staffAccess, true);
});

test("een normaal Discord-lid krijgt alleen de basisnavigatie met Members-slotje", async () => {
  clearPermissionCache();
  const response = await GET(new Request("https://ajaxpro.example/api/navigation-status", { headers: { cookie: await cookie(["member-role"]) } }));
  assert.deepEqual((await response.json()).membersAccess, false);
  assert.deepEqual((await GET(new Request("https://ajaxpro.example/api/navigation-status", { headers: { cookie: await cookie(["member-role"]) } }))).status, 200);
});
