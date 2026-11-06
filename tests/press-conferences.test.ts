import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { allowedByRobots, sitemapLinks, dueLocalHour, mergeCandidates, parseAjaxArticle, type Fixture } from '../lib/press-conferences';
import { validGitHubOidcClaims } from '../lib/github-oidc';
import { verifyPressSchedulerRequest } from '../lib/press-scheduler-auth';
const fixtures: Fixture[] = [{fixture_key:'ajax-atalanta',home_team:'Ajax',away_team:'Atalanta',kickoff_at:'2026-10-22T19:00:00Z'}];
test('official article yields one dated match without invented time',()=>{
 const html='<h1>Ajax werkt toe naar Atalanta</h1><main>Na afloop van de training vond de persconferentie plaats. Datum: 21.10.2026</main>';
 const item=parseAjaxArticle(html,'https://www.ajax.nl/artikelen/persconferentie-atalanta/',fixtures,new Date('2026-11-06'),new Date('2026-10-21'));
 assert.equal(item?.fixtureKey,'ajax-atalanta'); assert.equal(item?.startsAt,null); assert.equal(item?.eventDate,'2026-10-21');
});
test('real Ajax announcement resolves event date from explicit weekday, not stale publication date',()=>{
 const html='<h1>Persco in aanloop naar Atalanta-thuis woensdag live te volgen</h1><p>In aanloop naar het duel met Atalanta vindt er woensdag een persconferentie plaats. Trainer Míchel Sánchez schuift samen met Marc ter Stegen vanaf 14:00 uur aan. Het persmoment is live te volgen op de Ajax-kanalen.</p><span>Datum:</span> 01.10.2026';
 const item=parseAjaxArticle(html,'https://www.ajax.nl/artikelen/persco-in-aanloop-naar-atalanta-thuis-woensdag-live-te-volgen/',fixtures,new Date('2026-10-21T12:00:00Z'),new Date('2026-10-21T11:42:53Z'));
 assert.equal(item?.eventDate,'2026-10-21');assert.equal(item?.startsAt?.toISOString(),'2026-10-21T12:00:00.000Z');
});
test('deduplicates links and candidates, preserving official source and YouTube link',()=>{
 assert.equal(sitemapLinks('<url><loc>https://www.ajax.nl/artikelen/persconferentie-a/</loc><lastmod>2026-11-06T08:00:00Z</lastmod></url>',new Date('2026-11-01')).length,1);
 const base={fixtureKey:'x',kind:'preview' as const,eventDate:'2026-11-06',startsAt:null,status:'announced' as const,sourceUrl:'https://www.youtube.com/watch?v=abcdefghijk',watchLinks:{YouTube:'https://www.youtube.com/watch?v=abcdefghijk'},priority:1};
 const merged=mergeCandidates([base,{...base,sourceUrl:'https://www.ajax.nl/artikelen/a/',priority:2,watchLinks:{'Ajax.nl':'https://www.ajax.nl/artikelen/a/'}}]);
 assert.equal(merged.length,1);assert.match(merged[0].sourceUrl,/ajax.nl/);assert.ok(merged[0].watchLinks.YouTube);
});
test('local scheduling handles standard, match-eve and DST hours',()=>{
 assert.equal(dueLocalHour(new Date('2026-11-06T07:00:00Z'),[]),true);
 assert.equal(dueLocalHour(new Date('2026-11-06T08:00:00Z'),[]),false);
 assert.equal(dueLocalHour(new Date('2026-11-06T11:00:00Z'),[]),true);
 assert.equal(dueLocalHour(new Date('2026-07-06T06:00:00Z'),[]),true);
 assert.equal(dueLocalHour(new Date('2026-07-06T10:00:00Z'),[]),true);
 assert.equal(dueLocalHour(new Date('2026-10-25T07:00:00Z'),[]),true);
 assert.equal(dueLocalHour(new Date('2026-11-06T10:00:00Z'),[{...fixtures[0],kickoff_at:'2026-11-07T14:00:00Z'}]),true);
});
test('robots disallow and more specific allow',()=>{
 assert.equal(allowedByRobots('User-agent: *\nDisallow: /artikelen/','/artikelen/a'),false);
 assert.equal(allowedByRobots('User-agent: *\nDisallow: /\nAllow: /artikelen/','/artikelen/a'),true);
 assert.equal(allowedByRobots('User-agent: *\nDisallow: /*.axd','/artikelen/persco/'),true);
 assert.equal(allowedByRobots('User-agent: *\nDisallow: /*.axd','/sitemap'),true);
 assert.equal(allowedByRobots('User-agent: *\nDisallow: /*.axd','/file.axd'),false);
});
test('Cloudflare cron signs only the press endpoint; stale and wrong signatures fail',async()=>{
 const config=readFileSync(new URL('../cloudflare/press-conferences/wrangler.toml',import.meta.url),'utf8');
 assert.match(config,/crons\s*=\s*\["7 \* \* \* \*"\]/);
 const worker=(await import('../cloudflare/press-conferences/worker.mjs')).default;
 const secret='press-conference-local-test-secret-0123456789';
 const before=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async (input,init)=>{
   calls++;
   assert.equal(String(input),'https://ajaxpro.fans/api/press-conferences?action=check');
   const request=new Request(String(input),init);
   assert.equal(verifyPressSchedulerRequest(request,Math.floor(Date.now()/1000),secret),true);
   assert.equal(verifyPressSchedulerRequest(new Request('https://ajaxpro.fans/api/club-tools?view=press-conferences&action=check',{headers:request.headers}),Math.floor(Date.now()/1000),secret),true);
   assert.equal(verifyPressSchedulerRequest(new Request('https://ajaxpro.fans/api/next-match?view=motm-announcement',{headers:request.headers}),Math.floor(Date.now()/1000),secret),false);
   assert.equal(verifyPressSchedulerRequest(request,Math.floor(Date.now()/1000)+301,secret),false);
   return Response.json({status:'not-due',count:0});
 };
 try { await worker.scheduled({}, {PRESS_SCHEDULER_SECRET:secret}); assert.equal(calls,1); }
 finally {globalThis.fetch=before;}
 const timestamp=String(Math.floor(Date.now()/1000));
 const wrong=createHmac('sha256','different-secret-01234567890123456789').update(`${timestamp}\nGET\n/api/press-conferences?action=check`).digest('hex');
 assert.equal(verifyPressSchedulerRequest(new Request('https://ajaxpro.fans/api/press-conferences?action=check',{headers:{'x-ajaxpro-timestamp':timestamp,'x-ajaxpro-signature':wrong}}),Number(timestamp),secret),false);
 assert.equal((await worker.fetch()).status,404);
 const claims={iss:'https://token.actions.githubusercontent.com',aud:'ajaxpro-press-conferences',repository:'AJAXPRO-020/ajaxpro-hub',ref:'refs/heads/main',workflow_ref:'AJAXPRO-020/ajaxpro-hub/.github/workflows/press-conferences.yml@refs/heads/main',exp:Number(timestamp)+120};
 assert.equal(validGitHubOidcClaims(claims,Number(timestamp)),false);
});
