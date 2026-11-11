import { teamNamesMatch } from "./team-name-match";
import type { SocialMatchdayFixture } from "./socials-match-context";

const SOFASCORE_ORIGIN = "https://www.sofascore.com";
const SOFASCORE_AJAX_TEAM_ID = 2953;
const SOFASCORE_HOSTS = new Set(["sofascore.com", "www.sofascore.com"]);

type JsonObject = Record<string, unknown>;

export type SofaScorePlayer = {
  providerPlayerId: number | null;
  teamId: number | null;
  name: string | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  xg: number | null;
  xa: number | null;
  keyPasses: number | null;
  totalPasses: number | null;
  accuratePasses: number | null;
  tackles: number | null;
  interceptions: number | null;
  recoveries: number | null;
  duelsWon: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  progressiveBallCarries: number | null;
  progressiveBallCarryDistance: number | null;
  rating: number | null;
};

export type SofaScoreSnapshot = {
  provider: "sofascore";
  providerMatchId: number;
  customId: string | null;
  fetchedAt: string;
  match: { homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null; startTimestamp: number | null; status: string | null };
  lineups: { homeFormation: string | null; awayFormation: string | null; players: SofaScorePlayer[] };
  players: SofaScorePlayer[];
  incidents: unknown[];
  statistics: unknown;
  sourceEndpoints: string[];
  raw: { event: JsonObject; lineups: JsonObject; statistics: JsonObject; incidents: JsonObject };
};

export class SofaScoreError extends Error {
  constructor(message: string, readonly status = 502, options?: ErrorOptions) { super(message, options); }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type ImportOptions = { fetcher?: Fetcher; now?: () => Date };

const objectValue = (value: unknown): JsonObject | null => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : null;
const arrayValue = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const stringValue = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const numberValue = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const integerValue = (value: unknown): number | null => {
  const parsed = numberValue(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
};

const playerFrom = (value: unknown, teamId: unknown): SofaScorePlayer | null => {
  const row = objectValue(value), player = objectValue(row?.player), stats = objectValue(row?.statistics);
  if (!player) return null;
  const stat = (key: string) => numberValue(stats?.[key]);
  return {
    providerPlayerId: integerValue(player.id), teamId: integerValue(row?.teamId ?? teamId), name: stringValue(player.name),
    minutes: stat("minutesPlayed"), goals: stat("goals"), assists: stat("goalAssist"), xg: stat("expectedGoals"), xa: stat("expectedAssists"),
    keyPasses: stat("keyPass"), totalPasses: stat("totalPass"), accuratePasses: stat("accuratePass"), tackles: stat("totalTackle"),
    interceptions: stat("interceptionWon"), recoveries: stat("ballRecovery"), duelsWon: stat("duelWon"), shots: stat("totalShots"),
    shotsOnTarget: stat("onTargetScoringAttempt"), progressiveBallCarries: stat("progressiveBallCarriesCount"),
    progressiveBallCarryDistance: stat("totalProgressiveBallCarriesDistance"), rating: stat("rating"),
  };
};

const requestJson = async (url: string, fetcher: Fetcher): Promise<JsonObject> => {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !SOFASCORE_HOSTS.has(parsed.hostname)) throw new SofaScoreError("Ongeldige SofaScore-bron.", 400);
  let response: Response;
  try { response = await fetcher(parsed, { headers: { accept: "application/json" }, redirect: "follow", signal: AbortSignal.timeout(15_000) }); }
  catch (error) { throw new SofaScoreError("SofaScore is tijdelijk niet bereikbaar.", 502, { cause: error }); }
  if (!response.ok) throw new SofaScoreError(`SofaScore antwoordde met HTTP ${response.status}.`, response.status === 404 ? 404 : 502);
  let value: unknown;
  try { value = await response.json(); } catch (error) { throw new SofaScoreError("SofaScore antwoordde geen geldige JSON.", 502, { cause: error }); }
  const object = objectValue(value);
  if (!object) throw new SofaScoreError("SofaScore antwoordde geen JSON-object.", 502);
  return object;
};

const teamMatches = (value: unknown, expected: string) => {
  const team = objectValue(value);
  return Boolean(team && typeof team.name === "string" && teamNamesMatch(team.name, expected));
};

export const resolveSofaScoreMatch = async (fixture: Pick<SocialMatchdayFixture, "home_team" | "away_team" | "kickoff_at">, options: ImportOptions = {}) => {
  const date = new Date(fixture.kickoff_at).toISOString().slice(0, 10);
  const endpoint = `${SOFASCORE_ORIGIN}/api/v1/sport/football/scheduled-events/${date}`;
  const payload = await requestJson(endpoint, options.fetcher ?? fetch);
  const candidates = arrayValue(payload.events).map(objectValue).filter((event): event is JsonObject => Boolean(event))
    .filter(event => teamMatches(event.homeTeam, fixture.home_team) && teamMatches(event.awayTeam, fixture.away_team));
  if (candidates.length === 0) throw new SofaScoreError("SofaScore-wedstrijd niet gevonden.", 404);
  if (candidates.length > 1) throw new SofaScoreError("Meerdere SofaScore-wedstrijden gevonden.", 409);
  const event = candidates[0], id = integerValue(event.id);
  if (id === null) throw new SofaScoreError("SofaScore-wedstrijd mist een stabiel ID.", 502);
  return { eventId: id, customId: stringValue(event.customId), event, endpoint };
};

export const importSofaScoreMatch = async (fixture: SocialMatchdayFixture, options: ImportOptions = {}): Promise<SofaScoreSnapshot> => {
  const resolved = await resolveSofaScoreMatch(fixture, options);
  const base = `${SOFASCORE_ORIGIN}/api/v1/event/${resolved.eventId}`;
  const [lineups, statistics, incidents] = await Promise.all([
    requestJson(`${base}/lineups`, options.fetcher ?? fetch),
    requestJson(`${base}/statistics`, options.fetcher ?? fetch),
    requestJson(`${base}/incidents`, options.fetcher ?? fetch),
  ]);
  const event = resolved.event, home = objectValue(event.homeTeam), away = objectValue(event.awayTeam), lineupHome = objectValue(lineups.home), lineupAway = objectValue(lineups.away);
  const players = [...arrayValue(lineupHome?.players).map(value => playerFrom(value, home?.id)), ...arrayValue(lineupAway?.players).map(value => playerFrom(value, away?.id))].filter((value): value is SofaScorePlayer => Boolean(value));
  return {
    provider: "sofascore", providerMatchId: resolved.eventId, customId: resolved.customId, fetchedAt: (options.now ?? (() => new Date()))().toISOString(),
    match: { homeTeam: stringValue(home?.name) ?? fixture.home_team, awayTeam: stringValue(away?.name) ?? fixture.away_team, homeScore: integerValue(objectValue(event.homeScore)?.current), awayScore: integerValue(objectValue(event.awayScore)?.current), startTimestamp: integerValue(event.startTimestamp), status: stringValue(objectValue(event.status)?.type) },
    lineups: { homeFormation: stringValue(lineupHome?.formation), awayFormation: stringValue(lineupAway?.formation), players },
    players, incidents: arrayValue(incidents.incidents), statistics: statistics.statistics ?? statistics, sourceEndpoints: [resolved.endpoint, `${base}/lineups`, `${base}/statistics`, `${base}/incidents`],
    raw: { event, lineups, statistics, incidents },
  };
};
