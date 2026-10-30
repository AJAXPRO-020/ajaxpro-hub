import { db } from "./motm-db";
import { esc } from "./motm-view";
import { loadPlayers, type PlayerRegistryRow } from "./player-registry";
import { loadSocialsMatchStatsSnapshot, loadSocialsStatsAvailability, type SocialsMatchStatsSnapshot } from "./socials-stats-snapshots";

export type MatchCenterFixture = {
  fixtureKey: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffAt: string;
  homeScore: number;
  awayScore: number;
  snapshot: SocialsMatchStatsSnapshot;
  players: readonly PlayerRegistryRow[];
};

export type MatchCenterPageData = {
  matches: readonly MatchCenterFixture[];
  active: MatchCenterFixture;
};

const normalizeName = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("nl-NL").replace(/[^a-z0-9]+/g, " ").trim();

/** Returns only finished fixtures whose stored Socials snapshot passes the existing validation. */
export const loadMatchCenter = async (requestedFixtureKey?: string | null): Promise<MatchCenterPageData | null> => {
  const fixtures = await db()`SELECT f.fixture_key,f.home_team,f.away_team,f.competition,f.kickoff_at,f.goals_home,f.goals_away
    FROM matchday_fixtures f JOIN socials_match_stats_snapshots s ON s.fixture_key=f.fixture_key
    WHERE f.goals_home IS NOT NULL AND f.goals_away IS NOT NULL
      AND (f.provider_status IN ('FT','AET','PEN','FINISHED','MATCH_FINISHED') OR f.finished_at IS NOT NULL)
    ORDER BY f.kickoff_at DESC`;
  const valid = await loadSocialsStatsAvailability(fixtures.map(fixture => String(fixture.fixture_key)));
  const candidates = fixtures.filter(fixture => valid.has(String(fixture.fixture_key)));
  if (!candidates.length) return null;
  const [players, snapshots] = await Promise.all([
    loadPlayers(),
    Promise.all(candidates.map(fixture => loadSocialsMatchStatsSnapshot(String(fixture.fixture_key)))),
  ]);
  const matches = candidates.flatMap((fixture, index) => {
    const snapshot = snapshots[index];
    if (!snapshot) return [];
    return [{
      fixtureKey: String(fixture.fixture_key),
      homeTeam: String(fixture.home_team),
      awayTeam: String(fixture.away_team),
      competition: String(fixture.competition),
      kickoffAt: new Date(fixture.kickoff_at).toISOString(),
      homeScore: Number(fixture.goals_home),
      awayScore: Number(fixture.goals_away),
      snapshot,
      players,
    }];
  });
  if (!matches.length) return null;
  return { matches, active: matches.find(match => match.fixtureKey === requestedFixtureKey) ?? matches[0] };
};

export const registryPlayerForMatchPlayer = (name: string | null, players: readonly PlayerRegistryRow[]) => {
  const expected = normalizeName(name);
  if (!expected) return null;
  const exact = players.find(player => normalizeName(player.name) === expected);
  if (exact) return exact;
  const surname = expected.split(" ").at(-1);
  const matches = players.filter(player => normalizeName(player.name).split(" ").at(-1) === surname);
  return matches.length === 1 ? matches[0] : null;
};

