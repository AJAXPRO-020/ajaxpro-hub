import { redirect } from "../lib/discord-auth";
import { getSessionWithCurrentRoles, sessionHasPermission } from "../lib/server-permissions";
import { permissions } from "../lib/permissions.config";
import { db } from "../lib/motm-db";
import { esc, errorPage, page, pageHeader } from "../lib/motm-view";

const text = (value: unknown) => value == null || value === "" ? null : String(value);
const json = (value: unknown) => value && typeof value === "object" ? value as Record<string, any> : {};
const eventLabel = (type: string) => ({transfer:"Transfer",loan:"Verhuur",loan_return:"Terugkeer na verhuur",release:"Vertrek",club_spell:"Clubperiode",retirement:"Carrière beëindigd"}[type] ?? "Carrièregebeurtenis");
const departureLabel = (type: string) => ({contract_declined:"Contract afgewezen",chose_to_leave:"Zelf vertrokken",released:"Vrijgelaten",sold:"Verkocht",unknown:"Onbekend"}[type] ?? "Onbekend");
const display = (value: unknown, fallback = "Onbekend") => text(value) ?? fallback;
const photoUrl = (player: any) => {
  const value = text(json(player.photo).url);
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
};
const playerPhoto = (player: any, className: string, priority = false) => {
  const url = photoUrl(player);
  return url
    ? `<figure class="${className}"><img src="${esc(url)}" alt="${esc(json(player.photo).alt ?? player.name)}" decoding="sync"${priority ? " fetchpriority=\"high\"" : ""}></figure>`
    : `<figure class="${className} jeugd-photo--placeholder" role="img" aria-label="Geen foto beschikbaar"><span>Geen foto beschikbaar</span></figure>`;
};
const jsonAttribute = (value: unknown) => esc(JSON.stringify(value));
const playerRoute = (player: any) => {
  const events = Array.isArray(player.career_events) ? player.career_events : [];
  return ["Ajax", ...events.map((event: any) => text(event.toClub)).filter(Boolean)]
    .filter((club, index, clubs) => clubs.indexOf(club) === index);
};
const row = (player: any) => {
  const ajax = json(player.ajax_history), current = json(player.current_situation);
  const status = player.career_status === "retired" ? "Carrière beëindigd" : player.career_status === "active" ? "Actief" : null;
  const meta = [text(ajax.departureSeason) ? `Vertrek ${ajax.departureSeason}` : null, status].filter(Boolean).join(" · ");
  return `<a class="jeugd-card jeugd-card--compact has-photo" href="/club/jeugddossiers/speler/${encodeURIComponent(player.id)}">${playerPhoto(player, "jeugd-card__photo")}<div class="jeugd-card__identity"><strong>${esc(player.name)}</strong>${meta ? `<small>${esc(meta)}</small>` : ""}</div><div class="jeugd-card__current"><small>Huidige club</small><span>${esc(display(current.club, "Club onbekend"))}</span></div><span class="jeugd-card__arrow">Open →</span></a>`;
};
const featuredCard = (player: any, primary = false) => {
  const ajax = json(player.ajax_history), current = json(player.current_situation), route = playerRoute(player).join(" → ");
  const ajaxContext = `${display(ajax.lastYouthTeam, "Ajax-jeugd")} · vertrek ${display(ajax.departureSeason, "onbekend")}`;
  const teaser = text(player.editorial_summary) ?? (route || null);
  if (primary) {
    return `<a class="jeugd-feature jeugd-feature--primary has-photo" href="/club/jeugddossiers/speler/${encodeURIComponent(player.id)}">${playerPhoto(player, "jeugd-feature__photo", true)}<p class="jeugd-feature__context">${esc(ajaxContext)}</p><div class="jeugd-feature__body"><h3>${esc(player.name)}</h3>${teaser ? `<p class="jeugd-feature__summary">${esc(teaser)}</p>` : ""}</div><div class="jeugd-feature__current"><small>Huidige club</small><strong>${esc(display(current.club, "Huidige club onbekend"))}</strong><span>Dossier bekijken →</span></div></a>`;
  }
  return `<a class="jeugd-feature jeugd-feature--secondary has-photo" href="/club/jeugddossiers/speler/${encodeURIComponent(player.id)}">${playerPhoto(player, "jeugd-feature__photo", true)}<p class="jeugd-feature__context">${esc(ajaxContext)}</p><div class="jeugd-feature__body"><h3>${esc(player.name)}</h3><p class="jeugd-feature__current-club"><small>Huidige club</small> ${esc(display(current.club, "Huidige club onbekend"))}</p></div><span class="jeugd-feature__link">Dossier openen →</span></a>`;
};

