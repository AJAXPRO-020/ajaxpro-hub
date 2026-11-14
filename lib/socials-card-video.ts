import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const ffmpegPath=require('ffmpeg-static') as string|null;
const cardNames=['wedstrijd-in-cijfers','uitblinker','schotenkaart'] as const;
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
const easing='P*P*(3-2*P)';
const sample=(plane:number,axis:'x'|'y')=>axis==='x'
  ?`if(lt(X,W*(${easing})),a${plane}(X+W*(1-(${easing})),Y),b${plane}(X-W*(${easing}),Y))`
  :`if(lt(Y,H*(${easing})),a${plane}(X,Y+H*(1-(${easing}))),b${plane}(X,Y-H*(${easing})))`;
const expression=(axis:'x'|'y')=>`if(eq(PLANE,0),${sample(0,axis)},if(eq(PLANE,1),${sample(1,axis)},${sample(2,axis)}))`;

export const isVerticalCardPng=(buffer:Buffer)=>buffer.length>=24&&buffer.subarray(0,8).equals(pngSignature)&&buffer.readUInt32BE(16)===1080&&buffer.readUInt32BE(20)===1920;

export const cardVideoArgs=(directory:string)=>{
  const args=['-hide_banner','-loglevel','error','-threads','1'];
  for(const name of cardNames)args.push('-loop','1','-framerate','1','-t','5','-i',join(directory,`${name}.png`));
  args.push('-loop','1','-framerate','1','-t','3','-i',resolve('assets/social-video/card-video-end.png'));
  const still='fps=30,trim=duration=4,setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1';
  const endCard='fps=30,trim=duration=2,setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1';
  const filter=`[0:v]${still}[v0];[1:v]${still}[v1];[2:v]${still}[v2];[3:v]${endCard}[end];[v0][v1]xfade=transition=custom:duration=0.4:offset=3.6:expr='${expression('x')}'[x1];[x1][v2]xfade=transition=custom:duration=0.4:offset=7.2:expr='${expression('y')}'[cards];[cards][end]xfade=transition=fade:duration=0.4:offset=10.8[out]`;
  args.push('-filter_complex',filter,'-map','[out]','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-r','30','-an','-y',join(directory,'kaartvideo.mp4'));
  return args;
};

export async function renderCardVideo(cards:Buffer[]):Promise<Buffer>{
  if(!ffmpegPath)throw new Error('FFmpeg ontbreekt in deze omgeving.');
  if(cards.length!==3||cards.some(card=>!isVerticalCardPng(card)))throw new RangeError('Kies drie complete kaarten in 9:16.');
  const directory=await mkdtemp(join(tmpdir(),'ajaxpro-card-video-'));
  try{
    await Promise.all(cards.map((card,index)=>writeFile(join(directory,`${cardNames[index]}.png`),card)));
    await new Promise<void>((resolve,reject)=>{
      const process=spawn(ffmpegPath,cardVideoArgs(directory),{stdio:['ignore','ignore','pipe']});
      let error='';
      process.stderr.on('data',(part:Buffer)=>{error=(error+part.toString()).slice(-1500)});
      const timer=setTimeout(()=>{process.kill('SIGKILL');reject(new Error('De videorender duurde te lang.'))},240_000);
      process.once('error',failure=>{clearTimeout(timer);reject(failure)});
      process.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`FFmpeg stopte met code ${code}: ${error}`))});
    });
    return await readFile(join(directory,'kaartvideo.mp4'));
  }finally{await rm(directory,{recursive:true,force:true})}
}
