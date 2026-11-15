import {Output,Mp4OutputFormat,BufferTarget,CanvasSource,Quality} from '/socials/mediabunny.mjs';

const WIDTH=1080,HEIGHT=1920,FPS=30,FIRST_SECONDS=2.5,CARD_SECONDS=3,TRANSITION_SECONDS=.4,END_SECONDS=4;
const ease=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x)};
const abortError=()=>new DOMException('Videorender gestopt.','AbortError');
const platforms=[
  {id:'instagram',color:'#e55287'},
  {id:'x',color:'#ffffff'},
  {id:'tiktok',color:'#ffffff'},
  {id:'discord',color:'#8190ff'},
  {id:'spotify',color:'#42d979'},
  {id:'youtube',color:'#ff465e'},
];
const featuredIds=['discord','spotify','youtube'];
const imageFrom=async url=>{const image=new Image();image.src=url;try{await image.decode();return image}catch{throw new Error('Een logo voor de eindkaart kon niet worden geladen.')}};
const drawIcon=(ctx,image,x,y,size,color,alpha=1)=>{const icon=document.createElement('canvas');icon.width=size;icon.height=size;const ink=icon.getContext('2d');ink.drawImage(image,0,0,size,size);ink.globalCompositeOperation='source-in';ink.fillStyle=color;ink.fillRect(0,0,size,size);ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(icon,x,y);ctx.restore()};
const rounded=(ctx,x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()};
const text=(ctx,value,x,y,size,color,weight=700,maxWidth=720)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px "AjaxPro Refrigerator"`;ctx.fillText(value,x,y,maxWidth)};
const drawFeatured=(ctx,id,icons,youtubePreview)=>{
  rounded(ctx,120,850,840,840,30,'#111217');
  ctx.textAlign='left';const icon=icons[platforms.findIndex(item=>item.id===id)];
  drawIcon(ctx,icon,178,914,76,'#f5f2eb');
  text(ctx,id==='discord'?'Discord':id==='spotify'?'AjaxPro podcasts':'AjaxPro YouTube',280,976,66,'#f5f2eb');
  if(id==='discord'){
    ctx.fillStyle='#f5f2eb';ctx.font='700 96px "AjaxPro Bebas Visual"';
    ctx.fillText('Praat live mee',178,1150,724);
    ctx.fillText('met andere Ajacieden',178,1250,724);
    text(ctx,'Volg de wedstrijd,',178,1375,48,'#c2c5ce',400,724);
    text(ctx,'discussieer mee en beleef',178,1440,48,'#c2c5ce',400,724);
    text(ctx,'de momenten samen in onze Discord.',178,1505,48,'#c2c5ce',400,724);
    ctx.font='700 68px "AjaxPro Bebas Visual"';ctx.fillStyle='#8190ff';
    ctx.fillText('Join onze Discord',178,1620,724);
  }else if(id==='youtube'){
    ctx.save();ctx.beginPath();ctx.roundRect(178,1060,724,570,18);ctx.clip();
    ctx.translate(540,1345);ctx.rotate(-8*Math.PI/180);
    ctx.drawImage(youtubePreview,145,245,1020,720,-510,-360,1020,720);
    ctx.restore();
  }else{
    ctx.fillStyle='#f5f2eb';ctx.font='700 96px "AjaxPro Bebas Visual"';
    ctx.fillText('Mis geen aflevering',178,1150,724);
    ctx.fillText('van AjaxPro',178,1250,724);
    text(ctx,'Van Matchday rondom de wedstrijden',178,1340,48,'#c2c5ce',400,724);
    text(ctx,'tot het wekelijkse AjaxPro Café.',178,1398,48,'#c2c5ce',400,724);
    text(ctx,'Luister mee en abonneer je',178,1456,48,'#c2c5ce',400,724);
    text(ctx,'op onze podcasts.',178,1514,48,'#c2c5ce',400,724);
    ctx.font='700 68px "AjaxPro Bebas Visual"';ctx.fillStyle='#42d979';
    ctx.fillText('Volg AjaxPro op Spotify',178,1630,724);
  }
};
export async function createScoreIntro(match){
  if(!Number.isInteger(match?.goals_home)||!Number.isInteger(match?.goals_away))return null;
  await document.fonts.load('900 260px "AjaxPro Refrigerator"');
  await document.fonts.load('700 100px "AjaxPro Bebas Visual"');
  const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#050506';ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle='#b00029';ctx.fillRect(0,0,WIDTH,16);ctx.fillRect(0,1810,WIDTH,110);
  ctx.fillStyle='#f5f2eb';ctx.font='700 74px "AjaxPro Bebas Visual"';ctx.fillText('UITSLAG',72,142);
  ctx.fillStyle='#aeb2b9';ctx.font='48px "AjaxPro Refrigerator"';ctx.fillText(String(match.competition||'').toUpperCase(),72,235);
  const team=(name,x,y)=>{ctx.font='700 90px "AjaxPro Bebas Visual"';const words=String(name||'').toUpperCase().split(' ');let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>930&&line){ctx.fillText(line,x,y);y+=100;line=word}else line=next}ctx.fillText(line,x,y)};
  team(match.home_team,72,530);team(match.away_team,72,1350);
  ctx.font='900 380px "AjaxPro Refrigerator"';ctx.fillText(`${match.goals_home} – ${match.goals_away}`,72,980);
  ctx.fillStyle='#fff';ctx.font='700 58px "AjaxPro Bebas Visual"';ctx.fillText('AJAXPRO.FANS',72,1884);
  return canvas;
}
export async function createEndCard(featuredId=featuredIds[Math.floor(Math.random()*featuredIds.length)]){
  if(!featuredIds.includes(featuredId))throw new Error('Onbekend platform voor de eindkaart.');
  await Promise.all([document.fonts.load('900 156px "AjaxPro Refrigerator"'),document.fonts.load('700 66px "AjaxPro Refrigerator"'),document.fonts.load('400 48px "AjaxPro Refrigerator"'),document.fonts.load('700 96px "AjaxPro Bebas Visual"')]);
  const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;const ctx=canvas.getContext('2d');
  canvas.dataset.featuredPlatform=featuredId;
  ctx.fillStyle='#000';ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle='#fff';ctx.textAlign='center';let size=156;do{ctx.font=`900 ${size}px "AjaxPro Refrigerator"`;size-=4}while(ctx.measureText('ajaxpro.fans').width>920&&size>80);ctx.fillText('ajaxpro.fans',WIDTH/2,480);
  const icons=await Promise.all(platforms.map(platform=>imageFrom(`/assets/icons/${platform.id}.svg`)));
  const youtubePreview=featuredId==='youtube'?await imageFrom('/assets/youtube-preview.png'):null;
  platforms.forEach((platform,index)=>drawIcon(ctx,icons[index],113+index*150,653,104,index===platforms.findIndex(item=>item.id===featuredId)&&featuredId!=='spotify'?platform.color:'#fff',platform.id===featuredId?1:.62));
  drawFeatured(ctx,featuredId,icons,youtubePreview);
  return canvas;
}

export async function checkBrowserCardVideoSupport(){
  if(!window.isSecureContext||typeof VideoEncoder==='undefined'||typeof createImageBitmap!=='function')return 'Deze browser ondersteunt de video-export niet. Gebruik een recente desktopversie van Chrome, Safari of Firefox.';
  const canvas=document.createElement('canvas');if(!canvas.getContext('2d',{alpha:false}))return 'Canvas is niet beschikbaar in deze browser.';
  for(const codec of ['avc1.640028','avc1.4d4028','avc1.42e028']){
    try{const result=await VideoEncoder.isConfigSupported({codec,width:WIDTH,height:HEIGHT,bitrate:6_000_000,framerate:FPS,hardwareAcceleration:'prefer-hardware',avc:{format:'avc'}});if(result.supported)return ''}catch{}
  }
  return 'Deze browser kan geen H.264-video op 1080 × 1920 maken. Gebruik een recente desktopbrowser.';
}

export async function renderBrowserCardVideo(canvases,{signal}={}){
  if(!Array.isArray(canvases)||canvases.length<1||canvases.length>7||canvases.some(canvas=>canvas?.width!==WIDTH||canvas?.height!==HEIGHT))throw new Error('De video heeft één tot zeven complete 9:16-kaarten nodig.');
  const unsupported=await checkBrowserCardVideoSupport();if(unsupported)throw new Error(unsupported);
  const started=performance.now(),images=[];let output,startedOutput=false;
  try{
    if(signal?.aborted)throw abortError();
    for(const card of canvases)images.push(await createImageBitmap(card));
    images.push(await createImageBitmap(await createEndCard()));
    const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas is niet beschikbaar.');
    const steps=canvases.map((_,index)=>(index===0?FIRST_SECONDS:CARD_SECONDS)-TRANSITION_SECONDS);
    const starts=steps.map((_,index)=>steps.slice(0,index).reduce((a,b)=>a+b,0));
    const endStart=steps.reduce((a,b)=>a+b,0),totalFrames=Math.ceil((endStart+END_SECONDS)*FPS);
    const draw=time=>{
      ctx.fillStyle='#000';ctx.fillRect(0,0,WIDTH,HEIGHT);
      if(time>=endStart){ctx.drawImage(images[canvases.length-1],0,0);ctx.globalAlpha=ease((time-endStart)/TRANSITION_SECONDS);ctx.drawImage(images[canvases.length],0,0);ctx.globalAlpha=1;return}
      const index=Math.min(canvases.length-1,starts.findLastIndex(start=>time>=start)),start=starts[index];
      if(index>0&&time<start+TRANSITION_SECONDS){const previous=index-1,d=ease((time-start)/TRANSITION_SECONDS)*(previous%2===0?WIDTH:HEIGHT);
        if(previous%2===0){ctx.drawImage(images[previous],-d,0);ctx.drawImage(images[index],WIDTH-d,0)}
        else{ctx.drawImage(images[previous],0,-d);ctx.drawImage(images[index],0,HEIGHT-d)}
      }else ctx.drawImage(images[index],0,0);
    };
    output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target:new BufferTarget()});
    const source=new CanvasSource(canvas,{codec:'avc',quality:new Quality({bitrate:6_000_000}),keyFrameInterval:2});
    output.addVideoTrack(source,{frameRate:FPS});await output.start();startedOutput=true;
    for(let frame=0;frame<totalFrames;frame++){
      if(signal?.aborted)throw abortError();
      draw(frame/FPS);await source.add(frame/FPS,1/FPS);
      if(frame%15===0)await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    await output.finalize();startedOutput=false;
    const blob=new Blob([output.target.buffer],{type:'video/mp4'});if(!blob.size)throw new Error('De MP4 ontbreekt.');
    return {blob,renderMs:performance.now()-started,frames:totalFrames};
  }catch(error){if(startedOutput)await output.cancel().catch(()=>{});throw error}
  finally{for(const image of images)image.close()}
}
