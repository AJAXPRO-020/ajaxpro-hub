import { redirect } from "../lib/discord-auth";
import { getSessionWithCurrentRoles, getSessionWithPermission } from "../lib/server-permissions";
import { permissions } from "../lib/permissions.config";
import { errorPage, esc, page } from "../lib/motm-view";

const videos: readonly { title: string; url: string }[] = [];

export async function GET(request: Request) {
  const session = await getSessionWithCurrentRoles(request);
  if (!session) return redirect(`/api/auth/discord-login?returnTo=${encodeURIComponent("/club/members")}`);
  const allowed = await getSessionWithPermission(request, permissions.membersAccess);
  if (!allowed) return errorPage("Members is exclusief", "Deze content is beschikbaar voor AjaxPro Supporters en Discord Server Boosters.", 403, session, "/club/stand", "motm");
  const videoCards = videos.length ? videos.map(video => `<article class="members-video"><div class="members-video__frame"><iframe src="${esc(video.url)}" title="${esc(video.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><h3>${esc(video.title)}</h3></article>`).join("") : `<p class="members-empty">Binnenkort vind je hier geselecteerde afleveringen.</p>`;
  return page("Members", `<main class="motm-main members-main"><header class="members-hero"><p class="eyebrow">AjaxPro Members</p><h1>Members</h1><p>Exclusieve content voor AjaxPro Supporters en Server Boosters.</p></header><section class="members-links" aria-label="Members-content"><a class="members-feature" href="/club/members/contracten"><p class="eyebrow">Ajax 1</p><h2>Contracten Ajax 1</h2><p>Wie ligt vast, wie loopt af en waar moet Ajax in actie komen?</p><span>Bekijk contracten →</span></a><a class="members-feature" href="/club/jeugddossiers"><p class="eyebrow">Jeugdopleiding</p><h2>Na De Toekomst</h2><p>Ooit een Ajax-talent. Maar hoe verging het de spelers die vertrokken?</p><span>Bekijk dossiers →</span></a></section><section class="members-youtube"><header><p class="eyebrow">Video</p><h2>De Toekomst op YouTube</h2></header><div class="members-video-grid">${videoCards}</div></section></main>`, "", session, "members", undefined, { stylesheets: ["/members.css"] });
}