const present = (value: number | null | undefined, digits = 0) => value == null ? "—" : Number(value).toLocaleString("nl-NL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const date = (value: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date(value));
const ratio = (value: number | null, other: number | null) => value == null || other == null || value + other === 0 ? null : Math.round((value / (value + other)) * 100);
const normalizeClub = (name: string) => name.toLocaleLowerCase("nl-NL").replace(/\s+/g, " ").trim();
const clubLogos: Readonly<Record<string, string>> = {
  "ajax": "ajax.png", "az": "az.png", "excelsior": "excelsior.png", "fortuna sittard": "fortuna-sittard.png",
  "fc groningen": "fc-groningen.png", "fc midtjylland": "fc-midtjylland.png", "fc twente": "fc-twente.png",
  "nec": "nec.png", "psv": "psv.png", "sparta": "sparta.png", "sparta rotterdam": "sparta.png",
  "sc cambuur": "sc-cambuur.png", "sint truidense": "sint-truidense.png", "telstar": "telstar.png", "willem ii": "willem-ii.png",
};
const clubLogo = (name: string) => clubLogos[normalizeClub(name)] ? `/assets/clubs/${clubLogos[normalizeClub(name)]}` : null;

const comparison = (label: string, ajax: number | null, opponent: number | null, options: { digits?: number; suffix?: string; feature?: boolean; className?: string } = {}) => {
  if (ajax == null && opponent == null) return "";
  const a = ratio(ajax, opponent), b = a == null ? null : 100 - a;
  const value = (number: number | null) => `${present(number, options.digits ?? 0)}${number == null ? "" : options.suffix ?? ""}`;
  const classes = ["match-center-stat", options.feature ? "match-center-stat--feature" : "", options.className ?? ""].filter(Boolean).join(" ");
  return `<article class="${classes}"><div class="match-center-stat__top"><span>${esc(label)}</span>${options.feature ? '<span class="match-center-stat__mark" aria-hidden="true">AJAX / TEGENSTANDER</span>' : ""}</div><div class="match-center-stat__values"><strong>${value(ajax)}</strong><span aria-hidden="true">—</span><strong>${value(opponent)}</strong></div>${a == null ? "" : `<div class="match-center-stat__bar" role="img" aria-label="${esc(label)}: Ajax ${value(ajax)}, tegenstander ${value(opponent)}"><i style="--bar-share:${a}%"></i><b style="--bar-share:${b}%"></b></div>`}</article>`;
};

export const matchCenterMarkup = (pageData: MatchCenterPageData | null) => {
  if (!pageData) return `<main class="motm-main match-center-main"><nav class="members-breadcrumb" aria-label="Kruimelpad"><a href="/club/members">Members</a><span aria-hidden="true">/</span><span aria-current="page">Match Center</span></nav><section class="empty"><h1>Match Center</h1><p>Er zijn nog geen gevalideerde wedstrijdstatistieken beschikbaar.</p></section></main>`;
  const { matches, active: data } = pageData;
  const { snapshot, homeTeam, awayTeam } = data;
  const opponent = snapshot.opponentTeamStats, ajax = snapshot.teamStats;
  const topThree = snapshot.players.filter(player => player.rating != null).slice().sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)).slice(0, 3);
  const logo = (team: string) => clubLogo(team) ? `<img src="${clubLogo(team)}" alt="Logo ${esc(team)}">` : "";
  const playerFacts = (player: typeof topThree[number], position: string | undefined) => {
    const isKeeper = /keeper|doelman|goalkeeper/i.test(position ?? "");
    const facts: [string, string | number | null | undefined][] = isKeeper
      ? [["Passes", player.passes], ["Passnauwkeurigheid", player.passAccuracy == null ? null : `${present(player.passAccuracy, 1)}%`], ["Luchtduels", player.aerialDuelsWon], ["Balveroveringen", player.recoveries]]
      : [["Goals", player.goals], ["Assists", player.assists], ["xG", player.xg == null ? null : present(player.xg, 2)], ["xA", player.xa == null ? null : present(player.xa, 2)], ["Kansen", player.chancesCreated], ["Tackles", player.tackles], ["Interceptions", player.interceptions]];
    return facts.filter((item): item is [string, string | number] => item[1] != null).slice(0, 4);
  };
  const playerCards = topThree.map((player, index) => {
    const registry = registryPlayerForMatchPlayer(player.name, data.players);
    const image = registry?.imageUrl ? `<img src="${esc(registry.imageUrl)}" alt="${esc(registry.name)}" loading="lazy">` : `<span class="match-center-player__placeholder" aria-hidden="true">${esc((player.name ?? "?").slice(0, 1))}</span>`;
    const facts = playerFacts(player, registry?.position);
    return `<article class="match-center-player"><div class="match-center-player__stage">${image}<span class="match-center-player__rank">${String(index + 1).padStart(2, "0")}</span><span class="match-center-player__rating"><small>FotMob</small><strong>${present(player.rating, 2)}</strong></span></div><div class="match-center-player__content"><h3>${esc(player.name ?? "Ajax-speler")}</h3>${facts.length ? `<dl>${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` : `<p class="match-center-player__no-facts">Geen aanvullende spelerscijfers beschikbaar.</p>`}</div></article>`;
  }).join("");
  const index = matches.findIndex(match => match.fixtureKey === data.fixtureKey);
  const matchHref = (match: MatchCenterFixture) => `/club/members/match-center?match=${encodeURIComponent(match.fixtureKey)}`;
  const navLink = (match: MatchCenterFixture | undefined, label: string, direction: "previous" | "next") => match
    ? `<a class="match-center-switch match-center-switch--${direction}" href="${esc(matchHref(match))}"><span aria-hidden="true">${direction === "previous" ? "←" : "→"}</span><span>${label}<strong>${esc(match.awayTeam === "Ajax" ? match.homeTeam : match.awayTeam)}</strong></span></a>`
    : `<span class="match-center-switch match-center-switch--${direction} is-disabled" aria-disabled="true"><span aria-hidden="true">${direction === "previous" ? "←" : "→"}</span><span>${label}<strong>Geen wedstrijd</strong></span></span>`;
  const selector = `<label class="match-center-picker"><span>Wedstrijd kiezen</span><select data-match-select aria-label="Kies een gevalideerde wedstrijd">${matches.map(match => `<option value="${esc(match.fixtureKey)}"${match.fixtureKey === data.fixtureKey ? " selected" : ""}>${esc(`${match.awayTeam === "Ajax" ? match.homeTeam : match.awayTeam} · ${date(match.kickoffAt)} · ${match.homeScore}–${match.awayScore}`)}</option>`).join("")}</select></label>`;
  const matchNavigation = `<nav class="match-center-navigation" aria-label="Wedstrijdnavigatie">${navLink(matches[index + 1], "Vorige wedstrijd", "previous")}${selector}${navLink(matches[index - 1], "Volgende wedstrijd", "next")}</nav>`;
  const heroStats = `<section class="match-center-headline" aria-label="Hoofdstatistieken">${comparison("xG", ajax.xg, opponent.xg, { digits: 2, feature: true, className: "match-center-stat--xg" })}${comparison("Balbezit", ajax.possession, opponent.possession, { suffix: "%", feature: true, className: "match-center-stat--primary" })}${comparison("Schoten op doel", ajax.shotsOnTarget, opponent.shotsOnTarget, { feature: true, className: "match-center-stat--primary" })}${comparison("Grote kansen", ajax.bigChances, opponent.bigChances, { feature: true, className: "match-center-stat--primary" })}</section>`;
  const supportingStats = `<section class="match-center-supporting" aria-label="Overige statistieken">${comparison("xGOT", ajax.xgot, opponent.xgot, { digits: 2 })}${comparison("Schoten", ajax.shots, opponent.shots)}${comparison("Passes", ajax.passes, opponent.passes)}${comparison("Passnauwkeurigheid", ajax.passAccuracy, opponent.passAccuracy, { suffix: "%", digits: 1 })}${comparison("Corners", ajax.corners, opponent.corners)}${comparison("Gele kaarten", ajax.yellowCards, opponent.yellowCards)}${comparison("Overtredingen", ajax.fouls, opponent.fouls)}${comparison("Rode kaarten", ajax.redCards, opponent.redCards)}</section>`;
  return `<main class="motm-main match-center-main"><nav class="members-breadcrumb" aria-label="Kruimelpad"><a href="/club/members">Members</a><span aria-hidden="true">/</span><span aria-current="page">Match Center</span></nav>${matchNavigation}<header class="match-center-hero"><div class="match-center-hero__light" aria-hidden="true"></div><div class="match-center-hero__meta"><span>${esc(data.competition)}</span><span>${esc(date(data.kickoffAt))}</span></div><div class="match-center-score"><section class="match-center-team match-center-team--home">${logo(homeTeam)}<strong>${esc(homeTeam)}</strong></section><div class="match-center-score__result"><span>Eindstand</span><strong><i>${data.homeScore}</i><b>–</b><i>${data.awayScore}</i></strong></div><section class="match-center-team match-center-team--away">${logo(awayTeam)}<strong>${esc(awayTeam)}</strong></section></div></header><section class="match-center-section match-center-section--stats"><header><h2>Het wedstrijdbeeld</h2><p>De cijfers achter ${esc(homeTeam)}–${esc(awayTeam)}.</p></header>${heroStats}<div class="match-center-stat-legend"><span><i></i> Ajax</span><span><i></i> Tegenstander</span></div>${supportingStats}</section><section class="match-center-section match-center-section--players"><header><h2>Uitblinkers</h2><p>De drie hoogste FotMob-ratings van Ajax.</p></header><div class="match-center-players">${playerCards || `<p class="match-center-empty">Er zijn geen spelersratings opgeslagen voor deze wedstrijd.</p>`}</div></section></main>`;
};
