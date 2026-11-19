const DISCORD_API_BASE = "https://discord.com/api/v10";
const OAUTH_STATE_COOKIE = "ajaxpro_oauth_state";
const OAUTH_RETURN_COOKIE = "ajaxpro_oauth_return";
const SESSION_COOKIE = "ajaxpro_session";
const STATE_MAX_AGE_SECONDS = 10 * 60;
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
};

type DiscordGuildMember = {
  roles: string[];
};

export type Session = {
  userId: string;
  username: string;
  avatarUrl: string;
  discordRoleIds: string[];
  issuedAt: number;
  expiresAt: number;
};

const requiredEnv = (name: string) => {
  const environment = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  const value = environment?.[name]?.trim();
  if (!value) throw new Error(`De environment variable ${name} ontbreekt.`);
  return value;
};

const sessionSecret = () => {
  const secret = requiredEnv("SESSION_SECRET");
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET moet minimaal 32 tekens lang zijn.");
  }
  return secret;
};

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const encode = (value: string) =>
  bytesToBase64Url(new TextEncoder().encode(value));
const decode = (value: string) =>
  new TextDecoder().decode(base64UrlToBytes(value));

const sign = async (value: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(signature));
};

const safeEqual = (left: string, right: string) => {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
};

const parseCookies = (request: Request) => {
  const cookies = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
};

const usesSecureCookies = () =>
  requiredEnv("DISCORD_REDIRECT_URI").startsWith("https://");

const cookie = (name: string, value: string, maxAge: number) =>
  [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    usesSecureCookies() ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

export const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export const redirect = (
  location: string,
  extraHeaders: Record<string, string | string[]> = {},
) => {
  const headers = new Headers({
    Location: location,
    ...noStoreHeaders,
  });
  for (const [name, values] of Object.entries(extraHeaders)) {
    for (const value of Array.isArray(values) ? values : [values]) {
      headers.append(name, value);
    }
  }

  return new Response(null, {
    status: 302,
    headers,
  });
};

export const createDiscordAuthorization = () => {
  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = bytesToBase64Url(stateBytes);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: requiredEnv("DISCORD_CLIENT_ID"),
    redirect_uri: requiredEnv("DISCORD_REDIRECT_URI"),
    scope: "identify guilds.members.read",
    state,
  });

  return {
    url: `https://discord.com/oauth2/authorize?${params.toString()}`,
    stateCookie: cookie(OAUTH_STATE_COOKIE, state, STATE_MAX_AGE_SECONDS),
  };
};

export const safeClubReturnTo = (value: string | null | undefined) =>
  value && value.startsWith("/club/") && !value.startsWith("//") && !value.includes("\\") ? value : "/club";
export const createReturnToCookie = (value: string | null) => cookie(OAUTH_RETURN_COOKIE, encode(safeClubReturnTo(value)), STATE_MAX_AGE_SECONDS);
export const readReturnTo = (request: Request) => {
  const value = parseCookies(request).get(OAUTH_RETURN_COOKIE);
  if (!value) return "/club";
  try { return safeClubReturnTo(decode(value)); } catch { return "/club"; }
};
export const clearReturnToCookie = () => cookie(OAUTH_RETURN_COOKIE, "", 0);

export const consumeAndValidateState = (request: Request, state: string | null) => {
  const expectedState = parseCookies(request).get(OAUTH_STATE_COOKIE);
  return Boolean(state && expectedState && safeEqual(state, expectedState));
};

export const getDiscordRedirectOrigin = () =>
  new URL(requiredEnv("DISCORD_REDIRECT_URI")).origin;

export const clearStateCookie = () => cookie(OAUTH_STATE_COOKIE, "", 0);
export const clearSessionCookie = () => cookie(SESSION_COOKIE, "", 0);

