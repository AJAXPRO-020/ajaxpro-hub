import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { runPressConferenceCheck } from '../lib/press-conference-monitor';
import { listCurrent, saveCandidates, type Query } from '../lib/press-conference-store';

test('real Ajax source facts flow through monitor, Postgres schema and public query', async () => {
  const database = new PGlite();
  const query: Query = (text, params=[]) => database.query(text, params as any[]);
  await database.exec(`CREATE TABLE matchday_fixtures(fixture_key text PRIMARY KEY,home_team text NOT NULL,away_team text NOT NULL,kickoff_at timestamptz NOT NULL);`);
  await query("INSERT INTO matchday_fixtures VALUES('ajax-atalanta','Ajax','Atalanta','2026-10-22T19:00:00Z')");
  await database.exec(readFileSync(new URL('../db/migrations/036_press_conferences.sql',import.meta.url),'utf8'));
  const priorFetch = globalThis.fetch;
  const priorKey = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY='local-test-key';
  const urls: string[]=[];
  globalThis.fetch = async (input) => {
    const url=String(input);urls.push(url);
    if(url.includes('/youtube/v3/search'))return new Response(JSON.stringify({items:url.includes('eventType=live')?[{id:{videoId:'2CIv8BQk2YI'},snippet:{title:'LIVE 14:00 | Persconferentie Míchel Sánchez | Ajax - Atalanta'}}]:[]}));
    if(url.includes('/youtube/v3/videos'))return new Response(JSON.stringify({items:[{id:'2CIv8BQk2YI',liveStreamingDetails:{scheduledStartTime:'2026-10-21T12:00:00Z'}}]}));
    if(url.endsWith('/robots.txt'))return new Response('Sitemap: https://www.ajax.nl/sitemap\nUser-Agent: *\nDisallow: /umbraco/');
    if(url.endsWith('/sitemap'))return new Response('<urlset><url><loc>https://www.ajax.nl/artikelen/persco-in-aanloop-naar-atalanta-thuis-woensdag-live-te-volgen/</loc><lastmod>2026-10-21T11:42:53.0170000Z</lastmod></url></urlset>');
    if(url.includes('/persco-in-aanloop-naar-atalanta'))return new Response('<h1>Persco in aanloop naar Atalanta-thuis woensdag live te volgen</h1><p>In aanloop naar het duel met Atalanta vindt er woensdag een persconferentie plaats. Trainer Míchel Sánchez schuift samen met Marc ter Stegen vanaf 14:00 uur aan. Het persmoment is live te volgen op de Ajax-kanalen.</p><span>Datum:</span> 01.10.2026');
    return new Response('Not found',{status:404});
  };
  try {
    const result=await runPressConferenceCheck(true,new Date('2026-10-21T11:50:00Z'),query);
    assert.deepEqual(result,{status:'ok',count:1});
    assert.ok(urls.some(url=>url.endsWith('/sitemap')));
    const articleCalls=urls.filter(url=>url.includes('/persco-in-aanloop-naar-atalanta')).length;
    await runPressConferenceCheck(true,new Date('2026-10-21T12:05:00Z'),query);
    assert.equal(urls.filter(url=>url.includes('/persco-in-aanloop-naar-atalanta')).length,articleCalls,'unchanged article is not fetched twice');
    const stored=(await query('SELECT * FROM press_conferences')).rows;
    assert.equal(stored.length,1);
    assert.equal(new Date(stored[0].event_date).toISOString().slice(0,10),'2026-10-21');
    assert.equal(new Date(stored[0].starts_at).toISOString(),'2026-10-21T12:00:00.000Z');
    assert.match(stored[0].source_url,/ajax.nl/);
    assert.equal(stored[0].watch_links.YouTube,'https://www.youtube.com/watch?v=2CIv8BQk2YI');
    const current=await listCurrent(query);
    assert.equal(current.items.length,0,'past event stays hidden');
    assert.ok(current.checkedAt,'successful source check is visible');
    const today=new Date((await query('SELECT CURRENT_DATE AS day')).rows[0].day).toISOString().slice(0,10);
    await query("INSERT INTO matchday_fixtures VALUES('ajax-future','Ajax','FC Thun',$1)",[new Date(Date.now()+3*86400000).toISOString()]);
    await saveCandidates(query,[{fixtureKey:'ajax-future',kind:'preview',eventDate:today,startsAt:null,status:'announced',sourceUrl:'https://www.ajax.nl/artikelen/example/',watchLinks:{'Ajax.nl':'https://www.ajax.nl/artikelen/example/'},priority:2}],new Date());
    await saveCandidates(query,[{fixtureKey:'ajax-future',kind:'preview',eventDate:today,startsAt:null,status:'live',sourceUrl:'https://www.youtube.com/watch?v=2CIv8BQk2YI',watchLinks:{YouTube:'https://www.youtube.com/watch?v=2CIv8BQk2YI'},priority:1}],new Date());
    const visible=await listCurrent(query);
    assert.equal(visible.items.length,1);
    assert.equal(visible.items[0].away_team,'FC Thun');
    assert.equal(visible.items[0].status,'live');
    assert.match(visible.items[0].source_url,/ajax.nl/);
    assert.ok(visible.items[0].watch_links.YouTube);
  } finally {
    globalThis.fetch=priorFetch;
    if(priorKey===undefined)delete process.env.YOUTUBE_API_KEY;else process.env.YOUTUBE_API_KEY=priorKey;
    await database.close();
  }
});
