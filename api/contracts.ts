import { redirect } from "../lib/discord-auth";
import { getSessionWithPermission } from "../lib/server-permissions";
import { permissions } from "../lib/permissions.config";
import { page } from "../lib/motm-view";
import { contractsMarkup } from "../lib/contracts-content";

export async function GET(request: Request) {
  const session = await getSessionWithPermission(request, permissions.membersAccess);
  if (!session) return redirect("/api/auth/discord-login?returnTo=/club/members/contracten");
  return page("Contracten Ajax 1", `<main class="motm-main contracts-page">${contractsMarkup}</main>`, "/contracten-ui.js?v=20260908-deal-polish", session, "members", undefined, { stylesheets: ["/contracten.css"] });
}
