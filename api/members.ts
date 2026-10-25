import { redirect } from "../lib/discord-auth";
import { getSessionWithCurrentRoles, sessionHasPermission } from "../lib/server-permissions";
import { permissions } from "../lib/permissions.config";
import { esc, page } from "../lib/motm-view";

const videos: readonly { title: string; url: string }[] = [];
const intro = "Exclusieve content voor AjaxPro Supporters en Server Boosters.";

const feature = (href: string, category: string, title: string, description: string, action: string, preview: boolean) => {
  const content = `<p class="eyebrow">${category}</p><h2>${title}</h2><p>${description}</p><span>${action} →</span>`;
  return preview
    ? `<div class="members-feature">${content}</div>`
    : `<a class="members-feature" href="${href}">${content}</a>`;
};

export async function GET(request: Request) {
  const session = await getSessionWithCurrentRoles(request);
  if (!session) return redirect(`/api/auth/discord-login?returnTo=${encodeURIComponent("/club/members")}`);
  const preview = !sessionHasPermission(session, permissions.membersAccess);
  const links = `<section class="members-links" aria-label="Members-content">${feature("/club/members/contracten", "Ajax 1", "Contracten Ajax 1", "Wie ligt vast, wie loopt af en waar moet Ajax in actie komen?", "Bekijk contracten", preview)}${feature("/club/jeugddossiers", "Jeugdopleiding", "Na De Toekomst", "Ooit een Ajax-talent. Maar hoe verging het de spelers die vertrokken?", "Bekijk dossiers", preview)}</section>`;
  const videoCards = preview
    ? `<p class="members-empty">Binnenkort vind je hier geselecteerde afleveringen.</p>`
    : videos.length
      ? videos.map(video => `<article class="members-video"><div class="members-video__frame"><iframe src="${esc(video.url)}" title="${esc(video.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><h3>${esc(video.title)}</h3></article>`).join("")
      : `<p class="members-empty">Binnenkort vind je hier geselecteerde afleveringen.</p>`;
  const content = `${links}<section class="members-youtube"><header><p class="eyebrow">Video</p><h2>De Toekomst op YouTube</h2></header><div class="members-video-grid">${videoCards}</div></section>`;
  const body = preview
    ? `<div class="members-preview"><div class="members-preview__content" aria-hidden="true">${content}</div><section class="members-preview__message" aria-label="Toegang tot Members"><h2>Steun AjaxPro</h2><p>Wil je AjaxPro steunen? Dat kan via Petje Af, maandelijks of per jaar. ${intro}</p><a class="button" href="https://buymeacoffee.com/ajaxpro" target="_blank" rel="noreferrer">Petje Af</a></section></div>`
    : content;
  return page("Members", `<main class="motm-main members-main"><header class="members-hero"><h1>Members</h1><p>${intro}</p></header>${body}</main>`, "", session, "members", undefined, { stylesheets: ["/members.css?v=2"] });
}
