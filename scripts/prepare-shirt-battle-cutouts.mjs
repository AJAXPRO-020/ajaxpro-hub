import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const { chromium }=require('/Users/zag/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..');
const catalog=JSON.parse(await fs.readFile(path.join(root,'assets/ajax-shirts/shirts.json'),'utf8'));
const ids=catalog.shirtBattleCollection.uniqueVariantIds;
const records=ids.map(id=>catalog.records.find(record=>record.id===id));
if(records.length!==40||records.some(record=>!record))throw new Error('Expected 40 shirt records');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();
await page.goto('http://127.0.0.1:8464/clean-preview.html');
const output=path.join(root,'assets/shirt-battle/cutouts');
await fs.mkdir(output,{recursive:true});
try{
  for(const record of records){
    const url='/'+record.finalTransparentLocalPath.replace(/^public\//,'');
    const result=await page.evaluate(async imageUrl=>{
      const image=new Image();image.src=imageUrl;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
      let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>24){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
      if(right<left)throw new Error('Empty shirt image');
      const crop=document.createElement('canvas');crop.width=right-left+1;crop.height=bottom-top+1;
      crop.getContext('2d').drawImage(image,left,top,crop.width,crop.height,0,0,crop.width,crop.height);
      return {base64:crop.toDataURL('image/png').split(',')[1],width:crop.width,height:crop.height};
    },url);
    await fs.writeFile(path.join(output,record.id+'.png'),Buffer.from(result.base64,'base64'));
    console.log(record.id,result.width,result.height);
  }
}finally{await browser.close()}
