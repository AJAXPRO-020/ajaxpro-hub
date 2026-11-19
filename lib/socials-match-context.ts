import { db } from "./motm-db";

export type SocialMatchdayFixture = {
  fixture_key: string;
  home_team: string;
  away_team: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  competition: string;
  kickoff_at: Date | string;
  provider_status: string | null;
  goals_home: number | null;
  goals_away: number | null;
  finished_at: Date | string | null;
};

const resolveLogo = async (name: string): Promise<string | null> => {
  const [row] = await db()`SELECT logo_path FROM resolve_club_logo(${name}) LIMIT 1`;
  return row?.logo_path ? String(row.logo_path) : null;
};

export const withSocialClubLogos = async (fixtures: SocialMatchdayFixture[], resolve = resolveLogo): Promise<SocialMatchdayFixture[]> => {
  const logos = new Map<string, Promise<string | null>>();
  const logoFor = (name: string) => {
    if (!logos.has(name)) logos.set(name, resolve(name).catch(() => null));
    return logos.get(name)!;
  };
  return Promise.all(fixtures.map(async fixture => ({
    ...fixture,
    homeLogo: await logoFor(fixture.home_team),
    awayLogo: await logoFor(fixture.away_team),
  })));
};

export const loadSocialMatchdayFixtures = async (): Promise<SocialMatchdayFixture[]> => {
  const rows = await db()`SELECT fixture_key,home_team,away_team,competition,kickoff_at,provider_status,goals_home,goals_away,finished_at
    FROM matchday_fixtures
    WHERE kickoff_at > now() - interval '14 days'
      AND kickoff_at < now() + interval '14 days'
    ORDER BY kickoff_at ASC`;
  return withSocialClubLogos(rows as unknown as SocialMatchdayFixture[]);
};
