import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postgres from 'postgres';

const root = path.resolve(new URL('.', import.meta.url).pathname);
const db = postgres(process.env.DATABASE_URL, { max: 4, ssl: 'require' });
const files = fs.readdirSync(path.join(root, 'players')).filter(f => f.endsWith('.json')).sort();
const json = v => v == null ? null : JSON.stringify(v);
const digest = v => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');
const rows = { players: [], sources: [], stats: [], statRows: [], matches: new Map(), playerMatches: new Map(), careers: [], images: [] };
for (const file of files) {
  const p = JSON.parse(fs.readFileSync(path.join(root, 'players', file), 'utf8'));
  rows.players.push([p.local_id,p.slug,p.profile?.name??null,p.profile?.full_name??null,p.profile?.birth_date??null,p.profile?.death_date??null,json(p.profile?.nationality),json(p.profile?.roles),json(p.profile?.ajax_club),json(p.profile?.last_known_club),json(p.profile??{}),p.source_urls?.[0]??`local:${p.local_id}`,p.collected_at,json(p)]);
  rows.sources.push([p.source_urls?.[0]??`local:${p.local_id}`,'AFC-Ajax.info','player_profile',p.collected_at,json({local_id:p.local_id})]);
  for (const s of p.statistics??[]) {
    rows.stats.push([p.local_id,s.caption??null,json(s.headers??[]),json(s.rows??[]),s.raw_row_count??0]);
    for (const row of s.rows??[]) rows.statRows.push([p.local_id,s.caption??null,json(row)]);
  }
  for (const m of p.matches??[]) for (const row of m.rows??[]) {
    const key = `${m.caption??'matches'}:${digest(row)}`;
    if (!rows.matches.has(key)) rows.matches.set(key,[key,null,m.caption??null,null,null,json(row)]);
    rows.playerMatches.set(`${p.local_id}|${key}`,[p.local_id,key,json(row)]);
  }
  for (const t of p.transfers_and_media??[]) for (const row of t.rows??[]) rows.careers.push([p.local_id,t.caption??'career',json(row)]);
  for (const im of p.media?.images??[]) rows.images.push([im.url,p.local_id,im.local_path?.replace(/^images\//,'')??null,im.local_path??null,im.bytes??null,im.sha256??null,im.mime_type??null,im.source_rights??null,im.download_status??(im.downloaded?'downloaded':'failed'),json(im)]);
}
async function exec(sql) { return db.unsafe(sql); }
async function bulk(table, columns, data, jsonIndexes, conflict) {
  const chunk=500;
  for (let off=0;off<data.length;off+=chunk) {
    const batch=data.slice(off,off+chunk), params=[];
    const values=batch.map(row=>'('+row.map((v,i)=>{params.push(v);return `$${params.length}${jsonIndexes.has(i)?'::jsonb':''}`}).join(',')+')').join(',');
    await db.unsafe(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${values} ${conflict}`,params);
  }
}
await exec(`CREATE TABLE IF NOT EXISTS historical_statistic_rows (id bigserial PRIMARY KEY, player_local_id text NOT NULL REFERENCES historical_players(local_id), section text, row jsonb NOT NULL, UNIQUE(player_local_id,section,row));`);
await bulk('historical_players',['local_id','slug','name','full_name','birth_date','death_date','nationality','roles','ajax_club','last_known_club','profile','source_url','collected_at','raw'],rows.players,new Set([6,7,8,9,10,13]),'ON CONFLICT(local_id) DO UPDATE SET raw=EXCLUDED.raw,profile=EXCLUDED.profile');
await bulk('historical_sources',['source_url','source_name','source_type','first_seen_at','metadata'],rows.sources,new Set([4]),'ON CONFLICT(source_url) DO NOTHING');
await bulk('historical_statistics',['player_local_id','caption','headers','rows','raw_row_count'],rows.stats,new Set([2,3]),'ON CONFLICT(player_local_id,caption) DO UPDATE SET headers=EXCLUDED.headers,rows=EXCLUDED.rows,raw_row_count=EXCLUDED.raw_row_count');
await bulk('historical_statistic_rows',['player_local_id','section','row'],rows.statRows,new Set([2]),'ON CONFLICT DO NOTHING');
await bulk('historical_matches',['match_key','date','competition','opponent','result','raw'],[...rows.matches.values()],new Set([5]),'ON CONFLICT DO NOTHING');
await bulk('historical_player_matches',['player_local_id','match_key','raw'],[...rows.playerMatches.values()],new Set([2]),'ON CONFLICT DO NOTHING');
await bulk('historical_career_relations',['player_local_id','relation_type','relation'],rows.careers,new Set([2]),'ON CONFLICT DO NOTHING');
await bulk('historical_images',['url','player_local_id','object_key','local_path','bytes','sha256','mime_type','source_rights','download_status','raw'],rows.images,new Set([9]),'ON CONFLICT(url) DO UPDATE SET player_local_id=EXCLUDED.player_local_id,object_key=EXCLUDED.object_key,bytes=EXCLUDED.bytes,sha256=EXCLUDED.sha256,mime_type=EXCLUDED.mime_type,download_status=EXCLUDED.download_status');
const count=await db.unsafe(`SELECT (SELECT count(*)::int FROM historical_players) players,(SELECT count(*)::int FROM historical_statistic_rows) statistic_rows,(SELECT count(*)::int FROM historical_matches) unique_matches,(SELECT count(*)::int FROM historical_player_matches) player_match_relations,(SELECT count(*)::int FROM historical_career_relations) career_relations,(SELECT count(*)::int FROM historical_images) images`);
console.log(JSON.stringify({source_players:files.length,source_stat_rows:rows.statRows.length,source_match_rows:[...rows.playerMatches.values()].length,source_unique_matches:rows.matches.size,source_career_rows:rows.careers.length,source_images:rows.images.length,db:count[0]}));
await db.end();
