import {getSessionWithPermission} from '../lib/server-permissions';
import {permissions} from '../lib/permissions.config';
import {isVerticalCardPng,renderCardVideo} from '../lib/socials-card-video';

const json=(error:string,status:number)=>new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json; charset=UTF-8','Cache-Control':'private, no-store'}});

export async function POST(request:Request){
  const staff=await getSessionWithPermission(request,permissions.staffAccess);
  const allowed=staff&&await getSessionWithPermission(request,permissions.toolsSocials);
  if(!allowed)return json('Geen toegang tot de Social Media Generator.',403);
  if(Number(request.headers.get('content-length')??0)>4_300_000)return json('De drie PNG-kaarten zijn samen te groot voor deze export.',413);
  let encoded:unknown;
  try{encoded=(await request.json() as {cards?:unknown}).cards}catch{return json('Ongeldige kaartgegevens.',400)}
  if(!Array.isArray(encoded)||encoded.length!==3||encoded.some(item=>typeof item!=='string'||item.length>4_000_000))return json('Kies drie geldige kaarten.',400);
  const cards=encoded.map(item=>Buffer.from(item as string,'base64'));
  if(cards.some(card=>!isVerticalCardPng(card)))return json('Alle kaarten moeten 1080 × 1920 PNG zijn.',400);
  try{
    const video=await renderCardVideo(cards);
    if(video.length>4_400_000)return json('De MP4 is te groot voor directe download.',413);
    return new Response(new Uint8Array(video),{status:200,headers:{'Content-Type':'video/mp4','Content-Length':String(video.length),'Content-Disposition':'attachment; filename="ajaxpro-kaartvideo.mp4"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){console.error('Card video render failed',error);return json('De kaartvideo kon niet worden gemaakt. Probeer het opnieuw.',503)}
}
