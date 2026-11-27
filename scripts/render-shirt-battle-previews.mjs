import fs from 'node:fs/promises';
import path from 'node:path';
import handler from '../lib/shirt-battle/share.mjs';
import { IDS } from '../lib/shirt-battle/_shared.mjs';

const sets=[
 ['AJ-2007-T','AJ-1999-T','AJ-1993-U'],
 ['AJ-2006-U','AJ-1991-U','AJ-2001-U'],
 ['AJ-1995-T','AJ-1997-U','AJ-2004-U'],
 ['AJ-2000-T','AJ-2005-U','AJ-1999-U'],
 ['AJ-2003-T','AJ-1993-T','AJ-2007-U'],
 ['VAR-03','AJ-1998-CL-H','AJ-2004-THIRD-ABN'],
 ['AJ-1992-U','AJ-1996-T','AJ-2002-T'],
 ['AJ-2004-U','AJ-1994-U','AJ-2006-T'],
 ['AJ-1997-T','AJ-2001-U','AJ-1995-U'],
 ['AJ-1991-T','AJ-1998-U','AJ-2003-U']
];
const out='/Users/zag/Documents/ChatGPT/crap/review-previews-2026-11-27/exports';
await fs.mkdir(out,{recursive:true});
for(const [index,ids] of sets.entries()){
 const n=ids.reduce((sum,id,i)=>sum+IDS.indexOf(id)*[1600,40,1][i],0),token='v1.'+n.toString(36);
 for(const format of ['story','square','og']){
  const response={statusCode:200,headers:{},setHeader(key,value){this.headers[key]=value},end(body){this.body=body}};
  await handler({url:`/api/shirt-battle/share/${token}?token=${token}&format=${format}`,headers:{'x-forwarded-for':'local-preview-'+index}},response);
  if(response.statusCode!==200)throw new Error(`${index} ${format}: ${response.statusCode} ${String(response.body).slice(0,120)}`);
  const filename=`${String(index+1).padStart(2,'0')}-${format}.png`;
  await fs.writeFile(path.join(out,filename),response.body);
  console.log(filename,token,ids.join(','),response.body.length);
 }
}
