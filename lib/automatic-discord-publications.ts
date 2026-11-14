import { publishDiscord } from './discord-publisher';
import { createMotmVisualData } from './motm-visual';
import type { Candidate } from './press-conferences';

const localDate=(date: Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const dateText=(value:string)=>new Intl.DateTimeFormat('nl-NL',{dateStyle:'long',timeZone:'Europe/Amsterdam'}).format(new Date(`${value}T12:00:00+01:00`));
const timeText=(value:Date|null)=>value?new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam'}).format(value):'tijd volgt';

export const publishPressConference = async (candidate: Candidate, fixture: {home_team:string;away_team:string}, now=new Date()) => {
  if (candidate.status === 'ended' || candidate.eventDate < localDate(now)) return {status:'skipped' as const};
  const links=Object.entries(candidate.watchLinks).map(([name,url])=>`${name}: ${url}`).join('\n');
  const text=[`Nieuwe persconferentie: ${fixture.home_team} - ${fixture.away_team}`,`${dateText(candidate.eventDate)} om ${timeText(candidate.startsAt)}`,links].filter(Boolean).join('\n');
  return publishDiscord({idempotencyKey:`press-conference:${candidate.fixtureKey}:${candidate.kind}:${candidate.eventDate}`,sourceType:'press-conference',sourceId:`${candidate.fixtureKey}:${candidate.kind}:${candidate.eventDate}`,text,actorDiscordUserId:'system:press-conference'});
};

const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const dataUri=async(url:string,mime:string)=>{const response=await fetch(new URL(url,process.env.PUBLIC_APP_URL??'https://ajaxpro.fans'));if(!response.ok)throw new Error(`MOTM-asset HTTP ${response.status}`);return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`};
export const renderMotmSvg = async (data:{matchTitle:string;firstName:string;lastName:string;shirtNumber:number;percentage:number;playerImageUrl:string}) => {
  const [template,player]=await Promise.all([dataUri('/assets/motm/MOTM-4-Blank.png','image/png'),dataUri(data.playerImageUrl,'image/png')]);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1350" height="1080" viewBox="0 0 1350 1080"><image href="${template}" width="1350" height="1080"/><image href="${player}" x="610" y="30" width="700" height="1050" preserveAspectRatio="xMidYMid meet"/><g fill="#fff" font-family="Arial,sans-serif" font-weight="700"><text x="70" y="120" font-size="48">${esc(data.matchTitle)}</text><text x="70" y="900" font-size="78">${esc(data.firstName)} ${esc(data.lastName)}</text><text x="70" y="990" font-size="54">${data.percentage}% · #${data.shirtNumber}</text></g></svg>`);
};

export const publishMotmWinner = async (match:any, winner:any, player:any) => {
  const visual=createMotmVisualData({status:'closed',slug:match.slug,opponent:match.opponent,homeOrAway:match.home_or_away,shirtNumber:player?.shirt_number_snapshot??null,winner});
  if (!visual) return {status:'skipped' as const};
  const attachment=await renderMotmSvg(visual);
  return publishDiscord({idempotencyKey:`motm-winner:${match.id}:closed`,sourceType:'motm-winner',sourceId:String(match.id),text:`Definitieve Man of the Match: ${match.home_or_away==='home'?'Ajax':' '+match.opponent} - ${match.home_or_away==='home'?match.opponent:'Ajax'}\nWinnaar: ${winner.name_snapshot}`,attachment:{data:attachment,filename:visual.filename.replace(/\.png$/,'.svg'),mimeType:'image/svg+xml'},actorDiscordUserId:'system:motm'});
};
