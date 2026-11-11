const FOTMOB_HOSTS = new Set(["fotmob.com", "www.fotmob.com"]);

export const FOTMOB_AJAX_TEAM_ID = 8593;

export type FotMobSocialsTeamStats = {
  possession: number | null;
  xg: number | null;
  xgot: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  passes: number | null;
  accuratePasses: number | null;
  passAccuracy: number | null;
  bigChances: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
};

export type FotMobShot = {
  id: number | null; eventType: string | null; playerId: number | null; playerName: string | null;
  minute: number | null; x: number | null; y: number | null; shotType: string | null;
  expectedGoals: number | null; expectedGoalsOnTarget: number | null; isOnTarget: boolean | null;
};

export type FotMobApiData = {
  source: "fotmob-api"; matchId: number; fetchedAt: string;
  events: any[]; shots: FotMobShot[]; lineups: any;
  formations: { home: string | null; away: string | null };
  teamStatsByPeriod: any;
  raw: any;
};

export type FotMobSocialsMatch = {
  match: {
    fotmobId: number | null;
    homeTeam: string | null;
    awayTeam: string | null;
    homeScore: number | null;
    awayScore: number | null;
    date: string | null;
    finished?: boolean;
  };
  teamStats: FotMobSocialsTeamStats;
  opponentTeamStats: FotMobSocialsTeamStats;
  players: Array<{
    fotmobId: number | null;
    optaId: number | null;
    name: string | null;
    minutes: number | null;
    goals: number | null;
    assists: number | null;
    xg: number | null;
    xa: number | null;
    xgot: number | null;
    shots: number | null;
    shotsOnTarget: number | null;
    chancesCreated: number | null;
    passes: number | null;
    accuratePasses: number | null;
    passAccuracy: number | null;
    tackles: number | null;
    interceptions: number | null;
    recoveries: number | null;
    groundDuelsWon: number | null;
    aerialDuelsWon: number | null;
    duelsWon: number | null;
    rating: number | null;
  }>;
  fotmobApi?: FotMobApiData;
};

type JsonObject = Record<string, unknown>;

export class FotMobParserError extends Error {}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const objectValue = (value: unknown): JsonObject | null => isObject(value) ? value : null;
const arrayValue = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const nullableInteger = (value: unknown): number | null => {
  const parsed = nullableNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
};

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const firstNumber = (value: unknown): number | null => {
  if (typeof value === "number") return nullableNumber(value);
  if (typeof value !== "string") return null;
  const match = value.match(/-?\d+(?:[.,]\d+)?/);
  return match ? nullableNumber(match[0].replace(",", ".")) : null;
};

const percentage = (accurate: number | null, total: number | null): number | null => {
  if (accurate === null || total === null || total <= 0) return null;
  return Math.round((accurate / total) * 1000) / 10;
};

const extractNextData = (html: string): JsonObject => {
  const script = html.match(/<script\b[^>]*\bid=(?:"__NEXT_DATA__"|'__NEXT_DATA__')[^>]*>([\s\S]*?)<\/script>/i);
  if (!script) throw new FotMobParserError("FotMob __NEXT_DATA__ ontbreekt in de wedstrijdpagina.");
  try {
    const parsed: unknown = JSON.parse(script[1]);
    if (!isObject(parsed)) throw new Error("geen object");
    return parsed;
  } catch {
    throw new FotMobParserError("FotMob __NEXT_DATA__ bevat geen geldige JSON.");
  }
};

const teamStatValue = (content: JsonObject, key: string, teamIndex: number): unknown => {
  const stats = objectValue(content.stats);
  const periods = objectValue(stats?.Periods);
  const all = objectValue(periods?.All);
  for (const groupValue of arrayValue(all?.stats)) {
    const group = objectValue(groupValue);
    for (const rowValue of arrayValue(group?.stats)) {
      const row = objectValue(rowValue);
      if (row?.key !== key || row.type === "title") continue;
      const values = arrayValue(row.stats);
      if (values[teamIndex] !== null && values[teamIndex] !== undefined) return values[teamIndex];
    }
  }
  return null;
};

const playerStat = (player: JsonObject, key: string): JsonObject | null => {
  for (const groupValue of arrayValue(player.stats)) {
    const group = objectValue(groupValue);
    const fields = objectValue(group?.stats);
    if (!fields) continue;
    for (const fieldValue of Object.values(fields)) {
      const field = objectValue(fieldValue);
      if (field?.key === key) return objectValue(field.stat);
    }
  }
  return null;
};

