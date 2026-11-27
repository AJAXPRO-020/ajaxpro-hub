import fs from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from '@vercel/og';
import React from 'react';
import { recordsFor, cacheHeaders, PUBLIC_ORIGIN } from './_shared.mjs';

export const config={runtime:'nodejs'};
const h=React.createElement;
const fontStyle={fontFamily:'AjaxPro',fontWeight:900};
const WINDOW_MS=60_000,MAX_REQUESTS=24,MAX_ACTIVE=2,requestLog=new Map();
let active=0;
function clientKey(req){const value=req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown';return String(value).split(',')[0].trim().slice(0,80)||'unknown'}
function allowRequest(req){const now=Date.now(),key=clientKey(req),recent=(requestLog.get(key)||[]).filter(time=>now-time<WINDOW_MS);if(recent.length>=MAX_REQUESTS||active>=MAX_ACTIVE){requestLog.set(key,recent);return false}recent.push(now);requestLog.set(key,recent);if(requestLog.size>1000){for(const [entry,times] of requestLog)if(!times.some(time=>now-time<WINDOW_MS))requestLog.delete(entry)}return true}

const formats={
  story:{width:1080,height:1920,logo:{x:501,y:62,w:78,h:90},campaign:{y:240,size:45},title:{y:315,size:115},entries:[{x:215,y:520,w:650,h:760},{x:96,y:1320,w:380,h:465},{x:604,y:1320,w:380,h:465}],footer:{y:1830,size:38}},
  square:{width:1080,height:1080,logo:{x:513,y:38,w:54,h:65},campaign:{y:120,size:35},title:{y:180,size:89},entries:[{x:300,y:300,w:480,h:455},{x:64,y:700,w:340,h:275},{x:676,y:700,w:340,h:275}],footer:{y:1020,size:30}},
  og:{width:1200,height:630,logo:{x:580,y:12,w:40,h:48},campaign:{y:71,size:23},title:{y:108,size:54},entries:[{x:452,y:170,w:296,h:265},{x:317,y:405,w:218,h:158},{x:665,y:405,w:218,h:158}],footer:{y:594,size:20}}
};
const english=type=>({'Thuis':'Home','Uit':'Away','Special thuis':'Special Home','UEFA Cup uit':'UEFA Away','Derde shirt':'Third','Champions League thuis':'CL Home','Europees: Champions League thuis':'CL Home','De Meer thuis':'De Meer Home'}[type]||type);
function centeredText(text,y,size,width){return h('div',{style:{position:'absolute',top:y,left:0,width,display:'flex',justifyContent:'center',fontSize:size,lineHeight:1,textAlign:'center',...fontStyle}},text)}
function entry(record,rank,box,format,imageSource){
  const labelSize=format==='og'?17:format==='square'?24:31;
  const numberSize=format==='og'?26:format==='square'?39:49;
  const imageHeight=box.h-(format==='og'?53:format==='square'?73:92);
  return h('div',{key:record.id,style:{position:'absolute',left:box.x,top:box.y,width:box.w,height:box.h,display:'flex',flexDirection:'column',alignItems:'center',...fontStyle}},
    h('img',{src:imageSource,width:box.w,height:imageHeight,style:{width:box.w,height:imageHeight,objectFit:'contain'}}),
    h('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',width:'100%',color:'#f6f7fb',textAlign:'center',lineHeight:1}},
      h('span',{style:{fontSize:numberSize}},`0${rank}`),
      h('span',{style:{fontSize:labelSize}},record.season+' / '+english(record.type))));
}
function compose(records,format,images,logo){
  const layout=formats[format],{width,height}=layout;
  return h('div',{style:{position:'relative',display:'flex',width,height,overflow:'hidden',color:'#f6f7fb',backgroundColor:'#05070d',backgroundImage:'radial-gradient(ellipse 46% 36% at 77% 20%,rgba(151,20,43,.46),transparent 82%),radial-gradient(ellipse 68% 49% at 17% 57%,rgba(122,13,35,.29),transparent 80%),radial-gradient(ellipse 54% 36% at 83% 92%,rgba(83,9,26,.16),transparent 82%)',...fontStyle}},
    h('img',{src:logo,width:layout.logo.w,height:layout.logo.h,style:{position:'absolute',left:layout.logo.x,top:layout.logo.y,width:layout.logo.w,height:layout.logo.h,objectFit:'contain'}}),
    centeredText('THE ABN AMRO ERA / 1991–2008',layout.campaign.y,layout.campaign.size,width),
    centeredText('AJAX SHIRTS TOP 3',layout.title.y,layout.title.size,width),
    ...records.map((record,index)=>entry(record,index+1,layout.entries[index],format,images[index])),
    centeredText('PLAY ON AJAXPRO.FANS',layout.footer.y,layout.footer.size,width));
}
export default async function handler(req,res){
  if(!allowRequest(req)){res.statusCode=429;res.setHeader('Retry-After','60');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end('Too many image requests');return}
  active++;
  try{
    const url=new URL(req.url,`${PUBLIC_ORIGIN}/`),records=await recordsFor(url.searchParams.get('token'));
    if(!records){res.statusCode=400;res.end('Invalid Shirt Battle result');return}
    const format=Object.hasOwn(formats,url.searchParams.get('format'))?url.searchParams.get('format'):'story';
    const font=await fs.readFile(path.join(process.cwd(),'ajaxpro-refrigerator-heavy.otf'));
    const images=await Promise.all(records.map(async record=>'data:image/png;base64,'+(await fs.readFile(path.join(process.cwd(),'assets/shirt-battle/cutouts',record.id+'.png'))).toString('base64')));
    const logo='data:image/png;base64,'+(await fs.readFile(path.join(process.cwd(),'ajaxpro-logo.png'))).toString('base64');
    const image=new ImageResponse(compose(records,format,images,logo),{width:formats[format].width,height:formats[format].height,fonts:[{name:'AjaxPro',data:font,weight:900,style:'normal'}],headers:cacheHeaders()});
    res.statusCode=200;res.setHeader('Content-Type','image/png');for(const [key,value] of Object.entries(cacheHeaders()))res.setHeader(key,value);res.end(Buffer.from(await image.arrayBuffer()));
  }catch(error){console.error('Shirt Battle image generation failed',error);res.statusCode=500;res.setHeader('Content-Type','text/plain');res.end('Image generation failed')}
  finally{active--}
}
