import { readSession } from "../lib/discord-auth";
import { permissions, rolesHavePermission } from "../lib/permissions.config";

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("view") === "legacy-navigation") {
    const { GET } = await import("./navigation-status");
    return GET(request);
  }
  const session = await readSession(request);
  const navigation = new URL(request.url).searchParams.get("view") === "navigation";
  const payload = !session ? { authenticated: false } : !navigation ? { authenticated: true } : {
    authenticated: true,
    username: session.username,
    avatarUrl: session.avatarUrl,
    membersAccess: rolesHavePermission(session.discordRoleIds, permissions.membersAccess),
    staffAccess: rolesHavePermission(session.discordRoleIds, permissions.staffAccess),
  };
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
