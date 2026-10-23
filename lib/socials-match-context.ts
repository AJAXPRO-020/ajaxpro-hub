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
    SELECT fixture_key,home_team,away_team,competition,kickoff_at,provider_status,goals_home,goals_away,finished_at
    FROM matchday_fixtures
    WHERE kickoff_at > now() - interval '14 days'
      AND kickoff_at < now() + interval '14 days'
    ORDER BY kickoff_at ASC
  `;
  return rows as unknown as SocialMatchdayFixture[];
};
