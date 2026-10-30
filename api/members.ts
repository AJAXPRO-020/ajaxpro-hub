import { redirect } from "../lib/discord-auth";
import { getSessionWithCurrentRoles, sessionHasPermission } from "../lib/server-permissions";
import { permissions } from "../lib/permissions.config";
import { esc, page } from "../lib/motm-view";

type ArchiveVideo = {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  durationSeconds: number;
  category: string;
};
type ArchiveCategory = { id: string; label: string };
type VideoArchive = { categories: readonly ArchiveCategory[]; videos: readonly ArchiveVideo[] };

const archive = require("../data/ajaxpro-video-archive.json") as VideoArchive;
const intro = "Exclusieve content voor AjaxPro Supporters en Server Boosters.";
const archiveIntro = "Wedstrijdanalyses, spelersprofielen en tactische inzichten uit het AjaxPro-archief.";

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const formatPublishedAt = (value: string) => new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Amsterdam",
}).format(new Date(value));

const formatViews = (views: number) => `${new Intl.NumberFormat("nl-NL").format(views)} weergaven`;

const feature = (href: string, category: string, title: string, description: string, action: string, preview: boolean, variant = "") => {
  const media = variant === "future" && !preview
    ? `<span class="members-feature__media" aria-hidden="true"><img class="members-feature__scene" src="/jeugddossiers/players/amourricho-van-axel-dongen.webp" alt=""><img class="members-feature__portrait" src="/jeugddossiers/players/naci-unuvar.webp" alt=""></span>`
    : "";
  const content = `${media}<p class="eyebrow">${category}</p><h2>${title}</h2><p>${description}</p><span class="members-feature__action">${action} →</span>`;
  const className = `members-feature${variant ? ` members-feature--${variant}` : ""}`;
  return preview
    ? `<div class="${className}">${content}</div>`
    : `<a class="${className}" href="${href}">${content}</a>`;
};

export async function GET(request: Request) {
  const session = await getSessionWithCurrentRoles(request);
  if (!session) return redirect(`/api/auth/discord-login?returnTo=${encodeURIComponent("/club/members")}`);
  const preview = !sessionHasPermission(session, permissions.membersAccess);
  const links = `<section class="members-links" aria-label="Members-content">${feature("/club/members/contracten", "Ajax 1", "Contracten Ajax 1", "Wie ligt vast, wie loopt af en waar moet Ajax in actie komen?", "Bekijk contracten", preview, "contracts")}${feature("/club/jeugddossiers", "Jeugdopleiding", "Na De Toekomst", "Ooit een Ajax-talent. Maar hoe verging het de spelers die vertrokken?", "Bekijk dossiers", preview, "future")}</section>`;
  const categoryFilters = archive.categories.map(category => {
    const count = archive.videos.filter(video => video.category === category.id).length;
    return `<button type="button" class="members-filter" data-category="${esc(category.id)}" aria-pressed="false">${esc(category.label)} <span>${count}</span></button>`;
  }).join("");
  const videoCards = preview
    ? Array.from({ length: 6 }, (_, index) => `<div class="members-video members-video--placeholder" aria-hidden="true"><div class="members-video__frame"><span>${String(index + 1).padStart(2, "0")}</span></div><span></span><span></span></div>`).join("")
    : archive.videos.map((video, index) => `<article class="members-video" data-video-card data-category="${esc(video.category)}" data-title="${esc(video.title)}" data-date="${new Date(video.publishedAt).getTime()}" data-views="${video.views}"${index >= 12 ? " hidden" : ""}><button type="button" class="members-video__open" data-video-id="${esc(video.id)}" data-video-title="${esc(video.title)}" aria-label="Speel ${esc(video.title)} af"><span class="members-video__frame"><img src="${esc(video.thumbnail)}" alt="" loading="lazy" width="1280" height="720"><span class="members-video__duration">${formatDuration(video.durationSeconds)}</span><span class="members-video__play" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M8 5.5v13l10-6.5z"/></svg></span></span><span class="members-video__body"><strong>${esc(video.title)}</strong><span class="members-video__meta"><time datetime="${esc(video.publishedAt)}">${formatPublishedAt(video.publishedAt)}</time><span aria-hidden="true">•</span><span>${formatViews(video.views)}</span></span></span></button></article>`).join("");
  const archiveControls = preview ? "" : `<div class="members-archive__controls"><div class="members-filters" aria-label="Filter video's op categorie"><button type="button" class="members-filter active" data-category="all" aria-pressed="true">Alles <span>${archive.videos.length}</span></button>${categoryFilters}</div><div class="members-archive__tools"><label class="members-search"><span class="sr-only">Zoek in videotitels</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/></svg><input type="search" placeholder="Zoek video's" data-video-search autocomplete="off"></label><label class="members-sort"><span class="sr-only">Sorteer video's</span><select data-video-sort><option value="newest">Nieuwste</option><option value="oldest">Oudste</option><option value="views">Meest bekeken</option></select></label></div></div>`;
  const archiveFooter = preview ? "" : `<div class="members-archive__footer"><p class="members-results" data-video-results aria-live="polite">12 van ${archive.videos.length} video's</p><button class="members-load-more" type="button" data-video-load-more>Meer laden</button></div><p class="members-video-empty" data-video-empty hidden>Geen video's gevonden. Probeer een andere zoekterm of categorie.</p>`;
  const player = preview ? "" : `<dialog class="members-player" data-video-dialog aria-label="Videospeler"><div class="members-player__panel"><div class="members-player__top"><strong data-video-dialog-title></strong><button type="button" data-video-close aria-label="Video sluiten"><span aria-hidden="true">×</span></button></div><div class="members-player__frame" data-video-frame></div></div></dialog>`;
  const content = `${links}<section class="members-youtube"${preview ? "" : " data-video-archive"}><header><h2>AjaxPro Videoarchief</h2><p>${archiveIntro}</p></header>${archiveControls}<div class="members-video-grid" data-video-grid>${videoCards}</div>${archiveFooter}</section>${player}`;
  const body = preview
    ? `<div class="members-preview"><div class="members-preview__veil"><div class="members-preview__content" aria-hidden="true">${content}</div><section class="members-preview__message support-strip" aria-labelledby="members-support-title"><div class="support-strip__copy"><span class="support-strip__icon" aria-hidden="true">♥</span><div><h2 id="members-support-title">Steun AjaxPro</h2><p>Wil je AjaxPro steunen? Dat kan via Petje Af, maandelijks of per jaar.</p><p class="members-preview__access">AjaxPro Supporters en Discord Server Boosters krijgen toegang tot Members.</p></div></div><a class="support-strip__action" href="https://buymeacoffee.com/ajaxpro" target="_blank" rel="noreferrer">Petje Af <span aria-hidden="true">↗</span></a></section></div></div>`
    : content;
  return page("Members", `<main class="motm-main members-main"><header class="members-hero"><h1>Members</h1><p>${intro}</p></header>${body}</main>`, preview ? "" : "/members-video.js", session, "members", undefined, { stylesheets: ["/members.css?v=6"], imageSources: preview ? [] : ["https://i.ytimg.com"], frameSources: preview ? [] : ["https://www.youtube-nocookie.com"] });
}
