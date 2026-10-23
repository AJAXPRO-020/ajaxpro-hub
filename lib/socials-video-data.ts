import { statsFieldById } from "./socials-stats";
import { createHash } from "node:crypto";
import type { SocialMatchdayFixture } from "./socials-match-context";
import type { SocialsMatchStatsSnapshot } from "./socials-stats-snapshots";
import type { FotMobSocialsTeamStats } from "./fotmob-socials-parser";

export const VIDEO_TEMPLATE_VERSION="ajaxpro-v11-shotstack-1";
export type VideoData={home:string;away:string;date:string;competition:string;homeScore:number;awayScore:number;stats:{label:string;home:number;away:number;suffix:string;decimals:number}[];followText:string};
export class VideoError extends Error{constructor(message:string,readonly status=409){super(message)}}
const name=(v:string)=>v.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^a-z0-9]/g,"").replace(/^afcajax$/, "ajax");
const validNumber=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0;
const integer=(v:unknown):v is number=>validNumber(v)&&Number.isSafeInteger(v);
const specs:readonly [keyof FotMobSocialsTeamStats,string,string,number][]=[
 ["possession","BALBEZIT","%",0],["shots","SCHOTEN","",0],["shotsOnTarget","SCHOTEN OP DOEL","",0],["xg","EXPECTED GOALS","",2],
 ["bigChances","GROTE KANSEN","",0],["corners","HOEKSCHOPPEN","",0],["passes","PASSES","",0],
];
export function videoData(f:SocialMatchdayFixture,s:SocialsMatchStatsSnapshot|null,now=Date.now()):VideoData{
 if(!s)throw new VideoError("Geen statistieksnapshot opgeslagen. Gebruik eerst ‘Stats ophalen’.");
 if(!s.match||typeof s.match!=="object"||!s.teamStats||!s.opponentTeamStats||typeof s.match.homeTeam!=="string"||typeof s.match.awayTeam!=="string")throw new VideoError("De opgeslagen snapshot is onvolledig. Ververs de stats.");
 const kickoff=new Date(f.kickoff_at),parsed=new Date(s.match.date??"");
 if(!Number.isFinite(kickoff.getTime())||kickoff.getTime()>now||!(["FT","AET","PEN","FINISHED","MATCH_FINISHED"].includes(f.provider_status??"")||f.finished_at))throw new VideoError("De wedstrijd heeft nog geen bevestigde eindstand.");
 if(!integer(f.goals_home)||!integer(f.goals_away)||!integer(s.match.homeScore)||!integer(s.match.awayScore))throw new VideoError("Een betrouwbare eindstand ontbreekt.");
 if(!f.competition?.trim()||!f.home_team?.trim()||!f.away_team?.trim())throw new VideoError("Teamnamen of competitie ontbreken.");
 if(f.competition.length>120||Math.max(f.home_team.length,f.away_team.length)>150)throw new VideoError("Wedstrijdgegevens zijn ongeldig.");
 const ajaxHome=name(f.home_team)==="ajax",ajaxAway=name(f.away_team)==="ajax";
 if(ajaxHome===ajaxAway||s.fixtureKey!==f.fixture_key||!integer(s.match.fotmobId)||s.match.fotmobId===0||name(s.match.homeTeam??"")!==name(f.home_team)||name(s.match.awayTeam??"")!==name(f.away_team)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==kickoff.toISOString().slice(0,10)||s.match.homeScore!==f.goals_home||s.match.awayScore!==f.goals_away)throw new VideoError("Snapshot en geselecteerde wedstrijd komen niet overeen. Ververs de stats en controleer de eindstand.");
 const home=ajaxHome?s.teamStats:s.opponentTeamStats,away=ajaxHome?s.opponentTeamStats:s.teamStats;
 if(!home||!away)throw new VideoError("Teamstatistieken ontbreken.");
 const stats:VideoData["stats"]=[];
 for(const [key,label,suffix,decimals] of specs){
  const h=home[key],a=away[key];if(h==null||a==null)continue;
  const max=statsFieldById(key)?.max??(key==="passes"?5000:99);
  if(!validNumber(h)||!validNumber(a)||h>max||a>max||(!decimals&&key!=="possession"&&(!integer(h)||!integer(a))))throw new VideoError(`Ongeldige waarden voor ${label.toLowerCase()}. Ververs de stats.`);
  if(key==="possession"&&(h>100||a>100||Math.abs(h+a-100)>2))throw new VideoError("Balbezitwaarden zijn niet betrouwbaar. Ververs de stats.");
  stats.push({label,home:h,away:a,suffix,decimals});
 }
 if(stats.length<4)throw new VideoError("Er zijn minder dan vier complete statistieken beschikbaar voor beide teams. Ververs de stats.");
 for(const team of [home,away])if(validNumber(team.shotsOnTarget)&&validNumber(team.shots)&&team.shotsOnTarget>team.shots)throw new VideoError("Schoten op doel zijn hoger dan het totaal. Ververs de stats.");
 return {home:f.home_team.toUpperCase(),away:f.away_team.toUpperCase(),date:new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Amsterdam"}).format(kickoff).toUpperCase(),competition:f.competition.toUpperCase(),homeScore:f.goals_home,awayScore:f.goals_away,stats:stats.slice(0,4),followText:"ajaxpro.fans"};
}
const text=(v:unknown,label:string,max:number,uppercase=true)=>{if(typeof v!=="string"||!v.trim()||v.trim().length>max||/[\r\n]/.test(v))throw new VideoError(`${label} is ongeldig.`);return uppercase?v.trim().toUpperCase():v.trim()};
/** Validates the isolated render copy only. It never writes into fixture or FotMob data. */
export function editableVideoData(source:VideoData,input:unknown):VideoData{
 if(!input||typeof input!=="object"||Array.isArray(input))throw new VideoError("Videogegevens zijn ongeldig.",400);const v=input as Record<string,unknown>;
 const home=text(v.home,"Thuisteam",54),away=text(v.away,"Uitteam",54),date=text(v.date,"Wedstrijddatum",42),competition=text(v.competition,"Competitie",54),followText=text(v.followText,"Afsluitende tekst",34,false);
 const score=(value:unknown,label:string)=>{if(!integer(value)||value>99)throw new VideoError(`${label} is ongeldig.`);return value};
 if(!Array.isArray(v.stats)||v.stats.length!==4)throw new VideoError("Vul precies vier statistieken in.");
 const stats=v.stats.map((row,index)=>{if(!row||typeof row!=="object"||Array.isArray(row))throw new VideoError(`Statistiek ${index+1} is ongeldig.`);const r=row as Record<string,unknown>,base=source.stats[index];if(!base)throw new VideoError("Statistiekopzet is ongeldig.");const label=text(r.label,`Label van statistiek ${index+1}`,30);const value=(n:unknown,side:string)=>{if(!validNumber(n)||n>5000||(!base.decimals&&!integer(n)))throw new VideoError(`${side} bij ${label} is ongeldig.`);return n};return {label,home:value(r.home,"Thuisteam"),away:value(r.away,"Uitteam"),suffix:base.suffix,decimals:base.decimals}});
 return {home,away,date,competition,homeScore:score(v.homeScore,"Eindstand thuis"),awayScore:score(v.awayScore,"Eindstand uit"),stats,followText};
}
export const videoHash=(data:VideoData,musicUrl:string)=>createHash("sha256").update(JSON.stringify({version:VIDEO_TEMPLATE_VERSION,data,musicUrl})).digest("hex");
