import { db } from "../lib/motm-db";
import {
  amsterdamDateKey,
  amsterdamLocalToUtc,
  API_FOOTBALL_AJAX_TEAM_ID,
  API_FOOTBALL_BASE_URL,
  BREAK_STATUSES,
  FINISHED_STATUSES,
  modeForMatch,
  nextProviderDelayMs,
  normalizeTeamName,
  selectProviderFixture,
} from "../lib/matchday-live";
import { consumeNextMatchRateLimit } from "../lib/next-match-rate-limit";
import { verifyGitHubOidcRequest } from "../lib/github-oidc";
import { sendAutomaticAnnouncement } from "../lib/motm-announcements";
import { announcementPlan } from "../lib/motm-announcement-plan";

const AJAX_FIXTURES_URL = "https://www.ajax.nl/wedstrijden/";
const TV_GUIDE_URL = "https://www.voetbaloptv.com/wp-json/vtv/v1/wedstrijden";
const SOURCE_MAX_AGE_MS = 6 * 60 * 60_000;
const PROVIDER_START_MS = 5 * 60_000;
const FIXTURE_LINK_WINDOW_MS = 36 * 60 * 60_000;

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
  provider_fixture_id: string | number | null; provider_status: string | null; elapsed: number | null; elapsed_extra: number | null; goals_home: number | null; goals_away: number | null;
  next_refresh_at: Date | string | null; refresh_locked_until: Date | string | null; finished_at: Date | string | null;
};

const nextStoredFixture = async () => {
  const [fixture] = await db()`SELECT * FROM matchday_fixtures WHERE finished_at IS NULL AND kickoff_at>${new Date(Date.now() - 6 * 60 * 60_000)} ORDER BY kickoff_at LIMIT 1`;
  return fixture as StoredFixture | undefined;
};

const storedFixtures = async () => {
  const fixtures = await db()`SELECT * FROM matchday_fixtures WHERE kickoff_at>${new Date(Date.now() - 6 * 60 * 60_000)} ORDER BY kickoff_at`;
  return fixtures as unknown as StoredFixture[];
};

const reserveProviderCall = async (fixture: StoredFixture, now: Date) => {
  const sql = db(), budgetDay = amsterdamDateKey(now);
  return sql.begin(async tx => {
    const [locked] = await tx`SELECT fixture_key,next_refresh_at,refresh_locked_until,finished_at FROM matchday_fixtures WHERE fixture_key=${fixture.fixture_key} FOR UPDATE`;
    if (!locked || locked.finished_at || (locked.refresh_locked_until && new Date(locked.refresh_locked_until) > now) || (locked.next_refresh_at && new Date(locked.next_refresh_at) > now)) return null;
    await tx`INSERT INTO matchday_api_budget(budget_day,calls) VALUES(${budgetDay},0) ON CONFLICT(budget_day) DO NOTHING`;
    const [budget] = await tx`SELECT calls FROM matchday_api_budget WHERE budget_day=${budgetDay} FOR UPDATE`;
    if (!budget || Number(budget.calls) >= 100) return null;
    const calls = Number(budget.calls) + 1;
    await tx`UPDATE matchday_api_budget SET calls=${calls},updated_at=now() WHERE budget_day=${budgetDay}`;
    await tx`UPDATE matchday_fixtures SET refresh_locked_until=${new Date(now.getTime() + 30_000)},next_refresh_at=${new Date(now.getTime() + 5 * 60_000)},updated_at=now() WHERE fixture_key=${fixture.fixture_key}`;
    return { calls };
  });
};

type ProviderFixture = {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null; extra?: number | null } };
  league: { name: string };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};

const providerUrlFor = (fixture: StoredFixture) => {
  if (fixture.provider_fixture_id) return `${API_FOOTBALL_BASE_URL}/fixtures?id=${fixture.provider_fixture_id}`;
  return `${API_FOOTBALL_BASE_URL}/fixtures?team=${API_FOOTBALL_AJAX_TEAM_ID}&date=${amsterdamDateKey(new Date(fixture.kickoff_at))}&timezone=Europe%2FAmsterdam`;
};

