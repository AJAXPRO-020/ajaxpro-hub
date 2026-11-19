import { getDiscordGuildMemberRoles, readSession, type Session } from "./discord-auth";
import {
  defaultMemberPermissions,
  permissions,
  type Permission,
  rolesHavePermission,
} from "./permissions.config";

export const PORTAL_MEMBERSHIP_CACHE_SECONDS = 60 * 60;
export const ROLE_PERMISSION_CACHE_SECONDS = 15 * 60;
type AuthorizationOptions = {
  nowSeconds?: number;
  fetchRoles?: (userId: string) => Promise<readonly string[]>;
};

type PermissionCacheEntry = { roleIds: readonly string[]; checkedAt: number };
const permissionCache = new Map<string, PermissionCacheEntry>();

export class DiscordRoleCheckUnavailable extends Error {
  constructor() { super("Discord-rollen konden tijdelijk niet worden gecontroleerd."); }
}

export const clearPermissionCache = () => permissionCache.clear();
export const clearPermissionCacheForUser = (userId: string) => permissionCache.delete(userId);

export const authorizeSessionPermission = async (
  session: Session,
  permission: Permission,
  options: AuthorizationOptions = {},
): Promise<Session | null> => {
  const cacheSeconds = defaultMemberPermissions.includes(permission)
    ? PORTAL_MEMBERSHIP_CACHE_SECONDS
    : ROLE_PERMISSION_CACHE_SECONDS;
  const currentSession = await resolveCurrentSession(session, cacheSeconds, options);
  if (!currentSession) return null;
  return defaultMemberPermissions.includes(permission) || rolesHavePermission(currentSession.discordRoleIds, permission) ? currentSession : null;
};

const resolveCurrentSession = async (
  session: Session,
  cacheSeconds: number,
  options: AuthorizationOptions = {},
): Promise<Session | null> => {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const sessionAge = now - session.issuedAt;
  if (!Number.isFinite(session.issuedAt) || sessionAge < 0) return null;
  const cached = permissionCache.get(session.userId);
  const roleIds = cached && now - cached.checkedAt < cacheSeconds
    ? cached.roleIds
    : cached
      ? await refreshRoles(session.userId, now, options.fetchRoles)
      : session.issuedAt + cacheSeconds > now
        ? (permissionCache.set(session.userId, { roleIds: session.discordRoleIds, checkedAt: session.issuedAt }), session.discordRoleIds)
        : await refreshRoles(session.userId, now, options.fetchRoles);
  if (!roleIds) return null;
  return { ...session, discordRoleIds: [...roleIds] };
};

export const authorizeSessionCurrentRoles = (
  session: Session,
  options: AuthorizationOptions = {},
) => resolveCurrentSession(session, ROLE_PERMISSION_CACHE_SECONDS, options);

const refreshRoles = async (
  userId: string,
  now: number,
  fetchRoles: (userId: string) => Promise<readonly string[]> = async (userId) => getDiscordGuildMemberRoles(userId),
): Promise<readonly string[] | null> => {
  try {
    const roleIds = await fetchRoles(userId);
    permissionCache.set(userId, { roleIds: [...roleIds], checkedAt: now });
    return roleIds;
  } catch (error) {
    permissionCache.delete(userId);
    const status = (error as { status?: number }).status;
    if (status === 404) {
      console.info("Discord auth role check: member_not_found");
      return null;
    }
    console.warn("Discord auth role check: unavailable", { status: Number.isInteger(status) ? status : "network_or_config" });
    throw new DiscordRoleCheckUnavailable();
  }
};

export const getSessionWithPermission = async (
  request: Request,
  permission: Permission,
): Promise<Session | null> => {
  const session = await readSession(request);
  if (!session) {
    console.info("Discord auth protected request: no_valid_session");
    return null;
  }
  return authorizeSessionPermission(session, permission);
};

export const getSessionWithCurrentRoles = async (request: Request): Promise<Session | null> => {
  const session = await readSession(request);
  if (!session) {
    console.info("Discord auth protected request: no_valid_session");
    return null;
  }
  return authorizeSessionCurrentRoles(session);
};

export const sessionHasPermission = (session: Session, permission: Permission) =>
  defaultMemberPermissions.includes(permission) || rolesHavePermission(session.discordRoleIds, permission);
