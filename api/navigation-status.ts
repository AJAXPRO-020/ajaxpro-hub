import { getSessionWithCurrentRoles, sessionHasPermission } from "../lib/server-permissions";
import { permissions } from "../lib/permissions.config";
import { DiscordRoleCheckUnavailable } from "../lib/server-permissions";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=UTF-8",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  try {
    const session = await getSessionWithCurrentRoles(request);
    if (!session) {
      return new Response(JSON.stringify({ authenticated: false }), { headers });
    }

    return new Response(JSON.stringify({
      authenticated: true,
      username: session.username,
      avatarUrl: session.avatarUrl,
      membersAccess: sessionHasPermission(session, permissions.membersAccess),
      staffAccess: sessionHasPermission(session, permissions.staffAccess),
    }), { headers });
  } catch (error) {
    if (!(error instanceof DiscordRoleCheckUnavailable)) throw error;
    return new Response(JSON.stringify({ authenticated: false, unavailable: true }), {
      status: 503,
      headers,
    });
  }
}
