import { redirect } from "../lib/discord-auth";
import { getSessionWithCurrentRoles, sessionHasPermission } from "../lib/server-permissions";
import { permissions } from "../lib/permissions.config";
import { errorPage, page } from "../lib/motm-view";
import { contractsMarkup } from "../lib/contracts-content";

export async function GET(request: Request) {
  const session = await getSessionWithCurrentRoles(request);
  if (!session) return redirect("/api/auth/discord-login?returnTo=/club/members/contracten");
  if (!sessionHasPermission(session, permissions.membersAccess)) return errorPage("Members is exclusief", "Deze content is beschikbaar voor AjaxPro Supporters en Discord Server Boosters.", 403, session, "/club/members", "members");
  const breadcrumb = `<nav class="members-breadcrumb" aria-label="Kruimelpad"><a href="/club/members">Members</a><span aria-hidden="true">/</span><span aria-current="page">Contracten Ajax 1</span></nav>`;
  return page("Contracten Ajax 1", `<main class="motm-main contracts-page">${breadcrumb}${contractsMarkup}</main>`, "/contracten-ui.js?v=20260908-deal-polish", session, "members", undefined, { stylesheets: ["/contracten.css?v=20261025-contract-bg-off"] });
}
