import { db } from "../lib/motm-db";
import {
  amsterdamLocalToUtc,
  normalizeTeamName,
} from "../lib/matchday-live";
import { consumeNextMatchRateLimit } from "../lib/next-match-rate-limit";
import { verifyGitHubOidcRequest } from "../lib/github-oidc";
import { sendAutomaticAnnouncement } from "../lib/motm-announcements";
import { announcementPlan } from "../lib/motm-announcement-plan";
import { synchronizeAllMatches } from "../lib/motm-scheduling";

const AJAX_FIXTURES_URL = "https://www.ajax.nl/wedstrijden/";
const TV_GUIDE_URL = "https://www.voetbaloptv.com/wp-json/vtv/v1/wedstrijden";
const SOURCE_MAX_AGE_MS = 6 * 60 * 60_000;

const DUTCH_MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
};

const cleanText = (value: string) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const parseAjaxDate = (value: string) => {
  const match = cleanText(value).match(/(?:ma|di|wo|do|vr|za|zo)\.\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
  if (!match) return null;
  const [, day, monthName, year, hours, minutes] = match;
  const month = DUTCH_MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  const date = amsterdamLocalToUtc(Number(year), month, Number(day), Number(hours), Number(minutes));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parseAjaxFixtures = (html: string) => {
  const items = html.match(/<li class="matches-block__match">[\s\S]*?<\/li>/g) ?? [];
  const fixtures = items.map(item => {
    const competition = cleanText(item.match(/class="matches-block__league">([\s\S]*?)<\/span>/)?.[1] ?? "");
    const dateText = cleanText(item.match(/class="matches-block__date">([\s\S]*?)<\/span>/)?.[1] ?? "");
    const kickoff = parseAjaxDate(dateText);
    const participantText = cleanText(item.match(/class="matches-block__participants[^>]*>([\s\S]*)<\/span>\s*<\/div>/)?.[1] ?? "");
    const participantNames = participantText.split(/\s+[–-]\s+/).map(cleanText).filter(Boolean);
    const logoNames = [...new Set([...item.matchAll(/<img[^>]+alt="([^"]+)"[^>]*>/g)].map(match => cleanText(match[1])).filter(Boolean))];
    const teamNames = participantNames.length === 2 ? participantNames : logoNames;
    const [home, away] = teamNames;
    if (!kickoff || !home || !away || (home !== "Ajax" && away !== "Ajax")) return null;
    return { home, away, competition, kickoff };
  }).filter((fixture): fixture is NonNullable<typeof fixture> => Boolean(fixture));
  return [...new Map(fixtures.map(fixture => [`${fixture.kickoff.toISOString()}-${fixture.home}-${fixture.away}`, fixture])).values()]
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
};

export const parseAjaxResults = (html: string) => [...html.matchAll(/<tr>[\s\S]*?<\/tr>/g)]
  .map(match => [...match[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(cell => cleanText(cell[1])))
  .map(cells => {
    const dateMatch = cells[0]?.match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/);
    const scoreMatch = cells[2]?.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!dateMatch || !scoreMatch || !cells[1] || !cells[3]) return null;
    const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    return {
      date: `${year}-${dateMatch[2]}-${dateMatch[1]}`,
      home: cells[1],
      away: cells[3],
      goalsHome: Number(scoreMatch[1]),
      goalsAway: Number(scoreMatch[2]),
    };
  })
  .filter((result): result is NonNullable<typeof result> => Boolean(result));

const parseTvDate = (date: string, time: string) => {
  const [day, month, year] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return amsterdamLocalToUtc(year, month, day, hours, minutes);
};

export const findTvListing = (listings: Array<Record<string, string>>, fixture: ReturnType<typeof parseAjaxFixtures>[number]) => listings.find(listing => {
  if (!normalizeTeamName(listing.thuisteam).includes("ajax") && !normalizeTeamName(listing.uitteam).includes("ajax")) return false;
  const sameKickoff = Math.abs(parseTvDate(listing.datum, listing.tijd).getTime() - fixture.kickoff.getTime()) < 15 * 60_000;
  const sameHome = normalizeTeamName(listing.thuisteam).includes(normalizeTeamName(fixture.home));
  const sameAway = normalizeTeamName(listing.uitteam).includes(normalizeTeamName(fixture.away)) || normalizeTeamName(fixture.away).includes(normalizeTeamName(listing.uitteam));
  return sameKickoff && sameHome && sameAway;
});

const fixtureKey = (fixture: { kickoff: Date; home: string; away: string }) => `${fixture.kickoff.toISOString()}-${normalizeTeamName(fixture.home)}-${normalizeTeamName(fixture.away)}`;

const syncSourceFixtures = async () => {
  const sql = db();
  const [freshness] = await sql`SELECT max(source_checked_at) checked_at FROM matchday_fixtures`;
  if (freshness?.checked_at && Date.now() - new Date(freshness.checked_at).getTime() < SOURCE_MAX_AGE_MS) return;
  try {
    const [fixturesResponse, tvResponse] = await Promise.all([
      fetch(AJAX_FIXTURES_URL, { headers: { "User-Agent": "AjaxPro/1.0 (+https://www.ajaxpro.fans/)" }, signal: AbortSignal.timeout(10_000) }),
      fetch(TV_GUIDE_URL, { headers: { "User-Agent": "AjaxPro/1.0 (+https://www.ajaxpro.fans/)" }, signal: AbortSignal.timeout(10_000) }).catch(() => null),
    ]);
    if (!fixturesResponse.ok) throw new Error(`Ajax fixtures returned ${fixturesResponse.status}`);
    const fixtures = parseAjaxFixtures(await fixturesResponse.text());
    let listings: Array<Record<string, string>> = [];
    if (tvResponse?.ok) {
      const payload = await tvResponse.json();
      listings = Array.isArray(payload?.data) ? payload.data : [];
    }
    const checkedAt = new Date();
    for (const fixture of fixtures) {
      const tv = findTvListing(listings, fixture);
      await sql`INSERT INTO matchday_fixtures(fixture_key,home_team,away_team,competition,kickoff_at,tv,source_checked_at)
        VALUES(${fixtureKey(fixture)},${fixture.home},${fixture.away},${fixture.competition},${fixture.kickoff},${tv?.alle_zenders || tv?.hoofdzender || null},${checkedAt})
        ON CONFLICT(fixture_key) DO UPDATE SET home_team=excluded.home_team,away_team=excluded.away_team,competition=excluded.competition,kickoff_at=excluded.kickoff_at,tv=excluded.tv,source_checked_at=excluded.source_checked_at,updated_at=now()`;
    }
  } catch (error) {
    console.error("Unable to refresh Ajax match source", error);
  }
};

type StoredFixture = {
  fixture_key: string; home_team: string; away_team: string; competition: string; kickoff_at: Date | string; tv: string | null;
  goals_home: number | null; goals_away: number | null; finished_at: Date | string | null;
};
type PlannedAnnouncementMatch = { status: string; scheduled_open_at: Date | string | null; scheduled_close_at: Date | string | null };

const nextStoredFixture = async () => {
  const [fixture] = await db()`SELECT * FROM matchday_fixtures WHERE kickoff_at>${new Date()} ORDER BY kickoff_at LIMIT 1`;
  return fixture as StoredFixture | undefined;
};

const storedFixtures = async () => {
  const fixtures = await db()`SELECT * FROM matchday_fixtures WHERE kickoff_at>${new Date()} ORDER BY kickoff_at`;
  return fixtures as unknown as StoredFixture[];
};

const responseFor = (fixture: StoredFixture | undefined, now: Date) => {
  if (!fixture) return { match: null, message: "De volgende wedstrijd is nog niet bekend.", updatedAt: now.toISOString() };
  const isHome = normalizeTeamName(fixture.home_team).includes("ajax");
  return {
    match: {
      home: fixture.home_team,
      away: fixture.away_team,
      opponent: isHome ? fixture.away_team : fixture.home_team,
      isHome,
      competition: fixture.competition,
      kickoff: new Date(fixture.kickoff_at).toISOString(),
      tv: fixture.tv,
      mode: "countdown",
    },
    updatedAt: now.toISOString(),
  };
};

const programResponseFor = (fixtures: StoredFixture[], now: Date) => ({
  fixtures: fixtures.map((fixture) => {
    const isHome = normalizeTeamName(fixture.home_team).includes("ajax");
    return {
      home: fixture.home_team,
      away: fixture.away_team,
      opponent: isHome ? fixture.away_team : fixture.home_team,
      isHome,
      competition: fixture.competition,
      kickoff: new Date(fixture.kickoff_at).toISOString(),
      tv: fixture.tv,
      score: fixture.goals_home != null && fixture.goals_away != null
        ? { home: fixture.goals_home, away: fixture.goals_away }
        : null,
    };
  }),
  updatedAt: now.toISOString(),
});

const jsonResponse = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=45, stale-if-error=86400",
    "Vercel-CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=45, stale-if-error=86400",
    ...extraHeaders,
  },
});

const automationResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "private, no-store" },
});

