import { db } from './motm-db';
import type { Candidate, Fixture } from './press-conferences';

export type Query = (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
export const productionQuery: Query = async (text, params = []) => ({ rows: await db().unsafe(text, params as any[]) });
export const loadFixtures = async (query: Query, now: Date): Promise<Fixture[]> => (await query(
  'SELECT fixture_key,home_team,away_team,kickoff_at FROM matchday_fixtures WHERE kickoff_at>$1 AND kickoff_at<$2',
  [new Date(now.getTime()-9*7*86400000).toISOString(),new Date(now.getTime()+35*86400000).toISOString()],
)).rows;
export const loadMoments = async (query: Query, now: Date): Promise<Date[]> => (await query(
  'SELECT starts_at FROM press_conferences WHERE starts_at BETWEEN $1 AND $2',
  [new Date(now.getTime()-3*3600000).toISOString(),new Date(now.getTime()+3*3600000).toISOString()],
)).rows.map(row => new Date(row.starts_at));
export const latestCheck = async (query: Query, source: string) => (await query(
  "SELECT checked_at FROM press_conference_checks WHERE source=$1 AND status IN ('ok','unchanged') ORDER BY checked_at DESC LIMIT 1",[source],
)).rows[0]?.checked_at as string | Date | undefined;
export const logCheck = async (query: Query, source: string, status: string, detail: string | null, count = 0) => query(
  'INSERT INTO press_conference_checks(source,status,detail,item_count) VALUES($1,$2,$3,$4)',[source,status,detail,count],
);
export const sourceChanged = async (query: Query, url: string, lastmod: Date) => {
  const row=(await query('SELECT lastmod FROM press_conference_source_cache WHERE source_url=$1',[url])).rows[0];
  return !row || new Date(row.lastmod).getTime()<lastmod.getTime();
};
export const markSourceProcessed = async (query: Query, url: string, lastmod: Date) => query(
  'INSERT INTO press_conference_source_cache(source_url,lastmod) VALUES($1,$2) ON CONFLICT(source_url) DO UPDATE SET lastmod=excluded.lastmod,processed_at=now()',
  [url,lastmod.toISOString()],
);
export const saveCandidates = async (query: Query, candidates: Candidate[], now: Date) => {
  for (const c of candidates) await query(`INSERT INTO press_conferences(fixture_key,kind,event_date,starts_at,status,source_url,watch_links,source_priority)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
    ON CONFLICT(fixture_key,kind,event_date) DO UPDATE SET
    starts_at=CASE WHEN excluded.source_priority>=press_conferences.source_priority THEN COALESCE(excluded.starts_at,press_conferences.starts_at) ELSE COALESCE(press_conferences.starts_at,excluded.starts_at) END,
    status=CASE WHEN excluded.status='live' THEN 'live' WHEN excluded.status='ended' AND press_conferences.status<>'live' THEN 'ended' ELSE press_conferences.status END,
    source_url=CASE WHEN excluded.source_priority>=press_conferences.source_priority THEN excluded.source_url ELSE press_conferences.source_url END,
    watch_links=press_conferences.watch_links || excluded.watch_links,
    source_priority=GREATEST(press_conferences.source_priority,excluded.source_priority),source_updated_at=now(),updated_at=now()
    WHERE (excluded.source_priority>=press_conferences.source_priority AND (excluded.source_url,excluded.starts_at) IS DISTINCT FROM (press_conferences.source_url,press_conferences.starts_at))
       OR NOT press_conferences.watch_links @> excluded.watch_links
       OR (excluded.status='live' AND press_conferences.status<>'live')
       OR (excluded.status='ended' AND press_conferences.status='announced')`,
    [c.fixtureKey,c.kind,c.eventDate,c.startsAt?.toISOString()??null,c.status,c.sourceUrl,JSON.stringify(c.watchLinks),c.priority]);
  await query("UPDATE press_conferences SET status='ended',updated_at=now() WHERE status<>'ended' AND (event_date<CURRENT_DATE OR (starts_at IS NOT NULL AND starts_at<now()-interval '4 hours'))");
};
export const listCurrent = async (query: Query) => {
  const [items, checks] = await Promise.all([
    query(`SELECT p.fixture_key,p.kind,p.event_date,p.starts_at,p.status,p.source_url,p.watch_links,p.updated_at,f.home_team,f.away_team
      FROM press_conferences p LEFT JOIN matchday_fixtures f ON f.fixture_key=p.fixture_key
      WHERE p.event_date>=CURRENT_DATE AND p.status<>'ended'
      ORDER BY p.event_date ASC,p.starts_at ASC NULLS LAST LIMIT 80`),
    query("SELECT max(checked_at) checked_at FROM press_conference_checks WHERE source IN ('ajax.nl','youtube') AND status IN ('ok','unchanged')"),
  ]);
  return {items:items.rows.map(row=>({
    ...row,
    event_date:row.event_date instanceof Date ? row.event_date.toISOString().slice(0,10) : String(row.event_date).slice(0,10),
    starts_at:row.starts_at ? new Date(row.starts_at).toISOString() : null,
    updated_at:new Date(row.updated_at).toISOString(),
  })),checkedAt:checks.rows[0]?.checked_at??null};
};
