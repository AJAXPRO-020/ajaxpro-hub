export const permissions = {
  portalAccess: "portal.access",
  toolsLineup: "tools.lineup",
  toolsTactics: "tools.tactics",
  toolsScreenshot: "tools.screenshot",
  toolsSocials: "tools.socials",
  adminManage: "admin.manage",
  motmManage: "motm.manage",
  motmDelete: "motm.delete",
  jeugddossiersManage: "jeugddossiers.manage",
  membersAccess: "members.access",
  staffAccess: "staff.access",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

export const defaultMemberPermissions: readonly Permission[] = [
  permissions.portalAccess,
];

export const discordRolePermissions: ReadonlyMap<
  string,
  readonly Permission[]
> = new Map();

const idsFromEnv = (name: string) => new Set((process.env[name] ?? "").split(",").map(id => id.trim()).filter(Boolean));

export const rolesHavePermission = (
  roleIds: readonly string[],
  permission: Permission,
) => {
  if (permission === permissions.membersAccess) {
    const allowed = idsFromEnv("PORTAL_MEMBERS_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  if (permission === permissions.staffAccess) {
    const configured = idsFromEnv("PORTAL_STAFF_ROLE_IDS");
    const builtInStaff = new Set(["1268471493034246376", "1268471493046566986"]);
    return roleIds.some(roleId => configured.has(roleId) || builtInStaff.has(roleId));
  }
  if (permission === permissions.motmManage) {
    const allowed = idsFromEnv("MOTM_MANAGER_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  if (permission === permissions.motmDelete) {
    const allowed = idsFromEnv("MOTM_DELETE_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  if (permission === permissions.jeugddossiersManage) {
    const allowed = idsFromEnv("PORTAL_TEAM_TOOL_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  if (permission === permissions.toolsTactics || permission === permissions.toolsScreenshot || permission === permissions.toolsSocials) {
    const allowed = idsFromEnv("PORTAL_TEAM_TOOL_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  return roleIds.some((roleId) => discordRolePermissions.get(roleId)?.includes(permission));
};
