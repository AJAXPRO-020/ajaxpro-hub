import { publishDiscord } from './discord-publisher';
import { createMotmVisualData } from './motm-visual';
import { Resvg } from '@resvg/resvg-js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Candidate } from './press-conferences';

const localDate=(date: Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const dateText=(value:string)=>new Intl.DateTimeFormat('nl-NL',{dateStyle:'long',timeZone:'Europe/Amsterdam'}).format(new Date(`${value}T12:00:00+01:00`));
const timeText=(value:Date|null)=>value?new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam'}).format(value):'tijd volgt';

export const publishPressConference = async (candidate: Candidate, fixture: {home_team:string;away_team:string}, now=new Date()) => {
  if (candidate.status === 'ended' || candidate.eventDate < localDate(now)) return {status:'skipped' as const};
  const links=Object.entries(candidate.watchLinks).map(([name,url])=>`${name}: ${url}`).join('\n');
  const text=[`@everyone`,`Nieuwe persconferentie: ${fixture.home_team} - ${fixture.away_team}`,`${dateText(candidate.eventDate)} om ${timeText(candidate.startsAt)}`,links].filter(Boolean).join('\n');
  return publishDiscord({idempotencyKey:`press-conference:${candidate.fixtureKey}:${candidate.kind}:${candidate.eventDate}`,sourceType:'press-conference',sourceId:`${candidate.fixtureKey}:${candidate.kind}:${candidate.eventDate}`,text,allowedMentions:{parse:['everyone']},actorDiscordUserId:'system:press-conference'});
};

const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const asset=async(url:string)=>{const response=await fetch(new URL(url,process.env.PUBLIC_APP_URL??'https://ajaxpro.fans'));if(!response.ok)throw new Error(`MOTM-asset ${url} HTTP ${response.status}`);return Buffer.from(await response.arrayBuffer())};
const dataUri=async(url:string,mime:string)=>`data:${mime};base64,${(await asset(url)).toString('base64')}`;
export const renderMotmSvg = async (data:{matchTitle:string;firstName:string;lastName:string;shirtNumber:number|null;percentage:number;playerImageUrl:string}) => {
  const [template,player]=await Promise.all([dataUri('/assets/motm/MOTM-4-Blank.png','image/png'),dataUri(data.playerImageUrl,'image/png')]);
  const fit=(value:string,max:number,width:number)=>Math.min(max,Math.floor(width/Math.max(1,value.length)*2.2));
  const name=data.lastName?`<text x="180" y="690" font-size="${fit(data.firstName,83,245)}">${esc(data.firstName)}</text><text x="180" y="775" font-size="${fit(data.lastName,83,245)}">${esc(data.lastName)}</text>`:`<text x="180" y="735" font-size="${fit(data.firstName,83,245)}">${esc(data.firstName)}</text>`;
  const number=data.shirtNumber===null?'':`<text x="180" y="865" font-size="83">#${data.shirtNumber}</text>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1350" height="1080" viewBox="0 0 1350 1080"><image href="${template}" width="1350" height="1080"/><image href="${player}" x="610" y="30" width="1050" height="1050" preserveAspectRatio="xMidYMid meet"/><text x="48" y="456" fill="#101010" font-family="Bebas Neue" font-size="${fit(data.matchTitle,64,625)}">${esc(data.matchTitle)}</text><g fill="#101010" font-family="Refrigerator Deluxe" font-weight="700" text-anchor="middle">${name}${number}</g><text x="410" y="815" fill="#A50324" font-family="Refrigerator Deluxe" font-size="${data.percentage>=100?165:205}" font-weight="900">${data.percentage}%</text><text x="410" y="868" fill="#101010" font-family="Refrigerator Deluxe" font-size="48">VAN DE STEMMEN</text></svg>`);
};
export const renderMotmPng = async (data:Parameters<typeof renderMotmSvg>[0]) => {
  const [svg,...fonts]=await Promise.all([renderMotmSvg(data),...['bebas-neue-visual.woff2','refrigerator-deluxe-bold.otf','refrigerator-deluxe-heavy.otf','refrigerator-deluxe-regular.otf'].map(name=>asset(`/assets/fonts/${name}`))]);
  const directory=await mkdtemp(join(tmpdir(),'motm-fonts-'));
  try {
    const paths=await Promise.all(fonts.map(async(bytes,index)=>{const path=join(directory,`font-${index}${index===0?'.woff2':'.otf'}`);await writeFile(path,bytes);return path}));
    return new Resvg(svg.toString('utf8'),{fitTo:{mode:'original'},font:{loadSystemFonts:false,fontFiles:paths}}).render().asPng();
  } finally { await rm(directory,{recursive:true,force:true}); }
};

export const publishMotmWinner = async (match:any, winner:any, player:any) => {
  const visual=createMotmVisualData({status:'closed',slug:match.slug,opponent:match.opponent,homeOrAway:match.home_or_away,shirtNumber:player?.shirt_number_snapshot??null,winner});
  if (!visual) return {status:'skipped' as const};
  const attachment=await renderMotmPng(visual);
  return publishDiscord({idempotencyKey:`motm-winner:${match.id}:closed`,sourceType:'motm-winner',sourceId:String(match.id),text:`Definitieve Man of the Match: ${match.home_or_away==='home'?'Ajax':' '+match.opponent} - ${match.home_or_away==='home'?match.opponent:'Ajax'}\nWinnaar: ${winner.name_snapshot}`,attachment:{data:attachment,filename:visual.filename,mimeType:'image/png'},actorDiscordUserId:'system:motm'});
};
