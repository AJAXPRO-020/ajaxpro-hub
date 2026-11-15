import { amsterdamLocalToUtc, normalizeTeamName } from './matchday-live';

export type Fixture = { fixture_key: string; home_team: string; away_team: string; kickoff_at: Date | string };
export type Candidate = { fixtureKey: string; kind: 'preview' | 'review'; eventDate: string; startsAt: Date | null; status: 'announced' | 'live' | 'ended'; sourceUrl: string; watchLinks: Record<string,string>; priority: number };
export const manualEspnCandidate = (input: Record<string, unknown>, fixtures: Fixture[], now = new Date()): Candidate => {
  const fixture = fixtures.find(row => row.fixture_key === input.fixtureKey);
  if (!fixture) throw new RangeError('Kies een bekende Ajax-wedstrijd.');
  const title = String(input.title ?? '').trim();
  if (title.length > 180 || !/\bajax\b/i.test(title) || !/persconferentie|\bpersco\b/i.test(title))
    throw new RangeError('De programmatitel moet Ajax en persconferentie of persco vermelden.');
  const kind = input.kind;
  if (kind !== 'preview' && kind !== 'review') throw new RangeError('Kies voor of na de wedstrijd.');
  const channel = String(input.channel ?? '');
  if (!/^ESPN [1-4]$/.test(channel)) throw new RangeError('Kies de bevestigde ESPN-zender.');
  let source: URL;
  try { source = new URL(String(input.sourceUrl ?? '')); } catch { throw new RangeError('Vul een geldige programmalink in.'); }
  const host = source.hostname.toLowerCase();
  if (source.protocol !== 'https:' || source.username || source.password || source.port ||
      !['www.espn.nl','espn.nl','tv.kpn.com','www.tvgids.nl','tvgids.nl'].includes(host) || source.pathname === '/')
    throw new RangeError('Gebruik een HTTPS-programmalink van ESPN, KPN TV of TVgids.nl.');
  const localStart = String(input.startsAt ?? '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localStart)) throw new RangeError('Vul een bevestigde datum en tijd in.');
  const [year,month,day,hour,minute] = localStart.match(/\d+/g)!.map(Number);
  if (hour > 23 || minute > 59 || new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10) !== localStart.slice(0,10))
    throw new RangeError('Vul een geldige datum en tijd in.');
  const startsAt = amsterdamLocalToUtc(year,month,day,hour,minute);
  if (startsAt.getTime() <= now.getTime() || startsAt.getTime() > now.getTime()+7*86400000)
    throw new RangeError('De uitzending moet binnen de komende zeven dagen beginnen.');
  const eventDate = localStart.slice(0,10);
  if (dayKey(startsAt) !== eventDate) throw new RangeError('De lokale uitzendtijd is niet geldig.');
  const kickoff = new Date(fixture.kickoff_at);
  const daysFromMatch = (startsAt.getTime()-kickoff.getTime())/86400000;
  if (kind === 'preview' ? daysFromMatch < -4 || daysFromMatch > 0 : daysFromMatch < 0 || daysFromMatch > 2)
    throw new RangeError('De uitzending past niet bij de gekozen wedstrijd en het gekozen type.');
  return {fixtureKey:fixture.fixture_key,kind,eventDate,startsAt,status:'announced',sourceUrl:source.toString(),watchLinks:{[`${channel} · programmagids`]:source.toString()},priority:0};
};
const clean = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/&(?:amp|nbsp);/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const dateFromDutch = (body: string) => {
  const m = body.match(/Datum:\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
export const sitemapLinks = (xml: string, since: Date, now = new Date()) => {
  const entries = [...xml.matchAll(/<url>\s*<loc>(https:\/\/www\.ajax\.nl\/(?:artikelen|liveblogs)\/[^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/gi)]
    .map(match => ({ url: match[1], changedAt: new Date(match[2]) }))
    .filter(item => item.changedAt >= since && !/kids-persco/i.test(item.url))
    .sort((a,b) => b.changedAt.getTime()-a.changedAt.getTime());
  const named = entries.filter(item => /persconferentie|persco|livestream/i.test(item.url)).slice(0,12);
  const recent = entries.filter(item => item.changedAt.getTime() >= now.getTime()-48*3600000 && !named.some(found => found.url === item.url)).slice(0,12);
  return [...named,...recent];
};
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
export const daytimeLocalHour = (now: Date) => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Amsterdam', hour:'2-digit', hourCycle:'h23' }).format(now));
  return hour >= 8 && hour <= 22;
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
