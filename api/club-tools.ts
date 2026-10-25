import { handleVideo } from "../lib/socials-video-http";
import { redirect } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import { getSessionWithCurrentRoles, getSessionWithPermission } from "../lib/server-permissions";
import { errorPage, page, pageHeader } from "../lib/motm-view";
import { renderToolsGrid, toolsForSession } from "../lib/portal-tools.config";
import { renderSocials } from "../api-impl/socials/index";
import { loadSocialPlayerStats, SocialPlayerStatsProviderError } from "../lib/socials-player-stats-provider";
import { loadSocialsMatchStats, SocialsMatchStatsError } from "../lib/socials-match-stats";
import { loadSocialsMatchStatsSnapshot, saveSocialsMatchStatsSnapshot } from "../lib/socials-stats-snapshots";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=UTF-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
const playerStatsCache=new Map<string,{expiresAt:number;payload:Awaited<ReturnType<typeof loadSocialPlayerStats>>}>();
const cachedPlayerStats=async(fixtureKey:string)=>{
  const cached=playerStatsCache.get(fixtureKey),now=Date.now();
  if(cached&&cached.expiresAt>now)return cached.payload;
  const payload=await loadSocialPlayerStats(fixtureKey);
  playerStatsCache.set(fixtureKey,{expiresAt:now+5*60_000,payload});
  return payload;
};

export async function GET(request:Request){
  const view=new URL(request.url).searchParams.get("view");
  const returnTo=view==="socials"||view==="socials-player-stats"||view==="socials-match-stats"?"/club/tools/socials":"/club/tools";
  if(view?.startsWith("socials-video")){
    const session=await getSessionWithCurrentRoles(request);
    if(!session)return json({error:"Geen toegang tot de staffomgeving."},401);
    const staff=await getSessionWithPermission(request,permissions.staffAccess);
    if(!staff)return json({error:"Geen toegang tot de staffomgeving."},403);
    const allowed=await getSessionWithPermission(request,permissions.toolsSocials);
    return allowed?handleVideo(request,allowed):json({error:"Geen toegang tot videogeneratie."},401);
  }
  const session=await getSessionWithCurrentRoles(request);
  if(!session)return redirect(`/api/auth/discord-login?returnTo=${returnTo}`);
  const staff=await getSessionWithPermission(request,permissions.staffAccess);
  if(!staff)return errorPage("Geen toegang","Deze staffomgeving is alleen beschikbaar voor Moderators, Admins en de Socials-rol.",403,session,"/club/stand","motm");
  if(view==="socials"){
    const allowed=await getSessionWithPermission(request,permissions.toolsSocials);
    if(!allowed)return errorPage("Geen toegang","Voor jouw Club-account is Socials niet beschikbaar.",403,session,"/club/tools","tools");
    const url=new URL(request.url);
    const localVideoPreview=process.env.NODE_ENV==="development"&&["localhost","127.0.0.1"].includes(url.hostname)&&url.searchParams.get("video-preview")==="1";
    return renderSocials(allowed,undefined,undefined,undefined,localVideoPreview);
  }
  if(view==="socials-player-stats"){
    const allowed=await getSessionWithPermission(request,permissions.toolsSocials);
    if(!allowed)return json({error:"forbidden"},403);
    const fixtureKey=new URL(request.url).searchParams.get("fixture")??"";
    try{return json(await cachedPlayerStats(fixtureKey));}
    catch(error){
      if(error instanceof SocialPlayerStatsProviderError)return json({error:error.message},error.status);
      console.error("Unable to load Socials player statistics",error);
      return json({error:"Spelerstatistieken zijn tijdelijk niet beschikbaar."},500);
    }
  }
  if(view==="socials-match-stats"){
    const allowed=await getSessionWithPermission(request,permissions.toolsSocials);
    if(!allowed)return json({error:"forbidden"},403);
    const fixtureKey=new URL(request.url).searchParams.get("fixture")??"";
    try{const snapshot=await loadSocialsMatchStatsSnapshot(fixtureKey);return snapshot?json(snapshot):json({error:"Nog geen stats opgeslagen."},404);}
    catch(error){
      if(error instanceof SocialsMatchStatsError)return json({error:error.message},error.status);
      console.error("Unable to load normalized Socials match statistics",error);
      return json({error:"Fout bij ophalen."},500);
    }
  }
  const tools=toolsForSession(session);
  return page("Staff-tools",`<main class="motm-main">${pageHeader("Staff-tools","Intern")}<p class="page-intro">Hulpmiddelen die bij jouw rechten horen.</p>${tools.length?renderToolsGrid(tools):'<section class="empty"><h2>Geen tools beschikbaar</h2><p>Voor jouw rol zijn er momenteel geen afzonderlijke tools beschikbaar.</p></section>'}</main>`,"",session,"tools");
}

export async function POST(request:Request){
  const view=new URL(request.url).searchParams.get("view");
  const session=await getSessionWithPermission(request,permissions.portalAccess);
  if(!session)return new Response("Unauthorized",{status:401});
  const staff=await getSessionWithPermission(request,permissions.staffAccess);
  if(!staff)return new Response("Forbidden",{status:403});
  if(view==="socials-video"){
    const allowed=await getSessionWithPermission(request,permissions.toolsSocials);
    return allowed?handleVideo(request,allowed):json({error:"Geen toegang tot videogeneratie."},403);
  }
  if(view!=="socials-match-stats-import")return new Response("Method not allowed",{status:405,headers:{Allow:"GET"}});
  const allowed=await getSessionWithPermission(request,permissions.toolsSocials);
  if(!allowed)return json({error:"forbidden"},403);
  let fixtureKey="";try{fixtureKey=String((await request.json())?.fixture??"")}catch{return json({error:"Ongeldige wedstrijd."},400)}
  try{return json(await saveSocialsMatchStatsSnapshot(await loadSocialsMatchStats(fixtureKey)));}
  catch(error){
    if(error instanceof SocialsMatchStatsError)return json({error:error.message},error.status);
    console.error("Unable to import Socials match statistics",error);
    return json({error:"Fout bij ophalen."},500);
  }
}
