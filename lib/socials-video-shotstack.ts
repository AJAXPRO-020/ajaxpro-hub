import { VideoError } from "./socials-video-data";
export const renderStates=new Set(["queued","fetching","preprocessing","rendering","saving"]);
export function trustedVideoUrl(value:unknown):value is string{
 if(typeof value!=="string")return false;
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&(u.hostname==="cdn.shotstack.io"||/^shotstack-api-(?:v1|stage)-output\.s3(?:[.-]ap-southeast-2)?\.amazonaws\.com$/.test(u.hostname))&&u.pathname.endsWith(".mp4")}catch{return false}
}
export function videoConfig(requireRenderReady=true){
 const key=process.env.SHOTSTACK_API_KEY?.trim(),music=process.env.SHOTSTACK_MUSIC_URL?.trim();
 if(!key||(requireRenderReady&&(process.env.SOCIALS_VIDEO_ENABLED!=="true"||!music)))throw new VideoError("Videogeneratie is nog niet ingesteld. Vraag de beheerder om de Shotstack-configuratie.",503);
 try{if(music&&new URL(music).protocol!=="https:")throw new Error()}catch{throw new VideoError("De muziekbron is niet juist ingesteld.",503)}
 return {key,music:music??"",version:process.env.SHOTSTACK_ENV==="stage"?"stage":"v1"};
}
export class SubmissionUncertain extends Error{}
const redactLogText=(value:string)=>value
 .replace(/bearer\s+[a-z0-9._~+/=-]+/gi,"Bearer [REDACTED]")
 .replace(/(api[_-]?key|token|secret|password|signature)=?[^\s&,;}]+/gi,"$1=[REDACTED]")
 .replace(/https?:\/\/[^\s"']+/gi,"[URL]")
 .slice(0,500);
const providerErrorCode=(body:unknown):string|undefined=>{
 if(!body||typeof body!=="object")return undefined;
 const b=body as Record<string,unknown>;
 for(const key of ["code","errorCode","error_code"]){
  if(typeof b[key]==="string")return redactLogText(b[key] as string);
 }
 for(const key of ["error","response","data"]){const nested=providerErrorCode(b[key]);if(nested)return nested}
 return undefined;
};
const providerErrorDetail=(body:unknown):string|undefined=>{
 if(typeof body==="string")return redactLogText(body);
 if(!body||typeof body!=="object")return undefined;
 const b=body as Record<string,unknown>;
 for(const key of ["message","detail","description","error"]){
  const value=b[key];
  if(typeof value==="string")return redactLogText(value);
  if(value&&typeof value==="object"){const nested=providerErrorDetail(value);if(nested)return nested}
 }
 return undefined;
};
type ProviderFailureKind="authentication"|"credits"|"invalid_request"|"rate_limit"|"provider";
const failureKind=(status:number,code?:string):ProviderFailureKind=>{
 const c=code?.toLowerCase()??"";
 if(status===401||status===403||c.includes("auth")||c.includes("key"))return "authentication";
 if(status===402||c.includes("credit")||c.includes("balance")||c.includes("quota"))return "credits";
 if(status===400||status===413||status===422||c.includes("invalid")||c.includes("payload"))return "invalid_request";
 if(status===429)return "rate_limit";
 return "provider";
};
export function shotstackClient(fetcher:typeof fetch=fetch){
 const call=async(path:string,method="GET",body?:unknown)=>{
  const config=videoConfig(false);let response:Response;
  const operation=`${method} /${path.split("?")[0]}`;
  try{response=await fetcher(`https://api.shotstack.io/${path}`,{method,headers:{"x-api-key":config.key,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12_000),redirect:"error"})}
  catch{if(method==="POST")throw new SubmissionUncertain();throw new VideoError("Shotstack-status is tijdelijk niet bereikbaar. Probeer de status later opnieuw.",502)}
  if(!response.ok){
   let providerBody:unknown;
   const raw=await response.text().catch(()=>"");
   try{providerBody=raw?JSON.parse(raw):undefined}catch{providerBody=raw||undefined}
   const code=providerErrorCode(providerBody),kind=failureKind(response.status,code);
   console.error("Shotstack request failed",{operation,status:response.status,kind,errorCode:code??"unknown",detail:providerErrorDetail(providerBody),environment:config.version,payloadBytes:body===undefined?0:Buffer.byteLength(JSON.stringify(body))});
   if(method==="POST"&&response.status>=500)throw new SubmissionUncertain();
   throw new VideoError(response.status===401||response.status===403?"Shotstack weigert toegang. Controleer de serverconfiguratie en het beschikbare tegoed.":response.status===429?"Shotstack is tijdelijk druk. Er is geen automatische nieuwe render gestart.":"Shotstack heeft de aanvraag geweigerd. Controleer de configuratie en het tegoed.",502);
  }
  try{return await response.json()}catch{if(method==="POST")throw new SubmissionUncertain();throw new VideoError("Ongeldig antwoord van Shotstack.",502)}
 };
 return {
  async submit(edit:unknown){const c=videoConfig(),p=await call(`edit/${c.version}/render`,"POST",edit);const id=p?.response?.id;if(!p.success||typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))throw new SubmissionUncertain();return id as string},
  async status(id:string){const c=videoConfig(false);const p=await call(`edit/${c.version}/render/${encodeURIComponent(id)}?data=false`);if(!p.success||p.response?.id!==id)throw new VideoError("Ongeldige renderstatus van Shotstack.",502);return p.response as {id:string;status:string;url?:string;updated?:string;error?:unknown}},
  async hosted(id:string){const c=videoConfig(false),p=await call(`serve/${c.version}/assets/render/${encodeURIComponent(id)}`);return (p.data as any[]|undefined)?.find(a=>a.attributes?.status==="ready"&&a.attributes?.renderId===id&&trustedVideoUrl(a.attributes?.url))?.attributes.url as string|undefined},
 };
}
