import postgres from 'postgres';

const source = postgres(process.env.SOURCE_DATABASE_URL, { max: 4, prepare: false });
const target = postgres(process.env.TARGET_DATABASE_URL, { max: 4, prepare: false });
const chunkSize = 500;

const ddl = [
`CREATE TABLE IF NOT EXISTS clean_players (local_id text PRIMARY KEY, slug text, name text, full_name text, birth_date text, death_date text, nationality jsonb, roles jsonb, ajax_club text, last_known_club text, profile jsonb NOT NULL, source_url text NOT NULL UNIQUE, collected_at timestamptz NOT NULL, raw jsonb NOT NULL)`,
`CREATE TABLE IF NOT EXISTS clean_sources (source_url text PRIMARY KEY, source_name text, source_type text, first_seen_at timestamptz NOT NULL, metadata jsonb NOT NULL)`,
`CREATE TABLE IF NOT EXISTS clean_statistics (player_local_id text PRIMARY KEY REFERENCES clean_players(local_id), caption text, headers jsonb NOT NULL, rows jsonb NOT NULL, raw_row_count integer NOT NULL)`,
`CREATE TABLE IF NOT EXISTS clean_statistic_rows (id bigserial PRIMARY KEY, player_local_id text NOT NULL REFERENCES clean_players(local_id), section text, row jsonb NOT NULL, UNIQUE(player_local_id, section, row))`,
`CREATE TABLE IF NOT EXISTS clean_career_relations (id bigserial PRIMARY KEY, player_local_id text NOT NULL REFERENCES clean_players(local_id), relation_type text NOT NULL, relation jsonb NOT NULL, UNIQUE(player_local_id, relation_type, relation))`,
`CREATE TABLE IF NOT EXISTS clean_images (url text PRIMARY KEY, player_local_id text NOT NULL REFERENCES clean_players(local_id), object_key text, local_path text, bytes bigint, sha256 text, mime_type text, source_rights text, download_status text, raw jsonb NOT NULL)`,
`CREATE TABLE IF NOT EXISTS matches (match_id text PRIMARY KEY, season text, match_date text, description text, competition text, raw jsonb NOT NULL, source_record_count integer NOT NULL, player_count integer NOT NULL)`,
`CREATE TABLE IF NOT EXISTS match_source_records (id bigserial PRIMARY KEY, match_id text NOT NULL REFERENCES matches(match_id), player_local_id text NOT NULL REFERENCES clean_players(local_id), source_match_key text NOT NULL, source_record jsonb NOT NULL)`,
`CREATE UNIQUE INDEX IF NOT EXISTS match_source_records_unique_idx ON match_source_records(match_id, player_local_id, source_match_key)`,
`CREATE TABLE IF NOT EXISTS player_matches (player_local_id text NOT NULL REFERENCES clean_players(local_id), match_id text NOT NULL REFERENCES matches(match_id), player_data jsonb NOT NULL, source_record_count integer NOT NULL, PRIMARY KEY(player_local_id, match_id))`,
`CREATE INDEX IF NOT EXISTS matches_season_date_idx ON matches(season, match_date)`,
`CREATE INDEX IF NOT EXISTS player_matches_match_idx ON player_matches(match_id)`,
`CREATE INDEX IF NOT EXISTS match_source_records_player_idx ON match_source_records(player_local_id)`
];

const tables = [
  ['clean_players', ['local_id','slug','name','full_name','birth_date','death_date','nationality','roles','ajax_club','last_known_club','profile','source_url','collected_at','raw'], 'local_id'],
  ['clean_sources', ['source_url','source_name','source_type','first_seen_at','metadata'], 'source_url'],
  ['clean_statistics', ['player_local_id','caption','headers','rows','raw_row_count'], 'player_local_id'],
  ['clean_statistic_rows', ['player_local_id','section','row'], null],
  ['clean_career_relations', ['player_local_id','relation_type','relation'], null],
  ['clean_images', ['url','player_local_id','object_key','local_path','bytes','sha256','mime_type','source_rights','download_status','raw'], 'url'],
  ['matches', ['match_id','season','match_date','description','competition','raw','source_record_count','player_count'], 'match_id'],
  ['match_source_records', ['match_id','player_local_id','source_match_key','source_record'], null],
  ['player_matches', ['player_local_id','match_id','player_data','source_record_count'], null]
];

async function copyTable(name, columns) {
  const rows = await source.unsafe(`SELECT ${columns.join(',')} FROM ${name}`);
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize);
    if (!batch.length) continue;
    const values = batch.map(row => columns.map(c => row[c]));
    await target`INSERT INTO ${target(name)} (${target(columns)}) VALUES ${target(values)} ON CONFLICT DO NOTHING`;
    process.stdout.write(`${name}: ${Math.min(i + batch.length, rows.length)}/${rows.length}\n`);
  }
}

try {
  await target.begin(async sql => { for (const statement of ddl) await sql.unsafe(statement); });
  for (const [name, columns] of tables) await copyTable(name, columns);
  await target.end({ timeout: 5 });
  await source.end({ timeout: 5 });
} catch (error) {
  console.error(error.stack || error.message);
  await target.end({ timeout: 5 }).catch(() => {});
  await source.end({ timeout: 5 }).catch(() => {});
  process.exitCode = 1;
}
