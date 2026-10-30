import { db } from "./motm-db";
import {
  amsterdamDateKey,
  API_FOOTBALL_AJAX_TEAM_ID,
  API_FOOTBALL_BASE_URL,
  selectProviderFixture,
} from "./matchday-live";
import { seasonKeyFor } from "./motm-season";
import { apiFootballErrorDetails } from "./api-football-observability";

export type SocialPlayerMatchStats = {
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  chancesCreated: number | null;
  passAccuracy: number | null;
  duelsWon: number | null;
};

export type SocialProviderPlayer = {
  providerPlayerId: number;
  name: string;
  photo: string | null;
  stats: SocialPlayerMatchStats;
};

export type SocialPlayerStatsFixture = {
  fixtureKey: string;
  providerFixtureId: number;
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  status: string | null;
};

type StoredFixture = {
  fixture_key: string;
  provider_fixture_id: number | string | null;
  home_team: string;
  away_team: string;
  competition: string;
  kickoff_at: Date | string;
  provider_status: string | null;
};

type ProviderPlayerRow = {
  player?: { id?: unknown; name?: unknown; photo?: unknown };
  statistics?: Array<{
    games?: { minutes?: unknown };
    goals?: { total?: unknown; assists?: unknown };
    shots?: { total?: unknown; on?: unknown };
    passes?: { key?: unknown; accuracy?: unknown };
    duels?: { won?: unknown };
  }>;
};

type ProviderTeamResponse = {
  team?: { id?: unknown; name?: unknown };
  players?: ProviderPlayerRow[];
};

export class SocialPlayerStatsProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const nullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value.replace("%", "")) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const mapApiFootballPlayerStats = (teams: ProviderTeamResponse[]): SocialProviderPlayer[] => {
  const ajax = teams.find(team => Number(team.team?.id) === API_FOOTBALL_AJAX_TEAM_ID);
  return (ajax?.players ?? []).flatMap(row => {
    const providerPlayerId = nullableNumber(row.player?.id);
    const name = typeof row.player?.name === "string" ? row.player.name.trim() : "";
    if (providerPlayerId === null || !Number.isInteger(providerPlayerId) || !name) return [];
    const stats = row.statistics?.[0] ?? {};
    return [{
      providerPlayerId,
      name,
      photo: typeof row.player?.photo === "string" && row.player.photo.startsWith("https://") ? row.player.photo : null,
      stats: {
        minutes: nullableNumber(stats.games?.minutes),
        goals: nullableNumber(stats.goals?.total),
        assists: nullableNumber(stats.goals?.assists),
        shots: nullableNumber(stats.shots?.total),
        shotsOnTarget: nullableNumber(stats.shots?.on),
        chancesCreated: nullableNumber(stats.passes?.key),
        passAccuracy: nullableNumber(stats.passes?.accuracy),
        duelsWon: nullableNumber(stats.duels?.won),
      },
    }];
  });
};

const loadFixture = async (fixtureKey: string): Promise<StoredFixture | null> => {
  const [fixture] = await db()`SELECT fixture_key,provider_fixture_id,home_team,away_team,competition,kickoff_at,provider_status
    FROM matchday_fixtures WHERE fixture_key=${fixtureKey} LIMIT 1`;
  return fixture as StoredFixture | undefined ?? null;
};

type LoaderOptions = {
  apiKey?: string;
  fetcher?: typeof fetch;
  fixtureLoader?: (fixtureKey: string) => Promise<StoredFixture | null>;
};

const providerRequest = async (url: string, apiKey: string, fetcher: typeof fetch, operation: "fixture" | "player-stats") => {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { "x-apisports-key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("API-Football Socials request failed", { operation, ...apiFootballErrorDetails(error) });
    throw error;
  }
  if (!response.ok) {
    console.error("API-Football Socials request failed", apiFootballErrorDetails(new Error(`HTTP ${response.status}`), response));
    throw new SocialPlayerStatsProviderError(`De statistiekenprovider antwoordde met ${response.status}.`, 502);
  }
  const payload = await response.json();
  if (payload?.errors && Object.keys(payload.errors).length) {
    const messages=Object.values(payload.errors).filter((value):value is string=>typeof value==="string");
    console.error("API-Football request rejected",{operation,...apiFootballErrorDetails(new Error("API-Football returned provider errors"), response, payload.errors),errorTypes:Object.keys(payload.errors)});
    const joined=messages.join(" ").toLowerCase();
    if(joined.includes("plan")||joined.includes("subscription"))throw new SocialPlayerStatsProviderError("Het huidige API-Football-abonnement geeft geen toegang tot spelerstatistieken.",502);
    if(joined.includes("request")||joined.includes("limit"))throw new SocialPlayerStatsProviderError("De daglimiet van API-Football is bereikt.",429);
    throw new SocialPlayerStatsProviderError(`De statistiekenprovider kon de ${operation==="fixture"?"wedstrijd":"spelerstatistieken"} niet leveren.`, 502);
  }
  return Array.isArray(payload?.response) ? payload.response : [];
};

const resolveProviderFixtureId = async (fixture: StoredFixture, apiKey: string, fetcher: typeof fetch) => {
  const storedId = nullableNumber(fixture.provider_fixture_id);
  if (storedId !== null && Number.isInteger(storedId)) return storedId;
  const date = amsterdamDateKey(new Date(fixture.kickoff_at));
  const season = seasonKeyFor(fixture.kickoff_at).slice(0, 4);
  const candidates = await providerRequest(
    `${API_FOOTBALL_BASE_URL}/fixtures?team=${API_FOOTBALL_AJAX_TEAM_ID}&season=${season}&date=${date}&timezone=Europe%2FAmsterdam`,
    apiKey,
    fetcher,
    "fixture",
  );
  const selected = selectProviderFixture(candidates, {
    home: fixture.home_team,
    away: fixture.away_team,
    kickoff: fixture.kickoff_at,
  });
  if (!selected) throw new SocialPlayerStatsProviderError("Deze wedstrijd is niet bij de statistiekenprovider gevonden.", 404);
  return selected.fixture.id;
};

export const loadSocialPlayerStats = async (fixtureKey: string, options: LoaderOptions = {}) => {
  const normalizedKey = fixtureKey.trim();
  if (!normalizedKey || normalizedKey.length > 300) throw new SocialPlayerStatsProviderError("Ongeldige wedstrijd.", 400);
  const fixture = await (options.fixtureLoader ?? loadFixture)(normalizedKey);
  if (!fixture) throw new SocialPlayerStatsProviderError("Wedstrijd niet gevonden.", 404);
  const apiKey = options.apiKey ?? process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) throw new SocialPlayerStatsProviderError("Spelerstatistieken zijn niet geconfigureerd.", 503);
  const fetcher = options.fetcher ?? fetch;
  const providerFixtureId = await resolveProviderFixtureId(fixture, apiKey, fetcher);
  const teams = await providerRequest(`${API_FOOTBALL_BASE_URL}/fixtures/players?fixture=${providerFixtureId}`, apiKey, fetcher, "player-stats") as ProviderTeamResponse[];
  return {
    fixture: {
      fixtureKey: fixture.fixture_key,
      providerFixtureId,
      home: fixture.home_team,
      away: fixture.away_team,
      competition: fixture.competition,
      kickoff: new Date(fixture.kickoff_at).toISOString(),
      status: fixture.provider_status,
    } satisfies SocialPlayerStatsFixture,
    players: mapApiFootballPlayerStats(teams),
    updatedAt: new Date().toISOString(),
  };
};
