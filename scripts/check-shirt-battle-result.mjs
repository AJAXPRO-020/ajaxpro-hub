import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { IDS } from '../lib/shirt-battle/_shared.mjs';

const require=createRequire(import.meta.url);
const { chromium }=require('/Users/zag/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..');
const out='/Users/zag/Documents/ChatGPT/crap/review-previews-2026-11-27';
const sets=[['AJ-2007-T','AJ-1999-T','AJ-1993-U'],['AJ-2006-U','AJ-1991-U','AJ-2001-U'],['AJ-1995-T','AJ-1997-U','AJ-2004-U'],['AJ-2000-T','AJ-2005-U','AJ-1999-U'],['AJ-2003-T','AJ-1993-T','AJ-2007-U'],['VAR-03','AJ-1998-CL-H','AJ-2004-THIRD-ABN'],['AJ-1992-U','AJ-1996-T','AJ-2002-T'],['AJ-2004-U','AJ-1994-U','AJ-2006-T'],['AJ-1997-T','AJ-2001-U','AJ-1995-U'],['AJ-1991-T','AJ-1998-U','AJ-2003-U']];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of [320,375,390,430,1440]){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  await page.route('https://ajaxpro.fans/**',async route=>{
   const url=new URL(route.request().url());
   const filename=url.pathname.startsWith('/shirts/r/')||url.pathname==='/shirts'?path.join(root,'assets/shirt-battle/index.html'):path.join(root,url.pathname);
   try{const body=await fs.readFile(filename);const extension=path.extname(filename);await route.fulfill({status:200,body,contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.otf':'font/otf'})[extension]||'application/octet-stream'})}catch{await route.fulfill({status:404,body:'missing'})}
  });
  for(const [index,ids] of sets.entries()){
   if(width!==390&&index!==0)continue;
   const token='v1.'+ids.reduce((sum,id,i)=>sum+IDS.indexOf(id)*[1600,40,1][i],0).toString(36);
   await page.goto('https://ajaxpro.fans/shirts/r/'+token,{waitUntil:'domcontentloaded'});
   await page.locator('.shirt-result .result-entry img').first().waitFor({timeout:15000});
   await page.locator('.shirt-result .result-entry img').last().evaluate(image=>image.decode());
   const stats=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,shirts:[...document.querySelectorAll('.result-entry img')].map(image=>({loaded:image.complete&&image.naturalWidth>0,left:image.getBoundingClientRect().left,right:image.getBoundingClientRect().right})),title:document.querySelector('.shirt-result h1')?.textContent}));
   if(stats.overflow>1||stats.shirts.some(image=>!image.loaded||image.left<0||image.right>width))throw new Error(JSON.stringify({width,index,stats}));
   const filename=`result-${width}-${String(index+1).padStart(2,'0')}.png`;
   await page.screenshot({path:path.join(out,filename),fullPage:true});
   console.log(filename,token,stats.title);
  }
  await page.close();
 }
}finally{await browser.close()}
