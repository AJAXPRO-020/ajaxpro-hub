import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  SESSION_MAX_AGE_SECONDS,
  clearSessionCookie,
  createSessionCookie,
  readSession,
} from "../lib/discord-auth";
import { GET as startDiscordLogin } from "../api/auth/discord-login";
import { GET as clubPortal } from "../api/club-portal";
import { GET as home } from "../api/home";
import { GET as sessionStatus } from "../api/auth/session-status";

process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters-long";
process.env.DISCORD_REDIRECT_URI = "https://ajaxpro.example/api/auth/discord-callback";

const user = { id: "123456789", username: "ajaxpro", global_name: "AjaxPro Lid", avatar: null };
const member = { roles: ["member-role"] };
const cookieValue = (setCookie: string) => setCookie.split(";", 1)[0];

test("publieke Inloggen-knop opent Club en niet direct Discord OAuth", () => {
  const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(home, /class="header-login" href="https:\/\/ajaxpro\.fans\/club">Naar de Club<\/a>/);
  assert.match(home, /data-public-nav-links/);
  assert.match(readFileSync(new URL("../script.js", import.meta.url), "utf8"), /api\/auth\/session-status\?view=navigation/);
});

test("homepage toont Naar de Club bij een geldige sessie", async () => {
  const cookie = cookieValue(await createSessionCookie(user, member));
  const response = await home(new Request("https://ajaxpro.example/", { headers: { cookie } }));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /class="header-login" href="https:\/\/ajaxpro\.fans\/club">Naar de Club<\/a>/);
  assert.doesNotMatch(html, /class="header-login" href="https:\/\/ajaxpro\.fans\/club">Inloggen<\/a>/);
});

test("homepage toont Inloggen zonder geldige sessie", async () => {
  const response = await home(new Request("https://ajaxpro.example/"));
  const html = await response.text();
  assert.match(html, /class="header-login" href="https:\/\/ajaxpro\.fans\/club">Inloggen<\/a>/);
});

test("homepage-status endpoint hergebruikt dezelfde sessiecookie", async () => {
  const cookie = cookieValue(await createSessionCookie(user, member));
  const authenticated = await sessionStatus(new Request("https://ajaxpro.example/api/auth/session-status", { headers: { cookie } }));
  const anonymous = await sessionStatus(new Request("https://ajaxpro.example/api/auth/session-status"));
  assert.deepEqual(await authenticated.json(), { authenticated: true });
  assert.deepEqual(await anonymous.json(), { authenticated: false });
});