export const exchangeDiscordCode = async (code: string) => {
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: requiredEnv("DISCORD_CLIENT_ID"),
      client_secret: requiredEnv("DISCORD_CLIENT_SECRET"),
      redirect_uri: requiredEnv("DISCORD_REDIRECT_URI"),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Discord token exchange mislukt (${tokenResponse.status}).`);
  }

  const token = (await tokenResponse.json()) as {
    access_token?: string;
    token_type?: string;
  };
  if (!token.access_token || token.token_type?.toLowerCase() !== "bearer") {
    throw new Error("Discord gaf geen geldig access token terug.");
  }

  return token.access_token;
};

const discordGet = async <T>(path: string, accessToken: string) => {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const error = new Error(`Discord API-verzoek mislukt (${response.status}).`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return (await response.json()) as T;
};

const discordBotGet = async <T>(path: string, botToken: string) => {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    headers: { Authorization: `Bot ${botToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const error = new Error(`Discord bot API-verzoek mislukt (${response.status}).`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return (await response.json()) as T;
};

export const getDiscordUser = (accessToken: string) =>
  discordGet<DiscordUser>("/users/@me", accessToken);

export const getDiscordGuildMember = (accessToken: string) =>
  discordGet<DiscordGuildMember>(
    `/users/@me/guilds/${encodeURIComponent(requiredEnv("DISCORD_GUILD_ID"))}/member`,
    accessToken,
  );

export const getDiscordGuildMemberRoles = async (userId: string) => {
  const botToken = requiredEnv("DISCORD_BOT_TOKEN");
  const member = await discordBotGet<DiscordGuildMember>(
    `/guilds/${encodeURIComponent(requiredEnv("DISCORD_GUILD_ID"))}/members/${encodeURIComponent(userId)}`,
    botToken,
  );
  if (!Array.isArray(member.roles) || !member.roles.every((roleId) => typeof roleId === "string" && Boolean(roleId))) {
    throw new Error("Discord gaf geen geldige guild member-rollen terug.");
  }
  return member.roles;
};

const avatarUrl = (user: DiscordUser) => {
  if (user.avatar) {
    const extension = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=256`;
  }

  const fallbackIndex =
    user.discriminator && user.discriminator !== "0"
      ? Number(user.discriminator) % 5
      : Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
};

export const createSessionCookie = async (
  user: DiscordUser,
  member: DiscordGuildMember,
) => {
  if (
    !member ||
    !Array.isArray(member.roles) ||
    !member.roles.every(
      (roleId) => typeof roleId === "string" && Boolean(roleId),
    )
  ) {
    throw new Error("Discord gaf geen geldig guild member-object terug.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: Session = {
    userId: user.id,
    username: user.global_name || user.username,
    avatarUrl: avatarUrl(user),
    discordRoleIds: member.roles,
    issuedAt,
    expiresAt: issuedAt + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return cookie(
    SESSION_COOKIE,
    `${encodedPayload}.${await sign(encodedPayload)}`,
    SESSION_MAX_AGE_SECONDS,
  );
};

export const readSession = async (request: Request): Promise<Session | null> => {
  const value = parseCookies(request).get(SESSION_COOKIE);
  if (!value) return null;

  const separator = value.lastIndexOf(".");
  if (separator < 1) {
    console.info("Discord auth session rejected: malformed_cookie");
    return null;
  }
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!safeEqual(signature, await sign(payload))) {
    console.info("Discord auth session rejected: invalid_signature");
    return null;
  }

  try {
    const session = JSON.parse(decode(payload)) as Session;
    const now = Math.floor(Date.now() / 1000);
    if (
      !session.userId ||
      !session.username ||
      !session.avatarUrl ||
      !Array.isArray(session.discordRoleIds) ||
      !session.discordRoleIds.every(
        (roleId) => typeof roleId === "string" && Boolean(roleId),
      ) ||
      !Number.isFinite(session.expiresAt)
    ) {
      console.info("Discord auth session rejected: invalid_payload");
      return null;
    }
    if (session.expiresAt <= now) {
      console.info("Discord auth session rejected: expired");
      return null;
    }
    return session;
  } catch {
    console.info("Discord auth session rejected: invalid_payload");
    return null;
  }
};

export const isSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    (usesSecureCookies() ? "https" : "http");
  return Boolean(host && origin === `${protocol}://${host}`);
};