export async function GET(request: Request) {
  if (request.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);
  const now = new Date();
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  try {
    if (view === "motm-announcement") {
      if (!await verifyGitHubOidcRequest(request)) return automationResponse({ error: "Unauthorized" }, 401);
      // The GitHub check is also the scheduler heartbeat: catch up every due MOTM transition.
      await synchronizeAllMatches(now);
      if (url.searchParams.get("plan") === "1") {
        const [match] = await db()`SELECT status,scheduled_open_at,scheduled_close_at FROM motm_matches
          WHERE deleted_at IS NULL AND status IN ('draft','open') AND scheduled_close_at>${now}
          ORDER BY scheduled_open_at LIMIT 1`;
        return automationResponse(announcementPlan(match as PlannedAnnouncementMatch | undefined, now));
      }
      const [match] = await db()`SELECT status,scheduled_open_at,scheduled_close_at FROM motm_matches
        WHERE deleted_at IS NULL AND status IN ('draft','open') AND scheduled_close_at>${now}
        ORDER BY scheduled_open_at LIMIT 1`;
      const plan = announcementPlan(match as PlannedAnnouncementMatch | undefined, now);
      if (!plan.active || !plan.due) return automationResponse(plan);
      const result = await sendAutomaticAnnouncement(request.url, now);
      return automationResponse({ ...result, active: result.status !== "sent" && result.status !== "already_sent" });
    }
    const rateLimit = await consumeNextMatchRateLimit(request);
    if (!rateLimit.allowed) return jsonResponse(
      { error: "Te veel verzoeken. Probeer het later opnieuw." },
      429,
      { "Cache-Control": "private, no-store", "Vercel-CDN-Cache-Control": "private, no-store", "Retry-After": String(rateLimit.retryAfter) },
    );
    await syncSourceFixtures();
    if (view === "program") {
      return jsonResponse(programResponseFor(await storedFixtures(), now));
    }
    return jsonResponse(responseFor(await nextStoredFixture(), now));
  } catch (error) {
    console.error("Unable to load matchday state", error);
    if (view === "motm-announcement") return automationResponse({ error: "Announcement check failed" }, 500);
    try { return jsonResponse(responseFor(await nextStoredFixture(), now)); }
    catch { return jsonResponse({ match: null, message: "De volgende wedstrijd is nog niet bekend.", updatedAt: now.toISOString() }); }
  }
}
