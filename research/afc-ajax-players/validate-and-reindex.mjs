import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const playersDir = path.join(root, 'players');
const files = fs.readdirSync(playersDir).filter(x => x.endsWith('.json')).sort();
const players = files.map(file => JSON.parse(fs.readFileSync(path.join(playersDir, file), 'utf8')));
const meaningful = p => (p.statistics ?? []).some(table => (table.rows ?? []).some(row => Object.entries(row).slice(1).some(([, value]) => String(value ?? '').trim() !== '')));
for (const p of players) p.quality.has_statistics = meaningful(p);
fs.writeFileSync(path.join(root, 'players.json'), JSON.stringify({ source: 'https://www.afc-ajax.info/en/overview/soccer-players', collected_at: players[0]?.collected_at ?? null, players }, null, 2) + '\n');
if (!fs.existsSync(path.join(root, 'failed-urls.json'))) fs.writeFileSync(path.join(root, 'failed-urls.json'), '[]\n');
const images = players.flatMap(p => p.media?.images ?? []);
const summary = {
  source_url: 'https://www.afc-ajax.info/en/overview/soccer-players',
  collected_at: players[0]?.collected_at ?? null,
  index_unique_player_links: players.length,
  requested_profiles: players.length,
  complete_profiles: players.length,
  failed_url_entries: JSON.parse(fs.readFileSync(path.join(root, 'failed-urls.json'), 'utf8')).length,
  players_with_statistics: players.filter(meaningful).length,
  players_with_match_tables: players.filter(p => (p.matches ?? []).some(t => (t.rows ?? []).length > 0)).length,
  players_with_any_image_url: players.filter(p => (p.media?.images ?? []).length > 0).length,
  photos_locally_downloaded: images.filter(x => x.downloaded === true).length,
  photos_not_downloaded_rights_unclear: images.filter(x => x.downloaded !== true).length,
  total_statistics_rows: players.reduce((n, p) => n + (p.statistics ?? []).reduce((m, t) => m + (t.rows ?? []).length, 0), 0),
  total_match_rows: players.reduce((n, p) => n + (p.matches ?? []).reduce((m, t) => m + (t.rows ?? []).length, 0), 0),
  detail_pages_per_profile: ['profile', 'statistics', 'matches', 'transfers-and-media'],
  field_availability: {
    name: players.filter(p => p.profile.name).length,
    birth_date: players.filter(p => p.profile.birth_date).length,
    death_date: players.filter(p => p.profile.death_date).length,
    nationality: players.filter(p => p.profile.nationality).length,
    role: players.filter(p => p.profile.roles.length).length,
    last_known_club: players.filter(p => p.profile.last_known_club).length,
    external_links: players.filter(p => p.profile.external_links.length).length,
    http_external_links: players.filter(p => p.profile.external_links.some(x => /^https?:/.test(x.url) && !x.url.includes('html5up.net'))).length,
    wikipedia_links: players.filter(p => p.profile.external_links.some(x => /wikipedia/i.test(x.url))).length
  },
  missing_field_policy: 'null for absent scalar values; empty arrays for absent collections; no inferred dates or zero statistics',
  image_policy: 'AFC-hosted images are not downloaded because no reuse licence was established.'
};
fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
