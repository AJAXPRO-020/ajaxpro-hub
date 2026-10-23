import { VideoError } from "./socials-video-data";
import { videoService } from "./socials-video";
import type { Session } from "./discord-auth";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store"}});
export async function handleVideo(request:Request,session:Session,service=videoService(),fetcher:typeof fetch=fetch){
 const u=new URL(request.url),view=u.searchParams.get("view");
 try{
  if(request.method==="GET"&&view==="socials-video")return json(await service.overview(u.searchParams.get("fixture")??""));
  if(request.method==="POST"&&view==="socials-video"){
   const origin=request.headers.get("origin");
   if(origin&&origin!==u.origin||request.headers.get("sec-fetch-site")==="cross-site")return json({error:"Ververs de pagina en probeer opnieuw."},403);
   if(!request.headers.get("content-type")?.startsWith("application/json"))return json({error:"JSON-aanvraag vereist."},415);
   const reader=request.body?.getReader();let text="",bytes=0;const decoder=new TextDecoder();
   if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2048){await reader.cancel();return json({error:"Aanvraag is te groot."},413)}text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}finally{reader.releaseLock()}
   let b:any;try{b=JSON.parse(text)}catch{return json({error:"Ongeldige aanvraag."},400)}
   if(typeof b.fixture!=="string"||typeof b.requestKey!=="string"||(b.regenerateOf!==undefined&&typeof b.regenerateOf!=="string")||(b.data!==undefined&&(typeof b.data!=="object"||b.data===null)))return json({error:"Ongeldige aanvraag."},400);
   return json({job:await service.start(b.fixture,session.userId,b.requestKey,b.regenerateOf,b.data)},202);
  }
  if(request.method==="GET"&&view==="socials-video-media"){
   const job=await service.media(u.searchParams.get("id")??""),headers:Record<string,string>={};
   const range=request.headers.get("range");if(range){if(!/^bytes=(?:\d+-\d*|-\d+)$/.test(range))return json({error:"Ongeldig bereik."},416);headers.Range=range}
   const result=await fetcher(job.output_url!,{headers,redirect:"error",signal:AbortSignal.timeout(55_000)});
   if(!result.ok){if([403,404,410].includes(result.status))throw new VideoError("De downloadlink is niet meer beschikbaar. Controleer de renderstatus; genereer alleen bewust opnieuw.",410);throw new VideoError("De video kan tijdelijk niet worden gedownload.",502)}
   const h=new Headers({"Content-Type":"video/mp4","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":`${u.searchParams.get("download")==="1"?"attachment":"inline"}; filename="ajaxpro-${job.id}.mp4"`});
   for(const name of ["Content-Length","Content-Range","Accept-Ranges"])if(result.headers.has(name))h.set(name,result.headers.get(name)!);
   return new Response(result.body,{status:result.status,headers:h});
  }
  return json({error:"Methode niet toegestaan."},405);
 }catch(e){if(e instanceof VideoError)return json({error:e.message},e.status);console.error("Socials video operation failed",e instanceof Error?e.name:"unknown");return json({error:"Videogeneratie is tijdelijk niet beschikbaar. Controleer de serverconfiguratie."},503)}
}