const playerStatNumber = (player: JsonObject, key: string, property: "value" | "total" = "value") =>
  nullableNumber(playerStat(player, key)?.[property]);

const parsedTeamStats = (content: JsonObject, teamIndex: number): FotMobSocialsTeamStats => {
  const accuratePasses = firstNumber(teamStatValue(content, "accurate_passes", teamIndex));
  const passes = nullableNumber(teamStatValue(content, "passes", teamIndex));
  return {
    possession: nullableNumber(teamStatValue(content, "BallPossesion", teamIndex)),
    xg: nullableNumber(teamStatValue(content, "expected_goals", teamIndex)),
    xgot: nullableNumber(teamStatValue(content, "expected_goals_on_target", teamIndex)),
    shots: nullableNumber(teamStatValue(content, "total_shots", teamIndex)),
    shotsOnTarget: nullableNumber(teamStatValue(content, "ShotsOnTarget", teamIndex)),
    corners: nullableNumber(teamStatValue(content, "corners", teamIndex)),
    passes,
    accuratePasses,
    passAccuracy: percentage(accuratePasses, passes),
    bigChances: nullableNumber(teamStatValue(content, "big_chance", teamIndex)),
    fouls: nullableNumber(teamStatValue(content, "fouls", teamIndex)),
    yellowCards: nullableNumber(teamStatValue(content, "yellow_cards", teamIndex)),
    redCards: nullableNumber(teamStatValue(content, "red_cards", teamIndex)),
  };
};

const shotFrom = (value: unknown): FotMobShot => {
  const shot = objectValue(value);
  return {
    id: nullableInteger(shot?.id), eventType: nullableString(shot?.eventType), playerId: nullableInteger(shot?.playerId),
    playerName: nullableString(shot?.playerName), minute: nullableInteger(shot?.min), x: nullableNumber(shot?.x), y: nullableNumber(shot?.y),
    shotType: nullableString(shot?.shotType), expectedGoals: nullableNumber(shot?.expectedGoals),
    expectedGoalsOnTarget: nullableNumber(shot?.expectedGoalsOnTarget), isOnTarget: typeof shot?.isOnTarget === "boolean" ? shot.isOnTarget : null,
  };
};

const parseFotMobApiPayload = (payload: JsonObject, now: () => Date): FotMobApiData | null => {
  const general = objectValue(payload.general), content = objectValue(payload.content), id = nullableInteger(general?.matchId);
  if (!content || id === null) return null;
  const lineup = objectValue(content.lineup), home = objectValue(lineup?.homeTeam), away = objectValue(lineup?.awayTeam);
  const periods = objectValue(objectValue(content.stats)?.Periods);
  return {
    source: "fotmob-api", matchId: id, fetchedAt: now().toISOString(), events: arrayValue(objectValue(content.matchFacts)?.events),
    shots: arrayValue(objectValue(content.shotmap)?.shots).map(shotFrom), lineups: content.lineup ?? null,
    formations: { home: nullableString(home?.formation), away: nullableString(away?.formation) },
    teamStatsByPeriod: periods ?? {}, raw: payload,
  };
};

