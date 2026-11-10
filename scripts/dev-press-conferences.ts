import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { listCurrent, type Query } from '../lib/press-conference-store';
import { runPressConferenceCheck } from '../lib/press-conference-monitor';

// Read-only local preview. The Ajax facts below were checked against the
// published article and sitemap; the HTTP responses are controlled fixtures.
const database = new PGlite();
const query: Query = (text,params=[])=>database.query(text,params as any[]);
async function main(){
await database.exec('CREATE TABLE matchday_fixtures(fixture_key text PRIMARY KEY,home_team text NOT NULL,away_team text NOT NULL,kickoff_at timestamptz NOT NULL)');
await query("INSERT INTO matchday_fixtures VALUES('ajax-atalanta','Ajax','Atalanta','2026-10-22T19:00:00Z')");
await database.exec(readFileSync(new URL('../db/migrations/036_press_conferences.sql',import.meta.url),'utf8'));
const actualFetch=globalThis.fetch;
globalThis.fetch=async input=>{
  const url=String(input);
  if(url.endsWith('/robots.txt'))return new Response('Sitemap: https://www.ajax.nl/sitemap\nUser-agent: *\nDisallow: /umbraco/');
  if(url.endsWith('/sitemap'))return new Response('<urlset><url><loc>https://www.ajax.nl/artikelen/persco-in-aanloop-naar-atalanta-thuis-woensdag-live-te-volgen/</loc><lastmod>2026-10-21T11:42:53.0170000Z</lastmod></url></urlset>');
  if(url.includes('persco-in-aanloop-naar-atalanta'))return new Response('<h1>Persco in aanloop naar Atalanta-thuis woensdag live te volgen</h1><p>In aanloop naar het duel met Atalanta vindt er woensdag een persconferentie plaats. Trainer Míchel Sánchez schuift samen met Marc ter Stegen vanaf 14:00 uur aan. Het persmoment is live te volgen op de Ajax-kanalen.</p><span>Datum:</span> 01.10.2026');
  return new Response('Not found',{status:404});
};
await runPressConferenceCheck(true,new Date('2026-10-21T11:50:00Z'),query);
globalThis.fetch=actualFetch;
const root=resolve('dist-public');
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
createServer(async(req,res)=>{
  const url=new URL(req.url??'/',`http://${req.headers.host}`);
  if(url.pathname==='/api/press-conferences'){
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify(url.searchParams.get('action')==='staff'?{allowed:false}:{...await listCurrent(query),preview:true}));
    return;
  }
  if(url.pathname==='/api/next-match'){
    res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({fixtures:[]}));return;
  }
  const pathname=url.pathname==='/'?'/programma.html':url.pathname;
  const file=resolve(root,`.${pathname}`);
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{const body=readFileSync(file);res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(body)}
  catch{res.writeHead(404).end('Not found')}
}).listen(8766,'127.0.0.1',()=>console.log('Local press preview: http://localhost:8766/programma.html#persconferenties'));
}
void main();