test("rechtstreeks Club openen hergebruikt een geldige sessie", async () => {
  const existingCookie = cookieValue(await createSessionCookie(user, member));
  const response = await clubPortal(new Request("https://ajaxpro.example/club", { headers: { cookie: existingCookie } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Location"), null);
  assert.equal(response.headers.get("Set-Cookie"), null);
});

test("rechtstreeks Club openen met een verlopen sessie verwijst naar Discord-login", async () => {
  const originalNow = Date.now;
  const loginTime = 2_200_000_000_000;
  try {
    Date.now = () => loginTime;
    const existingCookie = cookieValue(await createSessionCookie(user, member));
    Date.now = () => loginTime + SESSION_MAX_AGE_SECONDS * 1000;
    const response = await clubPortal(new Request("https://ajaxpro.example/club", { headers: { cookie: existingCookie } }));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "/api/auth/discord-login");
  } finally {
    Date.now = originalNow;
  }
});

test("Discord-login maakt een persistente sessiecookie voor dertig dagen", async () => {
  const before = Math.floor(Date.now() / 1000);
  const setCookie = await createSessionCookie(user, member);
  const request = new Request("https://ajaxpro.example/club", { headers: { cookie: cookieValue(setCookie) } });
  const session = await readSession(request);
  assert.ok(session);
  assert.equal(SESSION_MAX_AGE_SECONDS, 30 * 24 * 60 * 60);
  assert.match(setCookie, /Max-Age=2592000/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Secure/);
  assert.ok(session.issuedAt >= before);
  assert.equal(session.expiresAt - session.issuedAt, SESSION_MAX_AGE_SECONDS);
  assert.equal(session.userId, user.id);
});

test("dezelfde sessiecookie werkt bij een nieuwe request zonder OAuth", async () => {
  const setCookie = await createSessionCookie(user, member);
  const reopenedRequest = new Request("https://ajaxpro.example/club", { headers: { cookie: cookieValue(setCookie) } });
  assert.ok(await readSession(reopenedRequest));
});

test("een nieuwe OAuth-poging wist een nog geldige sessie niet", async () => {
  process.env.DISCORD_CLIENT_ID = "test-client-id";
  const existingCookie = cookieValue(await createSessionCookie(user, member));
  const response = await startDiscordLogin(new Request("https://ajaxpro.example/api/auth/discord-login", {
    headers: { cookie: existingCookie },
  }));
  assert.equal(response.status, 302);
  assert.match(response.headers.get("Location") ?? "", /^https:\/\/discord\.com\/oauth2\/authorize\?/);
  assert.doesNotMatch(response.headers.get("Set-Cookie") ?? "", /ajaxpro_session=/);
  assert.ok(await readSession(new Request("https://ajaxpro.example/club", { headers: { cookie: existingCookie } })));
});

test("login vanaf een andere host controleert eerst de sessie op de canonieke host", async () => {
  const response = await startDiscordLogin(new Request("https://www.ajaxpro.example/api/auth/discord-login?returnTo=%2Fclub%2Fmembers"));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "https://ajaxpro.example/club/members");
  assert.equal(response.headers.get("Set-Cookie"), null);
});

test("tijdelijke Discord-storing dwingt op Club geen nieuwe OAuth-login af", async () => {
  const originalNow = Date.now;
  const originalFetch = globalThis.fetch;
  process.env.DISCORD_BOT_TOKEN = "test-bot-token";
  process.env.DISCORD_GUILD_ID = "test-guild";
  const loginTime = 2_000_000_000_000;
  try {
    Date.now = () => loginTime;
    const existingCookie = cookieValue(await createSessionCookie(user, member));
    Date.now = () => loginTime + 16 * 60 * 1000;
    globalThis.fetch = async () => { throw new Error("Discord unavailable"); };
    const response = await clubPortal(new Request("https://ajaxpro.example/club", { headers: { cookie: existingCookie } }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Location"), null);
    assert.equal(response.headers.get("Set-Cookie"), null);
    assert.ok(await readSession(new Request("https://ajaxpro.example/club", { headers: { cookie: existingCookie } })));
    const { GET: staffTools } = await import("../api/club-tools");
    const staffResponse = await staffTools(new Request("https://ajaxpro.example/club/tools", { headers: { cookie: existingCookie } }));
    assert.equal(staffResponse.status, 503);
    assert.equal(staffResponse.headers.get("Location"), null);
    assert.equal(staffResponse.headers.get("Set-Cookie"), null);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("ingetrokken Discord-lidmaatschap geeft geen Club-toegang", async () => {
  const originalNow = Date.now;
  const originalFetch = globalThis.fetch;
  process.env.DISCORD_BOT_TOKEN = "test-bot-token";
  process.env.DISCORD_GUILD_ID = "test-guild";
  const loginTime = 2_100_000_000_000;
  try {
    Date.now = () => loginTime;
    const existingCookie = cookieValue(await createSessionCookie(user, member));
    Date.now = () => loginTime + 16 * 60 * 1000;
    globalThis.fetch = async () => new Response(null, { status: 404 });
    const response = await clubPortal(new Request("https://ajaxpro.example/club", { headers: { cookie: existingCookie } }));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "/api/auth/discord-login");
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("een volledig verlopen dertigdaagse sessie wordt geweigerd", async () => {
  const originalNow = Date.now;
  const loginTime = 2_000_000_000_000;
  try {
    Date.now = () => loginTime;
    const setCookie = await createSessionCookie(user, member);
    Date.now = () => loginTime + SESSION_MAX_AGE_SECONDS * 1000;
    const expiredRequest = new Request("https://ajaxpro.example/club", { headers: { cookie: cookieValue(setCookie) } });
    assert.equal(await readSession(expiredRequest), null);
  } finally {
    Date.now = originalNow;
  }
});

test("een gemanipuleerde sessiecookie wordt geweigerd", async () => {
  const setCookie = await createSessionCookie(user, member);
  const original = cookieValue(setCookie);
  const tampered = `${original.slice(0, -1)}${original.endsWith("a") ? "b" : "a"}`;
  assert.equal(await readSession(new Request("https://ajaxpro.example/club", { headers: { cookie: tampered } })), null);
});

test("logout-cookie verwijdert de volledige browsersessie", () => {
  const setCookie = clearSessionCookie();
  assert.match(setCookie, /^ajaxpro_session=;/);
  assert.match(setCookie, /Max-Age=0/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Secure/);
});
