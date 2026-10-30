import { FOTMOB_AJAX_TEAM_ID } from "./fotmob-socials-parser";
import { teamNamesMatch } from "./team-name-match";

const FOTMOB_ORIGIN = "https://www.fotmob.com";
const FOTMOB_AJAX_OVERVIEW_URL = `${FOTMOB_ORIGIN}/teams/${FOTMOB_AJAX_TEAM_ID}/overview`;

export type FotMobMatchContext = {
  date: string;
  homeTeam: string;
  awayTeam: string;
};

export type ResolvedFotMobMatch = {
  fotmobId: number;
  url: string;
};

type JsonObject = Record<string, unknown>;
type ResolverOptions = { fetcher?: typeof fetch };

export class FotMobMatchResolverError extends Error {
  constructor(message: string, readonly code: "INVALID_INPUT" | "INVALID_RESPONSE" | "AMBIGUOUS") {
    super(message);
  }
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const objectValue = (value: unknown): JsonObject | null => isObject(value) ? value : null;
const arrayValue = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const integerValue = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
};

const normalizedTeamName = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase("en-US");

const extractNextData = (html: string): JsonObject => {
  const script = html.match(/<script\b[^>]*\bid=(?:"__NEXT_DATA__"|'__NEXT_DATA__')[^>]*>([\s\S]*?)<\/script>/i);
  if (!script) throw new FotMobMatchResolverError("FotMob __NEXT_DATA__ ontbreekt.", "INVALID_RESPONSE");
  try {
    const parsed: unknown = JSON.parse(script[1]);
    if (!isObject(parsed)) throw new Error("geen object");
    return parsed;
  } catch {
    throw new FotMobMatchResolverError("FotMob __NEXT_DATA__ bevat geen geldige JSON.", "INVALID_RESPONSE");
  }
};

const fixtureDate = (fixture: JsonObject): string | null => {
  const utcTime = objectValue(fixture.status)?.utcTime;
  return typeof utcTime === "string" && /^\d{4}-\d{2}-\d{2}T/.test(utcTime) ? utcTime.slice(0, 10) : null;
};

const teamMatches = (teamValue: unknown, expectedName: string, expectedAjax: boolean) => {
  const team = objectValue(teamValue);
  if (!team || typeof team.name !== "string") return false;
  if (expectedAjax && integerValue(team.id) !== FOTMOB_AJAX_TEAM_ID) return false;
  const providerName = normalizedTeamName(team.name);
  const fixtureName = normalizedTeamName(expectedName);
  if (providerName === fixtureName) return true;
  // Fixture administration uses short names (e.g. "Sparta"), while FotMob
  // may expose the official club name (e.g. "Sparta Rotterdam"). Keep this
  // bounded to name containment so we do not introduce a broad fuzzy match.
  return teamNamesMatch(team.name, expectedName);
};

const fixturesFromPage = (html: string): JsonObject[] => {
  const nextData = extractNextData(html);
  const props = objectValue(nextData.props);
  const pageProps = objectValue(props?.pageProps);
  const fallback = objectValue(pageProps?.fallback);
  const team = objectValue(fallback?.[`team-${FOTMOB_AJAX_TEAM_ID}`]);
  const fixtures = objectValue(team?.fixtures);
  const allFixtures = objectValue(fixtures?.allFixtures);
  if (!allFixtures || !Array.isArray(allFixtures.fixtures)) {
    throw new FotMobMatchResolverError("FotMob bevat geen gestructureerde Ajax-wedstrijdlijst.", "INVALID_RESPONSE");
  }
  return arrayValue(allFixtures.fixtures).map(objectValue).filter((fixture): fixture is JsonObject => fixture !== null);
};

const resolvePageUrl = (pageUrl: unknown): string | null => {
  if (typeof pageUrl !== "string" || !pageUrl.startsWith("/matches/")) return null;
  const url = new URL(pageUrl, FOTMOB_ORIGIN);
  url.hash = "";
  return url.toString();
};

export const resolveFotMobMatch = async (
  input: FotMobMatchContext,
  options: ResolverOptions = {},
): Promise<ResolvedFotMobMatch | null> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !input.homeTeam.trim() || !input.awayTeam.trim()) {
    throw new FotMobMatchResolverError("Ongeldige wedstrijdcontext; gebruik datumformaat YYYY-MM-DD.", "INVALID_INPUT");
  }
  const ajaxIsHome = normalizedTeamName(input.homeTeam) === "ajax";
  const ajaxIsAway = normalizedTeamName(input.awayTeam) === "ajax";
  if (ajaxIsHome === ajaxIsAway) return null;

  const response = await (options.fetcher ?? fetch)(FOTMOB_AJAX_OVERVIEW_URL, {
    headers: { accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new FotMobMatchResolverError(`FotMob antwoordde met HTTP ${response.status}.`, "INVALID_RESPONSE");
  }

  const matches = fixturesFromPage(await response.text()).filter(fixture =>
    fixtureDate(fixture) === input.date &&
    teamMatches(fixture.home, input.homeTeam, ajaxIsHome) &&
    teamMatches(fixture.away, input.awayTeam, ajaxIsAway),
  );
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new FotMobMatchResolverError("Meerdere mogelijke FotMob-wedstrijden gevonden voor deze context.", "AMBIGUOUS");
  }

  const fotmobId = integerValue(matches[0].id);
  const url = resolvePageUrl(matches[0].pageUrl);
  if (fotmobId === null || url === null) {
    throw new FotMobMatchResolverError("De gevonden FotMob-wedstrijd mist een stabiel ID of URL.", "INVALID_RESPONSE");
  }
  return { fotmobId, url };
};
