import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VideoData } from "./socials-video-data";
let base:{type:string;html:string;css:string;js:string}|undefined;
export function buildVideoEdit(data:VideoData,musicUrl:string){
 base??=JSON.parse(readFileSync(join(process.cwd(),"assets/social-video/template.json"),"utf8"));
 // Replace the original injected data literal, preserving all drawing logic.
 const js=base!.js.replace(/const match = [\s\S]*?;\n  const metrics =/,()=>`const match = ${JSON.stringify(data)};\n  const metrics =`).replace("text('Ajaxpro.fans',72,1190,96,paper,'bold',936,'center')","text(match.followText,72,1190,96,paper,'bold',936,'center')");
 if(js===base!.js&&!base!.js.includes(JSON.stringify(data)))throw new Error("Videotemplate kon niet geladen worden.");
 const edit={timeline:{background:"#050506",tracks:[{clips:[{asset:{...base!,js},start:0,length:17,width:1080,height:1920,fit:"none"}]},{clips:[{asset:{type:"audio",src:musicUrl,trim:0,volume:[{from:1,to:1,start:0,length:14,interpolation:"linear"},{from:1,to:0,start:14,length:3,interpolation:"linear"}]},start:0,length:17}]}]},output:{format:"mp4",size:{width:1080,height:1920},fps:30,quality:"veryhigh",destinations:[{provider:"shotstack",exclude:false}]}};
 if(Buffer.byteLength(JSON.stringify(edit))>390_000)throw new Error("Videotemplate overschrijdt de Shotstack-limiet.");
 return edit;
}
