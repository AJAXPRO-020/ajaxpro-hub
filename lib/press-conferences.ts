import { amsterdamLocalToUtc, normalizeTeamName } from './matchday-live';

export type Fixture = { fixture_key: string; home_team: string; away_team: string; kickoff_at: Date | string };
export type Candidate = { fixtureKey: string; kind: 'preview' | 'review'; eventDate: string; startsAt: Date | null; status: 'announced' | 'live' | 'ended'; sourceUrl: string; watchLinks: Record<string,string>; priority: number };
const clean = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/&(?:amp|nbsp);/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const dateFromDutch = (body: string) => {
  const m = body.match(/Datum:\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
export const sitemapLinks = (xml: string, since: Date) => [...xml.matchAll(/<url>\s*<loc>(https:\/\/www\.ajax\.nl\/(?:artikelen|liveblogs)\/[^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/gi)]
  .map(match => ({ url: match[1], changedAt: new Date(match[2]) }))
  .filter(item => item.changedAt >= since && /persconferentie|persco|livestream/i.test(item.url) && !/kids-persco/i.test(item.url))
  .sort((a,b) => b.changedAt.getTime()-a.changedAt.getTime())
  .slice(0,12);
export const allowedByRobots = (robots: string, path: string) => {
  const directives: Array<{allow:boolean;path:string}> = [];
  let agents: string[] = [], hasRules = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    const match = line.match(/^(user-agent|allow|disallow):\s*(.*)$/i);
    if (!match) continue;
    const name = match[1].toLowerCase(), value = match[2].trim();
    if (name === 'user-agent') { if (hasRules) { agents=[]; hasRules=false; } agents.push(value.toLowerCase()); }
    else { hasRules=true; if (agents.includes('*')) directives.push({allow:name==='allow',path:value}); }
  }
  const matching = directives.filter(rule => rule.path && new RegExp(`^${rule.path.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}`).test(path)).sort((a,b) => b.path.length - a.path.length);
  return matching[0]?.allow ?? true;
};
export const dueLocalHour = (now: Date, fixtures: Fixture[], confirmedMoments: Date[] = []) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const tomorrow = dayKey(new Date(now.getTime() + 24*60*60_000));
  const matchTomorrow = fixtures.some(f => dayKey(new Date(f.kickoff_at)) === tomorrow);
  const closeToMoment = confirmedMoments.some(t => Math.abs(t.getTime() - now.getTime()) <= 3*60*60_000);
  return hour === 8 || hour === 12 || (matchTomorrow && hour >= 9 && hour <= 16) || (closeToMoment && hour >= 7 && hour <= 23);
};
const opponent = (f: Fixture) => normalizeTeamName(f.home_team).includes('ajax') ? f.away_team : f.home_team;
export const parseAjaxArticle = (html: string, url: string, fixtures: Fixture[], now = new Date(), changedAt = now): Candidate | null => {
  const title = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const text = clean(html.split(/Gerelateerde artikelen/i)[0].replace(/<script[\s\S]*?<\/script>/gi,' '));
  if (!/persconferentie|persco/i.test(`${title} ${url}`)) return null;
  const kind = /na afloop|na de wedstrijd|na het duel|nabeschouwing/i.test(`${title} ${text.slice(0,1800)}`) ? 'review' : 'preview';
  const match = fixtures.filter(f => normalizeTeamName(`${title} ${text.slice(0,900)}`).includes(normalizeTeamName(opponent(f))))
    .sort((a,b) => Math.abs(new Date(a.kickoff_at).getTime()-changedAt.getTime())-Math.abs(new Date(b.kickoff_at).getTime()-changedAt.getTime()))[0];
  if (!match) return null;
  if (Math.abs(new Date(match.kickoff_at).getTime()-changedAt.getTime()) > 5*86400000) return null;
  const weekdays = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const pressContext = `${title} ${text.slice(0,900)}`;
  const weekday = weekdays.find(day => new RegExp(`\\b${day}(?:middag|ochtend|avond)?\\b`,'i').test(pressContext.slice(0,450)));
  const kickoff = new Date(match.kickoff_at);
  let eventDate: string | null = null;
  if (weekday) {
    const expected = weekdays.indexOf(weekday);
    for (let offset = kind==='preview' ? -1 : 0; offset >= (kind==='preview' ? -4 : -1); offset--) {
      const day = new Date(kickoff.getTime()+offset*86400000);
      if (new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',weekday:'long'}).format(day).toLowerCase()===weekday) { eventDate=dayKey(day); break; }
    }
  }
  if (!eventDate) {
    const published = dateFromDutch(text);
    if (published && Math.abs(new Date(match.kickoff_at).getTime()-new Date(`${published}T12:00:00Z`).getTime())<=4*86400000) eventDate=published;
  }
  if (!eventDate) return null;
  const timeMatch = pressContext.match(/(?:persconferentie|persmoment)[^.]{0,130}?(?:begint|start)\s+(?:om\s+)?(\d{1,2})[:.](\d{2})/i)
    ?? pressContext.match(/(?:trainer|coach)[^.]{0,130}?vanaf\s+(\d{1,2})[:.](\d{2})\s+uur\s+aan/i);
  const startsAt = timeMatch ? amsterdamLocalToUtc(...eventDate.split('-').map(Number) as [number,number,number], Number(timeMatch[1]), Number(timeMatch[2])) : null;
  const watchLinks: Record<string,string> = {};
  if (/live te volgen[^.]{0,100}ajax\.nl|livestream/i.test(text)) watchLinks['Ajax.nl'] = url;
  const youtube = html.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]{11}/i)?.[0];
  if (youtube) watchLinks.YouTube = youtube;
  const status = /moment met de pers is afgelopen|persconferentie is afgelopen/i.test(text) || new Date(`${eventDate}T23:59:59Z`) < now ? 'ended' : 'announced';
  return { fixtureKey: match.fixture_key, kind, eventDate, startsAt, status, sourceUrl: url, watchLinks, priority: 2 };
};
export const mergeCandidates = (candidates: Candidate[]) => {
  const merged = new Map<string,Candidate>();
  for (const c of candidates.sort((a,b) => a.priority-b.priority)) {
    const key = `${c.fixtureKey}:${c.kind}:${c.eventDate}`, previous = merged.get(key);
    if (!previous) { merged.set(key,c); continue; }
    const preferred = c.priority>previous.priority ? c : previous;
    merged.set(key, { ...preferred, watchLinks:{...previous.watchLinks,...c.watchLinks}, status:previous.status==='live' || c.status==='live' ? 'live' : preferred.status, startsAt:preferred.startsAt??c.startsAt??previous.startsAt });
  }
  return [...merged.values()];
};
