import test from 'node:test';
import assert from 'node:assert/strict';
import { missingMotmFixtures } from '../lib/motm-fixture-seeding';
import { isMatchdayCronRequest, parseAjaxFixtures } from '../api/next-match';

const now = new Date('2026-11-26T21:00:00Z');
const fixture = (opponent: string, kickoff_at: string, home_team = 'Ajax') => ({
  home_team, away_team: home_team === 'Ajax' ? opponent : 'Ajax', competition: 'VriendenLoterij Eredivisie', kickoff_at,
});

test('bekende toekomstige wedstrijden worden één keer voorbereid; bestaande en verwijderde stemmingen blijven leidend', () => {
  const feyenoord = fixture('Feyenoord', '2026-11-29T13:30:00Z', 'Feyenoord');
  const denBosch = { ...fixture('FC Den Bosch', '2026-12-03T20:00:00Z'), competition: 'KNVB Beker' };
  const existing = [{ opponent: 'Feyenoord', competition: feyenoord.competition, kickoff_at: feyenoord.kickoff_at, home_or_away: 'away', season_key: '2026-27' }];
  const missing = missingMotmFixtures([feyenoord, denBosch, denBosch, fixture('Verleden', '2026-11-25T13:30:00Z')], existing, now);
  assert.deepEqual(missing.map(row => row.opponent), ['FC Den Bosch']);
  assert.equal(missing[0].seasonKey, '2026-27');
  assert.equal(missing[0].homeOrAway, 'home');
});

test('een verplaatste of hernoemde wedstrijd leidt niet stilzwijgend tot een tweede stemming', () => {
  const existing = [{ opponent: 'FC Utrecht', competition: 'VriendenLoterij Eredivisie', kickoff_at: '2026-12-06T13:30:00Z', home_or_away: 'home', season_key: '2026-27' }];
  assert.deepEqual(missingMotmFixtures([fixture('FC Utrecht', '2026-12-07T13:30:00Z')], existing, now), []);
  assert.deepEqual(missingMotmFixtures([fixture('Utrecht', '2026-12-06T13:30:00Z')], existing, now), []);
});

test('opgeslagen HTML-clubnaam wordt hersteld en oefenwedstrijd telt niet mee voor de stand', () => {
  const [match] = missingMotmFixtures([{ home_team: 'Bayern M&#xFC;nchen', away_team: 'Ajax', competition: 'Vriendschappelijk', kickoff_at: '2027-01-05T17:15:00Z' }], [], now);
  assert.equal(match.opponent, 'Bayern München');
  assert.equal(match.countsForSeason, false);
});

test('alleen de bestaande Vercel-cron met secret mag MOTM-rijen aanmaken', () => {
  const request = (authorization?: string) => new Request('https://ajaxpro.fans/api/next-match?view=program', { headers: authorization ? { authorization } : {} });
  assert.equal(isMatchdayCronRequest(request(), 'secret'), false);
  assert.equal(isMatchdayCronRequest(request('Bearer verkeerd'), 'secret'), false);
  assert.equal(isMatchdayCronRequest(request('Bearer secret'), 'secret'), true);
  assert.equal(isMatchdayCronRequest(request('Bearer secret'), ''), false);
});

test('numerieke HTML-entiteiten in de wedstrijdbron worden als clubnaam gelezen', () => {
  const html = '<li class="matches-block__match"><span class="matches-block__league">Vriendschappelijk</span><span class="matches-block__date">di. 5 januari 2027 18:15</span><div><span class="matches-block__participants">Bayern M&#xFC;nchen - Ajax</span></div></li>';
  assert.equal(parseAjaxFixtures(html)[0]?.home, 'Bayern München');
});
