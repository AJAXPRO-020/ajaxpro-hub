import { normalizeTeamName } from './matchday-live';
import type { Candidate, Fixture } from './press-conferences';

export const ESPN_XMLTV_URL = 'https://xmltv.live/epg/nl.xml.gz';
const channels: Record<string,string> = { 'ESPN.nl':'ESPN 1', 'ESPN2.nl':'ESPN 2', 'ESPN3.nl':'ESPN 3', 'ESPN4.nl':'ESPN 4' };
const decode = (value: string) => value.replace(/&(?:amp|lt|gt|quot|apos|#\d+);/g, entity => {
  const named: Record<string,string> = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
  return named[entity] ?? String.fromCodePoint(Number(entity.slice(2,-1)));
});
const localDate = (value: Date) => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
const xmltvDate = (value: string): Date | null => {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}) ([+-])(\d{2})(\d{2})$/);
  if (!match) return null;
  const [,year,month,day,hour,minute,second,sign,offsetHour,offsetMinute] = match;
  const offset=(Number(offsetHour)*60+Number(offsetMinute))*(sign==='+'?1:-1);
  const date=new Date(Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute),Number(second))-offset*60000);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const espnXmltvCandidates = (xml: string, fixtures: Fixture[], now = new Date()): Candidate[] => {
  const candidates: Candidate[] = [];
  for (const match of xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/g)) {
    const channelId=match[1].match(/\bchannel="([^"]+)"/)?.[1];
    const channel=channelId && channels[channelId];
    if (!channel) continue;
    const title=decode(match[2].match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1]??'').trim();
    if (!/\bajax\b/i.test(title) || !/persconferentie|\bpersco\b/i.test(title)) continue;
    const startsAt=xmltvDate(match[1].match(/\bstart="([^"]+)"/)?.[1]??'');
    if (!startsAt || startsAt <= now || startsAt.getTime()>now.getTime()+7*86400000) continue;
    const titleTeams=normalizeTeamName(title);
    const possible=fixtures.map(fixture=>{
      const opponent=normalizeTeamName(fixture.home_team).includes('ajax')?fixture.away_team:fixture.home_team;
      return {fixture,opponent:normalizeTeamName(opponent),days:(startsAt.getTime()-new Date(fixture.kickoff_at).getTime())/86400000};
    }).filter(row=>titleTeams.includes(row.opponent) && row.days>=-4 && row.days<=2);
    if (possible.length!==1) continue;
    const {fixture,days}=possible[0];
    const kind=days<0?'preview':'review';
    const sourceUrl='https://xmltv.live/epg/';
    candidates.push({fixtureKey:fixture.fixture_key,kind,eventDate:localDate(startsAt),startsAt,status:'announced',sourceUrl,
      watchLinks:{[`${channel} · programmagids`]:'https://www.espn.nl/watch/schedule'},priority:0});
  }
  return candidates;
};
