import { videoData,editableVideoData,videoHash,VideoError,type VideoData } from "./socials-video-data";
import { loadSocialMatchdayFixtures,type SocialMatchdayFixture } from "./socials-match-context";
import { loadSocialsMatchStatsSnapshot,type SocialsMatchStatsSnapshot } from "./socials-stats-snapshots";
import { buildVideoEdit } from "./socials-video-template";
import { shotstackClient,videoConfig,SubmissionUncertain,trustedVideoUrl,renderStates } from "./socials-video-shotstack";
import { postgresVideoStore,isActive,type VideoStore,type VideoJob } from "./socials-video-store";
export type VideoDependencies={store:VideoStore;fixtures:()=>Promise<SocialMatchdayFixture[]>;snapshot:(key:string)=>Promise<SocialsMatchStatsSnapshot|null>;client:ReturnType<typeof shotstackClient>;config:()=>{music:string};build:(data:VideoData,music:string)=>unknown;now:()=>number};
const defaults=():VideoDependencies=>({store:postgresVideoStore(),fixtures:loadSocialMatchdayFixtures,snapshot:loadSocialsMatchStatsSnapshot,client:shotstackClient(),config:videoConfig,build:buildVideoEdit,now:Date.now});
export const publicJob=(j:VideoJob & {providerStage?:string})=>({id:j.id,fixtureKey:j.fixture_key,status:j.status,stage:j.providerStage??j.status,data:j.render_data,createdAt:j.created_at,updatedAt:j.updated_at,error:j.error,availableUntil:j.available_until,mediaUrl:j.status==="done"?`/api/club-tools?view=socials-video-media&id=${j.id}`:null});
export const STALE_RENDER_MS=30*60_000;
export function videoService(overrides:Partial<VideoDependencies>={}){
 const d={...defaults(),...overrides};
 const fixture=async(key:string)=>{if(!key||key.length>300)throw new VideoError("Ongeldige wedstrijd.",400);const f=(await d.fixtures()).find(f=>f.fixture_key===key);if(!f)throw new VideoError("Wedstrijd niet gevonden.",404);return f};
 async function refresh(j:VideoJob):Promise<VideoJob & {providerStage?:string}>{
  if(j.status==="done"&&j.output_url?.startsWith("https://cdn.shotstack.io/")&&trustedVideoUrl(j.output_url))return j;
  if(j.status==="submitting"&&!j.render_id&&d.now()-new Date(j.created_at).getTime()>120_000)return d.store.patch(j.id,{status:"uncertain",error:"De verzending kon niet worden bevestigd. De beheerder moet deze opdracht bij Shotstack controleren voordat opnieuw genereren mogelijk is."});
  if(!j.render_id||!["queued","fetching","rendering","done","expired"].includes(j.status)||!await d.store.claimCheck(j.id))return j;
  // Read-only reconciliation: never resubmit a render when polling or reloading.
  const result=await d.client.status(j.render_id);
  if(result.status==="failed")return d.store.patch(j.id,{status:"failed",error:"Shotstack kon de video niet maken. Controleer de gegevens en probeer bewust opnieuw."});
  if(result.status==="done"){
   let hosted:string|undefined;try{hosted=await d.client.hosted(j.render_id)}catch{/* Temporary output can still be used. */}
   const url=hosted??result.url;if(!trustedVideoUrl(url))throw new VideoError("Shotstack heeft nog geen bruikbare download beschikbaar.",502);
   const completed=new Date(result.updated??j.updated_at).getTime(),until=hosted?null:new Date(completed+24*3600_000).toISOString();
   if(until&&new Date(until).getTime()<=d.now())return d.store.patch(j.id,{status:"expired",output_url:null,error:"De download is verlopen. Je kunt bewust een nieuwe video genereren."});
   return d.store.patch(j.id,{status:"done",output_url:url,available_until:until,error:null});
  }
  if(renderStates.has(result.status))return {...await d.store.patch(j.id,{status:result.status==="queued"?"queued":["fetching","preprocessing"].includes(result.status)?"fetching":"rendering"}),providerStage:result.status};
  throw new VideoError("Shotstack gaf een onbekende status. Er is geen nieuwe render gestart.",502);
 }
 return {
  refresh,
  async recover(id:string){
   const job=await d.store.get(id);
   if(!job||!isActive(job)||d.now()-new Date(job.created_at).getTime()<STALE_RENDER_MS)throw new VideoError("Deze render is nog niet lang genoeg actief om vrij te geven.",409);
   return publicJob(await d.store.recover(id)??job);
  },
  async overview(key:string){const f=await fixture(key),s=await d.snapshot(key);let data:VideoData|null=null,validationError:string|null=null,configError:string|null=null;
   try{data=videoData(f,s,d.now())}catch(e){if(e instanceof VideoError)validationError=e.message;else throw e}
   try{d.config()}catch(e){configError=e instanceof VideoError?e.message:"Videogeneratie is nog niet ingesteld."}
   let jobs=await d.store.list(key),statusWarning:string|null=null;
   if(jobs[0])try{jobs[0]=await refresh(jobs[0])}catch(e){statusWarning=e instanceof VideoError?e.message:"Status tijdelijk niet beschikbaar."}
   return {data,validationError,configError,statusWarning,ready:Boolean(data&&!configError),locked:jobs.some(job=>job.status==="done"||job.status==="expired"),jobs:jobs.map(publicJob)};
  },
  async start(key:string,actor:string,requestKey:string,regenerateOf?:string,edited?:unknown){
   if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestKey)||regenerateOf&&!/^[0-9a-f-]{36}$/i.test(regenerateOf))throw new VideoError("Ongeldige aanvraagcode.",400);
   const f=await fixture(key),s=await d.snapshot(key),source=videoData(f,s,d.now()),data=edited===undefined?source:editableVideoData(source,edited),config=d.config(),edit=d.build(data,config.music);
   const {job,created}=await d.store.reserve({fixture:f,snapshot:s!,data,hash:videoHash(data,config.music),actor,requestKey,regenerateOf});
   if(!created)return publicJob(await refresh(job));
   let renderId:string;
   try{renderId=await d.client.submit(edit)}catch(e){
    if(e instanceof SubmissionUncertain)return publicJob(await d.store.patch(job.id,{status:"uncertain",error:"Shotstack heeft de ontvangst niet bevestigd. Er wordt niet automatisch opnieuw gerenderd. Laat de beheerder deze opdracht controleren."}));
    await d.store.patch(job.id,{status:"failed",error:e instanceof VideoError?e.message:"Videoaanvraag is mislukt."});throw e;
   }
   try{return publicJob(await d.store.patch(job.id,{render_id:renderId,status:"queued"}))}
   catch{console.error("Unable to persist accepted Socials render",{jobId:job.id,renderId});throw new VideoError("De render is verstuurd, maar de opslag kon niet worden bevestigd. Start geen nieuwe aanvraag; laat de beheerder dit controleren.",503)}
  },
  async media(id:string){if(!/^[0-9a-f-]{36}$/i.test(id))throw new VideoError("Ongeldige video.",400);const j=await d.store.get(id);if(!j)throw new VideoError("Video niet gevonden.",404);const current=await refresh(j);if(current.status!=="done"||!trustedVideoUrl(current.output_url))throw new VideoError(current.error??"De video is nog niet beschikbaar.",410);return current},
 };
}
