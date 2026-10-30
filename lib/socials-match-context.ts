import { db } from "./motm-db";

export type SocialMatchdayFixture = {
  fixture_key: string;
  home_team: string;
  away_team: string;
  competition: string;
  kickoff_at: Date | string;
  provider_status: string | null;
  goals_home: number | null;
  goals_away: number | null;
  finished_at: Date | string | null;
};

export const loadSocialMatchdayFixtures = async (): Promise<SocialMatchdayFixture[]> => {
  const rows=await db()`
    WITH recent_finished AS (
      SELECT fixture_key,home_team,away_team,competition,kickoff_at,provider_status,goals_home,goals_away,finished_at
      FROM matchday_fixtures
      WHERE kickoff_at < now()
        AND (finished_at IS NOT NULL OR provider_status IN ('FT','AET','PEN','FINISHED','MATCH_FINISHED'))
      ORDER BY kickoff_at DESC
      LIMIT 2
    ), upcoming AS (
      SELECT fixture_key,home_team,away_team,competition,kickoff_at,provider_status,goals_home,goals_away,finished_at
      FROM matchday_fixtures
      WHERE kickoff_at >= now()
      ORDER BY kickoff_at ASC
      LIMIT 3
    )
    SELECT * FROM recent_finished
    UNION ALL
    SELECT * FROM upcoming
    ORDER BY kickoff_at ASC
  `;
  return rows as unknown as SocialMatchdayFixture[];
};