export const parseFotMobAjaxMatchHtml = (html: string): FotMobSocialsMatch => {
  const nextData = extractNextData(html);
  const props = objectValue(nextData.props);
  const pageProps = objectValue(props?.pageProps);
  const general = objectValue(pageProps?.general);
  const header = objectValue(pageProps?.header);
  const content = objectValue(pageProps?.content);
  if (!general || !header || !content) {
    throw new FotMobParserError("FotMob wedstrijddata heeft niet de verwachte hoofdstructuur.");
  }

  const homeTeam = objectValue(general.homeTeam);
  const awayTeam = objectValue(general.awayTeam);
  const homeTeamId = nullableInteger(homeTeam?.id);
  const awayTeamId = nullableInteger(awayTeam?.id);
  const ajaxIndex = homeTeamId === FOTMOB_AJAX_TEAM_ID ? 0 : awayTeamId === FOTMOB_AJAX_TEAM_ID ? 1 : null;
  if (ajaxIndex === null) throw new FotMobParserError("De FotMob-wedstrijd bevat Ajax niet.");

  const headerTeams = arrayValue(header.teams).map(objectValue).filter((team): team is JsonObject => team !== null);
  const scoreFor = (teamId: number | null) => nullableNumber(headerTeams.find(team => nullableInteger(team.id) === teamId)?.score);

  const rawPlayers = objectValue(content.playerStats);
  const players = Object.values(rawPlayers ?? {}).flatMap(playerValue => {
    const player = objectValue(playerValue);
    if (!player || nullableInteger(player.teamId) !== FOTMOB_AJAX_TEAM_ID) return [];
    const playerPasses = playerStatNumber(player, "accurate_passes", "total");
    const playerAccuratePasses = playerStatNumber(player, "accurate_passes");
    return [{
      fotmobId: nullableInteger(player.id),
      optaId: nullableInteger(player.optaId),
      name: nullableString(player.name),
      minutes: playerStatNumber(player, "minutes_played"),
      goals: playerStatNumber(player, "goals"),
      assists: playerStatNumber(player, "assists"),
      xg: playerStatNumber(player, "expected_goals"),
      xa: playerStatNumber(player, "expected_assists"),
      xgot: playerStatNumber(player, "expected_goals_on_target_variant"),
      shots: playerStatNumber(player, "total_shots"),
      shotsOnTarget: playerStatNumber(player, "ShotsOnTarget"),
      chancesCreated: playerStatNumber(player, "chances_created"),
      passes: playerPasses,
      accuratePasses: playerAccuratePasses,
      passAccuracy: percentage(playerAccuratePasses, playerPasses),
      tackles: playerStatNumber(player, "matchstats.headers.tackles"),
      interceptions: playerStatNumber(player, "interceptions"),
      recoveries: playerStatNumber(player, "recoveries"),
      groundDuelsWon: playerStatNumber(player, "ground_duels_won"),
      aerialDuelsWon: playerStatNumber(player, "aerials_won"),
      duelsWon: playerStatNumber(player, "duel_won"),
      rating: playerStatNumber(player, "rating_title"),
    }];
  });

  return {
    match: {
      fotmobId: nullableInteger(general.matchId),
      homeTeam: nullableString(homeTeam?.name),
      awayTeam: nullableString(awayTeam?.name),
      homeScore: scoreFor(homeTeamId),
      awayScore: scoreFor(awayTeamId),
      date: nullableString(general.matchTimeUTCDate) ?? nullableString(objectValue(header.status)?.utcTime),
      finished: objectValue(header.status)?.finished === true,
    },
    teamStats: parsedTeamStats(content, ajaxIndex),
    opponentTeamStats: parsedTeamStats(content, ajaxIndex === 0 ? 1 : 0),
    players,
  };
};

type FetchOptions = { fetcher?: typeof fetch };

export const fetchFotMobAjaxMatch = async (url: string, options: FetchOptions = {}) => {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" || !FOTMOB_HOSTS.has(parsedUrl.hostname)) {
    throw new FotMobParserError("Alleen publieke HTTPS-wedstrijdpagina's van FotMob zijn toegestaan.");
  }
  const response = await (options.fetcher ?? fetch)(parsedUrl, {
    headers: { accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new FotMobParserError(`FotMob antwoordde met HTTP ${response.status}.`);
  const parsed = parseFotMobAjaxMatchHtml(await response.text());
  const matchId = parsed.match.fotmobId;
  if (matchId === null) return parsed;
  try {
    const api = await fetchFotMobMatchDetails(matchId, options);
    return api ? { ...parsed, fotmobApi: api } : parsed;
  } catch {
    return parsed;
  }
};

export const fetchFotMobMatchDetails = async (matchId: number, options: FetchOptions & { now?: () => Date } = {}) => {
  if (!Number.isInteger(matchId) || matchId <= 0) throw new FotMobParserError("Ongeldig FotMob-wedstrijd-ID.");
  const response = await (options.fetcher ?? fetch)(`https://www.fotmob.com/api/data/matchDetails?matchId=${encodeURIComponent(matchId)}`, {
    headers: { accept: "application/json, text/plain, */*", referer: "https://www.fotmob.com/" }, redirect: "follow", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new FotMobParserError(`FotMob API antwoordde met HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  const parsed = parseFotMobApiPayload(objectValue(payload) ?? {}, options.now ?? (() => new Date()));
  if (!parsed) throw new FotMobParserError("FotMob API antwoordde zonder geldige matchDetails-structuur.");
  return parsed;
};