const refreshOfficialResultFallback = async (fixture: StoredFixture, now: Date) => {
  try {
    const response = await fetch(AJAX_FIXTURES_URL, {
      headers: { "User-Agent": "AjaxPro/1.0 (+https://www.ajaxpro.fans/)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result = parseAjaxResults(await response.text()).find(item =>
      item.date === amsterdamDateKey(new Date(fixture.kickoff_at))
      && normalizeTeamName(item.home) === normalizeTeamName(fixture.home_team)
      && normalizeTeamName(item.away) === normalizeTeamName(fixture.away_team));
    if (!result) return false;
    await db()`UPDATE matchday_fixtures SET provider_status='FT',goals_home=${result.goalsHome},goals_away=${result.goalsAway},last_success_at=${now},next_refresh_at=NULL,refresh_locked_until=NULL,finished_at=${now},updated_at=now() WHERE fixture_key=${fixture.fixture_key}`;
    return true;
  } catch (error) {
    console.error("Unable to refresh official Ajax result fallback", error);
    return false;
  }
};

const refreshProviderState = async (fixture: StoredFixture, now: Date) => {
  const apiKey = process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) return;
  const kickoff = new Date(fixture.kickoff_at).getTime();
  const shouldLink = !fixture.provider_fixture_id && kickoff - now.getTime() <= FIXTURE_LINK_WINDOW_MS;
  const shouldRefresh = Boolean(fixture.provider_fixture_id) && now.getTime() >= kickoff - PROVIDER_START_MS;
  if (!shouldLink && !shouldRefresh) return;
  const reservation = await reserveProviderCall(fixture, now);
  if (!reservation) return;
  try {
    const response = await fetch(providerUrlFor(fixture), { headers: { "x-apisports-key": apiKey }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`API-Football returned ${response.status}`);
    const payload = await response.json();
    if (payload?.errors && Object.keys(payload.errors).length) throw new Error("API-Football returned an API error");
    const candidates: ProviderFixture[] = Array.isArray(payload?.response) ? payload.response : [];
    const selected = fixture.provider_fixture_id ? candidates[0] : selectProviderFixture(candidates, { home: fixture.home_team, away: fixture.away_team, kickoff: fixture.kickoff_at });
    if (!selected) {
      await db()`UPDATE matchday_fixtures SET next_refresh_at=${new Date(now.getTime()+6*60*60_000)},refresh_locked_until=NULL,updated_at=now() WHERE fixture_key=${fixture.fixture_key}`;
      return;
    }
    const status = selected.fixture.status.short;
    const delay = nextProviderDelayMs({ status, calls: reservation.calls });
    const finished = FINISHED_STATUSES.has(status);
    await db()`UPDATE matchday_fixtures SET provider_fixture_id=${selected.fixture.id},provider_status=${status},elapsed=${selected.fixture.status.elapsed},elapsed_extra=${selected.fixture.status.extra??null},goals_home=${selected.goals.home},goals_away=${selected.goals.away},last_success_at=${now},next_refresh_at=${delay===null?null:new Date(now.getTime()+delay)},refresh_locked_until=NULL,finished_at=${finished?now:null},updated_at=now() WHERE fixture_key=${fixture.fixture_key}`;
  } catch (error) {
    console.error("Unable to refresh API-Football fixture", error);
    if (await refreshOfficialResultFallback(fixture, now)) return;
    const delay = nextProviderDelayMs({ status: fixture.provider_status, calls: reservation.calls, failed: true }) ?? 5 * 60_000;
    await db()`UPDATE matchday_fixtures SET next_refresh_at=${new Date(now.getTime()+delay)},refresh_locked_until=NULL,updated_at=now() WHERE fixture_key=${fixture.fixture_key}`;
  }
};

const responseFor = (fixture: StoredFixture | undefined, now: Date) => {
  if (!fixture) return { match: null, message: "De volgende wedstrijd is nog niet bekend.", updatedAt: now.toISOString() };
  const isHome = normalizeTeamName(fixture.home_team).includes("ajax");
  const mode = modeForMatch({ kickoff: fixture.kickoff_at, providerStatus: fixture.provider_status, finishedAt: fixture.finished_at }, now);
  return {
    match: {
      home: fixture.home_team,
      away: fixture.away_team,
      opponent: isHome ? fixture.away_team : fixture.home_team,
      isHome,
      competition: fixture.competition,
      kickoff: new Date(fixture.kickoff_at).toISOString(),
      tv: fixture.tv,
      mode,
      status: fixture.provider_status,
      minute: fixture.elapsed == null ? null : fixture.elapsed_extra ? `${fixture.elapsed}+${fixture.elapsed_extra}` : String(fixture.elapsed),
      score: mode === "live" ? { home: fixture.goals_home ?? 0, away: fixture.goals_away ?? 0 } : null,
      isBreak: BREAK_STATUSES.has(fixture.provider_status ?? ""),
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
      status: fixture.provider_status,
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
      if (url.searchParams.get("plan") === "1") {
        await syncSourceFixtures();
        return automationResponse(announcementPlan(await nextStoredFixture(), now));
      }
      let fixture = await nextStoredFixture();
      const plan = announcementPlan(fixture, now);
      if (!plan.active || !plan.due) return automationResponse(plan);
      if (!fixture) return automationResponse({ status: "no_fixture", active: false });
      await refreshProviderState(fixture, now);
      fixture = await nextStoredFixture();
      const refreshedPlan = announcementPlan(fixture, now);
      if (!fixture || !refreshedPlan.active || !refreshedPlan.due) return automationResponse(refreshedPlan);
      const result = await sendAutomaticAnnouncement(fixture, request.url);
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
    let fixture = await nextStoredFixture();
    if (!fixture) return jsonResponse(responseFor(undefined, now));
    await refreshProviderState(fixture, now);
    fixture = await nextStoredFixture();
    return jsonResponse(responseFor(fixture, now));
  } catch (error) {
    console.error("Unable to load matchday state", error);
    if (view === "motm-announcement") return automationResponse({ error: "Announcement check failed" }, 500);
    try { return jsonResponse(responseFor(await nextStoredFixture(), now)); }
    catch { return jsonResponse({ match: null, message: "De volgende wedstrijd is nog niet bekend.", updatedAt: now.toISOString() }); }
  }
}
