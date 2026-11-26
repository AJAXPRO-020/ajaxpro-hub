import { db } from './motm-db';
import { defaultSchedule } from './motm-rules';
import { seasonKeyFor } from './motm-season';

export type MotmFixture = {
  home_team: string;
  away_team: string;
  competition: string;
  kickoff_at: Date | string;
};

type ExistingMotmMatch = {
  opponent: string;
  competition: string;
  kickoff_at: Date | string;
  home_or_away: string;
  season_key: string;
};

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL').replace(/[^a-z0-9]/g, '');
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50);
const decodeNumericEntities = (value: string) => value.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (entity, hex: string | undefined, decimal: string | undefined) => {
  const code = Number.parseInt(hex ?? decimal ?? '', hex ? 16 : 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
});

export const missingMotmFixtures = (fixtures: MotmFixture[], existing: ExistingMotmMatch[], now = new Date()) => {
  const covered = [...existing];
  const missing: Array<{ opponent: string; competition: string; kickoff: Date; homeOrAway: 'home' | 'away'; seasonKey: string; countsForSeason: boolean }> = [];
  for (const fixture of fixtures) {
    const home = decodeNumericEntities(fixture.home_team.trim()), away = decodeNumericEntities(fixture.away_team.trim());
    if ((home === 'Ajax') === (away === 'Ajax')) continue;
    const kickoff = new Date(fixture.kickoff_at);
    if (!Number.isFinite(kickoff.getTime()) || kickoff <= now || !fixture.competition.trim()) continue;
    const homeOrAway = home === 'Ajax' ? 'home' : 'away';
    const opponent = homeOrAway === 'home' ? away : home;
    const seasonKey = seasonKeyFor(kickoff);
    const competition = decodeNumericEntities(fixture.competition.trim());
    if (covered.some(match => match.season_key === seasonKey && match.home_or_away === homeOrAway && (
      new Date(match.kickoff_at).getTime() === kickoff.getTime() ||
      (normalized(match.opponent) === normalized(opponent) && normalized(match.competition) === normalized(competition))
    ))) continue;
    missing.push({ opponent, competition, kickoff, homeOrAway, seasonKey, countsForSeason: !normalized(competition).includes('vriendschappelijk') });
    covered.push({ opponent, competition, kickoff_at: kickoff, home_or_away: homeOrAway, season_key: seasonKey });
  }
  return missing;
};

export const seedMotmFromCurrentFixtures = async (now = new Date()) => {
  const sql = db();
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('ajaxpro:motm-fixture-seeding'))`;
    const [latest] = await tx`SELECT max(source_checked_at) AS checked_at FROM matchday_fixtures`;
    if (!latest?.checked_at || now.getTime() - new Date(latest.checked_at).getTime() > 48 * 60 * 60_000) return { created: 0, reason: 'fixture_source_stale' };
    const fixtures = await tx`SELECT home_team,away_team,competition,kickoff_at FROM matchday_fixtures WHERE source_checked_at=${latest.checked_at} AND kickoff_at>${now} ORDER BY kickoff_at`;
    const existing = await tx`SELECT opponent,competition,kickoff_at,home_or_away,season_key FROM motm_matches`;
    const missing = missingMotmFixtures(
      fixtures.map(row => ({ home_team: String(row.home_team), away_team: String(row.away_team), competition: String(row.competition), kickoff_at: row.kickoff_at as Date })),
      existing.map(row => ({ opponent: String(row.opponent), competition: String(row.competition), kickoff_at: row.kickoff_at as Date, home_or_away: String(row.home_or_away), season_key: String(row.season_key) })),
      now,
    );
    if (!missing.length) return { created: 0, reason: 'up_to_date' };
    const [selection] = await tx`SELECT count(*)::int AS count FROM ajax_players WHERE active=true AND selection_group='first_team' AND NOT COALESCE(loaned_out,false) AND contract_form IS DISTINCT FROM 'no_contract'`;
    if (!selection?.count) throw new Error('MOTM-standaardselectie is leeg; automatische aanmaak overgeslagen');
    for (const fixture of missing) {
      const schedule = defaultSchedule(fixture.kickoff);
      const slug = `${slugify(fixture.opponent)}-${fixture.kickoff.toISOString().slice(0,10)}-${crypto.randomUUID().slice(0,6)}`;
      const [match] = await tx`INSERT INTO motm_matches(slug,opponent,competition,kickoff_at,home_or_away,season,season_key,counts_for_season,status,created_by_discord_user_id,scheduled_open_at,scheduled_close_at)
        VALUES(${slug},${fixture.opponent},${fixture.competition},${fixture.kickoff},${fixture.homeOrAway},${fixture.seasonKey},${fixture.seasonKey},${fixture.countsForSeason},'draft','system:fixture-import',${schedule.openAt},${schedule.closeAt}) RETURNING id`;
      await tx`INSERT INTO motm_match_players(match_id,player_id,name_snapshot,shirt_number_snapshot,position_snapshot,image_url_snapshot)
        SELECT ${match.id},id,name,shirt_number,position,image_url FROM ajax_players
        WHERE active=true AND selection_group='first_team' AND NOT COALESCE(loaned_out,false) AND contract_form IS DISTINCT FROM 'no_contract'`;
      await tx`INSERT INTO motm_audit_log(match_id,actor_discord_user_id,actor_username_snapshot,action,after_data)
        VALUES(${match.id},'system:fixture-import','Automatische wedstrijddata','created',${tx.json({ status: 'draft', source: 'matchday_fixtures', summary: `${fixture.opponent} · ${fixture.competition}` })})`;
    }
    return { created: missing.length, reason: 'created' };
  });
};
