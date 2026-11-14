import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const root = path.resolve(new URL('.', import.meta.url).pathname);
const sql = postgres(process.env.DATABASE_URL, { max: 8, ssl: 'require' });
const q = async (text, values=[]) => sql.unsafe(text, values);
const allFiles = fs.readdirSync(path.join(root, 'players')).filter(f => f.endsWith('.json')).sort();
const start = Number(process.env.IMPORT_START ?? 0);
const end = Number(process.env.IMPORT_END ?? allFiles.length);
const files = allFiles.slice(start, end);
await q(`CREATE TABLE IF NOT EXISTS historical_players (local_id text PRIMARY KEY, slug text UNIQUE NOT NULL, name text, full_name text, birth_date text, death_date text, nationality jsonb, roles jsonb, ajax_club jsonb, last_known_club jsonb, profile jsonb NOT NULL, source_url text NOT NULL, collected_at timestamptz, raw jsonb NOT NULL);`);
await q(`CREATE TABLE IF NOT EXISTS historical_sources (source_url text PRIMARY KEY, source_name text NOT NULL, source_type text, first_seen_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb);`);
await q(`CREATE TABLE IF NOT EXISTS historical_statistics (id bigserial PRIMARY KEY, player_local_id text NOT NULL REFERENCES historical_players(local_id), caption text, headers jsonb, rows jsonb, raw_row_count integer, UNIQUE(player_local_id, caption));`);
await q(`CREATE TABLE IF NOT EXISTS historical_matches (match_key text PRIMARY KEY, date text, competition text, opponent text, result text, raw jsonb NOT NULL);`);
await q(`CREATE TABLE IF NOT EXISTS historical_player_matches (player_local_id text NOT NULL REFERENCES historical_players(local_id), match_key text NOT NULL REFERENCES historical_matches(match_key), raw jsonb NOT NULL, PRIMARY KEY(player_local_id, match_key));`);
await q(`CREATE TABLE IF NOT EXISTS historical_career_relations (id bigserial PRIMARY KEY, player_local_id text NOT NULL REFERENCES historical_players(local_id), relation_type text NOT NULL, relation jsonb NOT NULL, UNIQUE(player_local_id, relation_type, relation));`);
await q(`CREATE TABLE IF NOT EXISTS historical_images (url text PRIMARY KEY, player_local_id text NOT NULL REFERENCES historical_players(local_id), object_key text, local_path text, bytes bigint, sha256 text, mime_type text, source_rights text, download_status text, raw jsonb NOT NULL);`);

let stats=0, matches=0, playerMatches=0, careers=0, images=0;
for (const file of files) {
  const p = JSON.parse(fs.readFileSync(path.join(root, 'players', file), 'utf8'));
  await q(`INSERT INTO historical_players(local_id,slug,name,full_name,birth_date,death_date,nationality,roles,ajax_club,last_known_club,profile,source_url,collected_at,raw) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(local_id) DO UPDATE SET raw=EXCLUDED.raw, profile=EXCLUDED.profile`, [p.local_id,p.slug,p.profile?.name??null,p.profile?.full_name??null,p.profile?.birth_date??null,p.profile?.death_date??null,p.profile?.nationality??null,p.profile?.roles??null,p.profile?.ajax_club??null,p.profile?.last_known_club??null,p.profile??{},p.source_urls?.[0]??null,p.collected_at,p]);
  await q(`INSERT INTO historical_sources(source_url,source_name,source_type,first_seen_at,metadata) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_url) DO NOTHING`, [p.source_urls?.[0]??`local:${p.local_id}`,'AFC-Ajax.info','player_profile',p.collected_at,{local_id:p.local_id}]);
  for (const s of p.statistics??[]) { await q(`INSERT INTO historical_statistics(player_local_id,caption,headers,rows,raw_row_count) VALUES($1,$2,$3,$4,$5) ON CONFLICT(player_local_id,caption) DO UPDATE SET headers=EXCLUDED.headers,rows=EXCLUDED.rows,raw_row_count=EXCLUDED.raw_row_count`,[p.local_id,s.caption??null,s.headers??[],s.rows??[],s.raw_row_count??0]); stats += s.raw_row_count??0; }
  for (const m of p.matches??[]) { const r=m.rows??[]; for (let i=0;i<r.length;i++) { const row=r[i]; const key=`${p.local_id}:${m.caption??'matches'}:${i}:${JSON.stringify(row)}`; await q(`INSERT INTO historical_matches(match_key,competition,raw) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[key,m.caption??null,row]); await q(`INSERT INTO historical_player_matches(player_local_id,match_key,raw) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[p.local_id,key,row]); matches++; playerMatches++; } }
  for (const t of p.transfers_and_media??[]) for (const row of t.rows??[]) { await q(`INSERT INTO historical_career_relations(player_local_id,relation_type,relation) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[p.local_id,t.caption??'career',row]); careers++; }
  for (const im of p.media?.images??[]) { const local=im.local_path??null; const objectKey=local?.replace(/^images\//,'')??null; await q(`INSERT INTO historical_images(url,player_local_id,object_key,local_path,bytes,sha256,mime_type,source_rights,download_status,raw) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(url) DO UPDATE SET object_key=EXCLUDED.object_key,local_path=EXCLUDED.local_path,bytes=EXCLUDED.bytes,sha256=EXCLUDED.sha256,mime_type=EXCLUDED.mime_type,download_status=EXCLUDED.download_status`,[im.url,p.local_id,objectKey,local,im.bytes??null,im.sha256??null,im.mime_type??null,im.source_rights??null,im.download_status??(im.downloaded?'downloaded':'failed'),im]); images++; }
}
const counts=await q(`SELECT (SELECT count(*)::int FROM historical_players) players,(SELECT count(*)::int FROM historical_statistics) statistic_records,(SELECT count(*)::int FROM historical_matches) unique_matches,(SELECT count(*)::int FROM historical_player_matches) player_match_relations,(SELECT count(*)::int FROM historical_career_relations) career_relations,(SELECT count(*)::int FROM historical_images) images`);
console.log(JSON.stringify({source_files:files.length,parsed_stat_rows:stats,parsed_match_rows:matches,parsed_career_rows:careers,parsed_images:images,db_counts:counts[0]}));
await sql.end();
