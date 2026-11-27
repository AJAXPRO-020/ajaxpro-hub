import fs from 'node:fs/promises';
import path from 'node:path';
import { PUBLIC_ORIGIN } from './_shared.mjs';
export const config={runtime:'nodejs'};
const IDS=['AJ-1991-T','AJ-1991-U','AJ-1992-T','AJ-1992-U','AJ-1993-T','AJ-1993-U','AJ-1994-T','AJ-1994-U','AJ-1995-T','AJ-1995-U','AJ-1996-T','AJ-1996-U','AJ-1997-T','AJ-1997-U','AJ-1998-T','AJ-1998-U','AJ-1999-T','AJ-1999-U','AJ-2000-T','AJ-2000-U','AJ-2001-T','AJ-2001-U','AJ-2002-T','AJ-2002-U','AJ-2003-T','AJ-2003-U','AJ-2004-T','AJ-2004-U','AJ-2005-T','AJ-2005-U','AJ-2006-T','AJ-2006-U','AJ-2007-T','AJ-2007-U','VAR-02','VAR-03','VAR-04','VAR-05','AJ-1998-CL-H','AJ-2004-THIRD-ABN'];
async function catalog(){let file=path.join(process.cwd(),'assets/ajax-shirts/shirts.json');try{await fs.access(file)}catch{file=path.join(process.cwd(),'public/assets/ajax-shirts/shirts.json')}return JSON.parse(await fs.readFile(file,'utf8'))}
export default async function handler(req,res){
  const url=new URL(req.url,'https://'+(req.headers?.host||process.env.VERCEL_URL||'localhost'));
  const origin=PUBLIC_ORIGIN;
  const token=url.searchParams.get('token')||/^\/shirts\/r\/(v1\.[0-9a-z]+)$/i.exec(url.pathname)?.[1];
  const c=await catalog();
  let records=null;
  const match=/^v1\.([0-9a-z]+)$/i.exec(token||'');
  if(match){
    const n=parseInt(match[1],36),indexes=[Math.floor(n/1600),Math.floor(n/40)%40,n%40];
    if(n>=0&&n<64000&&new Set(indexes).size===3){
      const by=new Map(c.records.map(r=>[r.id,r]));
      records=indexes.map(i=>by.get(IDS[i]));
      if(!records.every(Boolean))records=null;
    }
  }
  if(!records){
    res.statusCode=404;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<h1>Invalid Shirt Battle result</h1><p><a href="/shirts">Play the Shirt Battle</a></p>');
    return;
  }
  const cleanUrl=origin+'/shirts/r/'+token;
  const image=origin+'/api/shirt-battle/share/'+token+'?format=og';
  const head='<meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#05070d"><title>Ajax Shirts Top 3 — AjaxPro</title><link rel="canonical" href="'+cleanUrl+'"><meta property="og:type" content="website"><meta property="og:url" content="'+cleanUrl+'"><meta property="og:title" content="Ajax Shirts Top 3"><meta property="og:description" content="The ABN AMRO Era. What’s your top 3? Play on AjaxPro.fans"><meta property="og:image" content="'+image+'"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">';
  let html;
  if(url.searchParams.get('view')==='game'||url.pathname.startsWith('/shirts/r/')){
    html='<!doctype html><html lang="en"><head>'+head+'<link rel="stylesheet" href="/assets/shirt-battle/concepts.css"><link rel="stylesheet" href="/assets/shirt-battle/palettes.css"><link rel="stylesheet" href="/assets/shirt-battle/presentation.css?v=start-final-20261127"><link rel="stylesheet" href="/assets/shirt-battle/duel-polish.css"><link rel="stylesheet" href="/assets/shirt-battle/result.css"></head><body><main id="app"></main><script src="/assets/shirt-battle/battle-logic.js"></script><script src="/assets/shirt-battle/app.js?v=start-final-20261127"></script><script src="/assets/shirt-battle/result-screen.js"></script><script src="/assets/shirt-battle/copy-polish.js"></script></body></html>';
  }else{
    const labels=records.map((r,i)=>'<li><strong>0'+(i+1)+'</strong> '+r.season+' — '+r.type+'</li>').join('');
    html='<!doctype html><html lang="en"><head>'+head+'</head><body><main><p>AJAXPRO / THE ABN AMRO ERA</p><h1>AJAX SHIRTS TOP 3</h1><ol>'+labels+'</ol><p>What’s your top 3?</p><a href="/shirts">PLAY NOW</a></main></body></html>';
  }
  res.statusCode=200;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=31536000, stale-while-revalidate=86400');
  res.end(html);
}