export async function GET(request: Request) {
  const session = await getSessionWithCurrentRoles(request);
  if (!session) return redirect(`/api/auth/discord-login?returnTo=${encodeURIComponent(new URL(request.url).pathname + new URL(request.url).search)}`);
  if (!sessionHasPermission(session, permissions.membersAccess) && !sessionHasPermission(session, permissions.jeugddossiersManage)) {
    return errorPage("Members is exclusief", "Jeugddossiers zijn beschikbaar voor AjaxPro Supporters en Discord Server Boosters.", 403, session, "/club/members", "members");
  }
  const url = new URL(request.url), id = url.searchParams.get("id"), query = (url.searchParams.get("q") ?? "").trim();
  try {
    if (id) return dossier(request, session, id);
    const players = query
      ? await db()`SELECT * FROM youth_dossiers WHERE name ILIKE ${`%${query}%`} OR EXISTS (SELECT 1 FROM unnest(aliases) alias WHERE alias ILIKE ${`%${query}%`}) ORDER BY name`
      : await db()`SELECT * FROM youth_dossiers ORDER BY featured DESC,featured_order NULLS LAST,name`;
    const suggestionPlayers = query
      ? await db()`SELECT id,name,aliases,birth_year,photo,ajax_history,current_situation FROM youth_dossiers ORDER BY featured DESC,featured_order NULLS LAST,name`
      : players;
    const suggestions = suggestionPlayers.map((player: any) => ({
      id: player.id,
      name: player.name,
      aliases: Array.isArray(player.aliases) ? player.aliases : [],
      club: text(json(player.current_situation).club),
      departureSeason: text(json(player.ajax_history).departureSeason),
      photo: photoUrl(player)
    }));
    const heading = query ? `Zoekresultaten voor “${query}”` : "Uitgelichte spelers";
    const content = query
      ? players.length ? `<section class="jeugd-results"><div class="jeugd-section-heading"><p class="eyebrow">Zoeken</p><h2>${esc(heading)}</h2></div><div class="jeugd-list">${players.map(row).join("")}</div></section>` : `<section class="empty"><h2>Geen spelers gevonden</h2><p>Probeer een andere naam of zoekterm.</p></section>`
      : players.length ? (() => { const featured=players.filter((player:any)=>player.featured),lead=featured[0],secondary=featured.slice(1,3),rest=players.filter((player:any)=>!featured.slice(0,3).includes(player));return `<section class="jeugd-results jeugd-results--featured"><div class="jeugd-section-heading"><h2>${esc(heading)}</h2></div>${lead?`<div class="jeugd-feature-grid jeugd-feature-grid--${secondary.length}">${featuredCard(lead,true)}${secondary.length ? `<div class="jeugd-feature-grid__side">${secondary.map((player:any)=>featuredCard(player)).join("")}</div>` : ""}</div>`:""}${rest.length?`<section class="jeugd-archive"><div class="jeugd-section-heading"><p class="eyebrow">Archief</p><h2>Alle dossiers</h2></div><div class="jeugd-list">${rest.map(row).join("")}</div></section>`:""}</section>`; })() : `<section class="empty"><h2>Nog geen dossiers</h2><p>De eerste dossiers worden binnenkort toegevoegd.</p></section>`;
    return page("Na De Toekomst", `<main class="motm-main jeugd-main jeugd-overview"><section class="jeugd-masthead"><header class="jeugd-intro"><p class="eyebrow">Na De Toekomst</p><h1>Na De Toekomst</h1><p>Ooit een Ajax-talent. Maar hoe verging het de spelers die vertrokken?</p></header><form class="jeugd-search" method="get" role="search" data-has-query="${query ? "true" : "false"}" data-players="${jsonAttribute(suggestions)}"><label class="sr-only" for="jeugd-q">Zoek een jeugdspeler</label><div class="jeugd-search__control"><input id="jeugd-q" name="q" value="${esc(query)}" placeholder="Zoek op naam..." autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="jeugd-suggestions"><button class="button" type="submit">Zoeken</button></div><div class="jeugd-suggestions" id="jeugd-suggestions" role="listbox" hidden></div><p class="sr-only" id="jeugd-search-status" aria-live="polite"></p></form></section>${content}</main>`, "/jeugddossiers.js?v=3", session, "jeugddossiers", undefined, {stylesheets:["/jeugddossiers.css"]});
  } catch (error) { console.error("Jeugddossiers failed", error); return errorPage("Jeugddossiers tijdelijk niet beschikbaar", "De dossiers konden nu niet worden geladen. Probeer het later opnieuw.", 503, session, "/club", "jeugddossiers"); }
}

