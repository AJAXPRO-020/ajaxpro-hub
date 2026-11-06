import { allowedByRobots, sitemapLinks, dueLocalHour, mergeCandidates, parseAjaxArticle, type Candidate, type Fixture } from './press-conferences';
import { normalizeTeamName } from './matchday-live';
import { latestCheck, loadFixtures, loadMoments, logCheck, markSourceProcessed, productionQuery, saveCandidates, sourceChanged, type Query } from './press-conference-store';

const UA = 'AjaxPro/1.0 (+https://ajaxpro.fans/)';
const get = async (url: string) => {
  const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html, text/plain' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw Error(`${new URL(url).host}: HTTP ${response.status}`);
  return response.text();
};
const youtubeCandidates = async (fixtures: Fixture[], now: Date, query: Query): Promise<Candidate[]> => {
  const key = process.env.YOUTUBE_API_KEY, channel = 'UCGpf7WX7R1one-NwOvg_PbQ';
  if (!key) { await logCheck(query,'youtube','skipped','API-sleutel ontbreekt'); return []; }
  const output: Candidate[] = [];
  try {
    for (const eventType of ['upcoming','live']) {
      const endpoint = new URL('https://www.googleapis.com/youtube/v3/search');
      for (const [name,value] of Object.entries({ part:'snippet', channelId:channel, eventType, type:'video', maxResults:'25', key })) endpoint.searchParams.set(name,value);
      const response = await fetch(endpoint,{signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw Error(`YouTube API HTTP ${response.status}`);
      const data = await response.json() as { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; publishedAt?: string } }> };
      const ids = (data.items ?? []).map(item=>item.id?.videoId).filter((id): id is string => Boolean(id));
      const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      for (const [name,value] of Object.entries({part:'liveStreamingDetails',id:ids.join(','),key})) detailsUrl.searchParams.set(name,value);
      const detailsResponse = ids.length ? await fetch(detailsUrl,{signal:AbortSignal.timeout(8000)}) : null;
      if (detailsResponse && !detailsResponse.ok) throw Error(`YouTube details HTTP ${detailsResponse.status}`);
      const details = detailsResponse ? await detailsResponse.json() as {items?:Array<{id:string;liveStreamingDetails?:{scheduledStartTime?:string;actualStartTime?:string}}> } : {items:[]};
      for (const item of data.items ?? []) {
        const title = item.snippet?.title ?? '', videoId = item.id?.videoId;
        if (!videoId || !/persconferentie|persco/i.test(title)) continue;
        const fixture = fixtures.find(f => {
          const opponent = normalizeTeamName(f.home_team).includes('ajax') ? f.away_team : f.home_team;
          return normalizeTeamName(title).includes(normalizeTeamName(opponent)) && Math.abs(new Date(f.kickoff_at).getTime()-now.getTime()) < 7*86400000;
        });
        if (!fixture) continue;
        const stream = details.items?.find(row=>row.id===videoId)?.liveStreamingDetails;
        const startsAt = stream?.actualStartTime || stream?.scheduledStartTime;
        if (!startsAt) continue;
        const eventDate = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(startsAt));
        output.push({fixtureKey:fixture.fixture_key,kind:/na afloop|nabeschouwing/i.test(title)?'review':'preview',eventDate,startsAt:new Date(startsAt),status:eventType==='live'?'live':'announced',sourceUrl:`https://www.youtube.com/watch?v=${videoId}`,watchLinks:{YouTube:`https://www.youtube.com/watch?v=${videoId}`},priority:1});
      }
    }
    await logCheck(query,'youtube','ok',null,output.length);
  } catch(error) { await logCheck(query,'youtube','error',String(error).slice(0,300)); }
  return output;
};

export const runPressConferenceCheck = async (force = false, now = new Date(), query: Query = productionQuery) => {
  const fixtures = await loadFixtures(query,now);
  const moments = await loadMoments(query,now);
  if (!force && !dueLocalHour(now, fixtures, moments)) return { status: 'not-due', count: 0 };
  const recent = await latestCheck(query,'ajax.nl');
  if (!force && recent && now.getTime() - new Date(recent).getTime() < 45*60000) return { status: 'recent', count: 0 };
  const youtube = youtubeCandidates(fixtures,now,query);
  const candidates: Candidate[] = [];
  try {
    const robots = await get('https://www.ajax.nl/robots.txt');
    if (!allowedByRobots(robots, '/artikelen/') || !allowedByRobots(robots, '/sitemap')) await logCheck(query,'ajax.nl','skipped','robots.txt blokkeert de sitemap of artikelen');
    else {
      const sitemap = await get('https://www.ajax.nl/sitemap');
      const links = sitemapLinks(sitemap,new Date(now.getTime()-56*86400000));
      let processed=0;
      for (let index=0; index<links.length; index+=3) {
        const group=links.slice(index,index+3);
        const changed=await Promise.all(group.map(async item=>({item,fetch:await sourceChanged(query,item.url,item.changedAt)})));
        const results=await Promise.allSettled(changed.filter(entry=>entry.fetch).map(async ({item})=>({item,article:await get(item.url)})));
        for (const result of results) {
          if (result.status==='rejected') { await logCheck(query,'ajax.nl:article','error',String(result.reason).slice(0,300)); continue; }
          const {item,article}=result.value;
          const parsed=parseAjaxArticle(article,item.url,fixtures,now,item.changedAt);
          if (parsed) candidates.push(parsed);
          await markSourceProcessed(query,item.url,item.changedAt);
          processed++;
        }
      }
      await logCheck(query,'ajax.nl', processed ? 'ok' : 'unchanged', null, processed);
    }
  } catch (error) { await logCheck(query,'ajax.nl','error',String(error).slice(0,300)); }
  candidates.push(...await youtube);
  try {
    const merged = mergeCandidates(candidates);
    await saveCandidates(query,merged,now);
    return { status: 'ok', count: merged.length };
  } catch (error) {
    await logCheck(query,'storage','error',String(error).slice(0,300));
    return { status: 'error', count: 0 };
  }
};