async function dossier(request: Request, session: any, id: string) {
  const [player] = await db()`SELECT * FROM youth_dossiers WHERE id=${id}`;
  if (!player) return errorPage("Speler niet gevonden", "Dit dossier bestaat niet (meer) of is niet beschikbaar.", 404, session, "/club/jeugddossiers", "jeugddossiers");
  const ajax = json(player.ajax_history), current = json(player.current_situation), events = Array.isArray(player.career_events) ? player.career_events : [], sources = Array.isArray(player.sources) ? player.sources : [];
  const eventHtml = events.length ? events.slice().reverse().map((event: any) => {
    const fee = event.fee && typeof event.fee === "object" ? event.fee : null;
    const feeStatus = fee?.status === "confirmed" ? "Bevestigd" : fee?.status === "reported" ? "Gemeld" : null;
    const feeValue = fee?.amount != null ? `Transfersom: ${fee.amount} ${fee.currency ?? "EUR"}` : feeStatus ? `Transfersom: ${feeStatus.toLowerCase()}, bedrag onbekend` : null;
    const feeHtml = feeValue ? `<small>${esc(feeValue)}${feeStatus && fee?.amount != null ? ` · ${esc(feeStatus)}` : ""}</small>` : "";
    const notes = [text(event.note), text(fee?.note)].filter(Boolean);
    const noteHtml = notes.length ? notes.map(note => `<small>${esc(note)}</small>`).join("") : "";
    const period = text(event.season) ?? text(event.startDate);
    const fromClub = text(event.fromClub), toClub = text(event.toClub);
    const clubs = toClub && fromClub ? `${toClub} ← ${fromClub}` : toClub ?? fromClub;
    return `<li><div class="jeugd-event__meta">${period ? `<strong>${esc(period)}</strong>` : ""}<small>${esc(eventLabel(String(event.type ?? "")))}</small></div><div class="jeugd-event__story">${clubs ? `<span>${esc(clubs)}</span>` : ""}${noteHtml}${feeHtml}</div></li>`;
  }).join("") : `<li>Geen carrièregebeurtenissen beschikbaar.</li>`;
  const sourceHtml = sources.length ? `<ul>${sources.map((source: any) => `<li><a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title ?? source.publisher ?? source.url)}</a></li>`).join("")}</ul>` : `<p>Geen bronnen beschikbaar.</p>`;
  const summary = text(player.editorial_summary);
  const status = player.career_status === "retired" ? "Beëindigd" : player.career_status === "active" ? "Actief" : null;
  const currentItems = [["Club", text(current.club)], ["Competitie", text(current.competition)], ["Niveau", text(current.level)], ["Status", status]].filter((item): item is [string, string] => Boolean(item[1]));
  const currentHtml = currentItems.length ? `<section class="jeugd-current" aria-label="Actuele situatie"><p class="eyebrow">Actuele situatie</p><dl>${currentItems.map(([label, value]) => `<div${label === "Club" ? ` class="jeugd-current__club"` : ""}><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></section>` : "";
  const route = playerRoute(player).join(" → ");
  const departure = json(player.departure_reason), departureText = text(departure.text);
  const photo = playerPhoto(player, "jeugd-profile__photo");
  const facts = [["Geboren", text(player.birth_year)], ["Laatste Ajax-team", text(ajax.lastYouthTeam)], ["Vertrokken", text(ajax.departureSeason)], ["Eerste club na Ajax", text(ajax.firstClubAfterAjax)], ["Vertreksoort", player.departure_type && player.departure_type !== "unknown" ? departureLabel(player.departure_type) : null]].filter((item): item is [string, string] => Boolean(item[1]));
  const factsHtml = facts.length ? `<dl class="jeugd-profile__facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` : "";
  return page(player.name, `<main class="motm-main jeugd-main jeugd-dossier"><a class="back" href="/club/jeugddossiers">← Jeugddossiers</a><section class="jeugd-profile${photo ? " has-photo" : ""}"><div class="jeugd-profile__main"><p class="eyebrow">Jeugddossier</p><h1>${esc(player.name)}</h1>${currentHtml}${route?`<p class="jeugd-profile__route">${esc(route)}</p>`:""}${summary?`<p class="jeugd-profile__summary">${esc(summary)}</p>`:""}${factsHtml}${departureText ? `<div class="jeugd-departure"><p class="eyebrow">Vertrek uit Ajax</p><p>${esc(departureText)}</p></div>` : ""}</div>${photo}</section><section class="jeugd-career"><div class="jeugd-section-heading"><p class="eyebrow">Van Ajax tot nu</p><h2>Carrièreverloop</h2></div><ol class="jeugd-timeline">${eventHtml}</ol></section><section class="jeugd-sources"><div class="jeugd-section-heading"><p class="eyebrow">Verantwoording</p><h2>Bronnen</h2></div>${sourceHtml}<p class="jeugd-checked">Laatst gecontroleerd: ${esc(display(player.last_checked_at))}</p></section></main>`, "", session, "jeugddossiers", undefined, {stylesheets:["/jeugddossiers.css"]});
}
