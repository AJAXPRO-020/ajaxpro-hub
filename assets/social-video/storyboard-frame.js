/* Direct geometric port of render.swift v11. Time is supplied by Shotstack,
   never by a wall clock. Match data and assets are injected by build.py. */
(() => {
  'use strict';
  const match = JSON.parse(new URLSearchParams(location.search).get('data') || 'null');
  const metrics = {
  "bold" : {
    "ascender" : 0.82400166988372803,
    "descender" : -0.17600035667419434,
    "leading" : 0.12300024926662445
  },
  "heavy" : {
    "ascender" : 0.82400166988372803,
    "descender" : -0.17600035667419434,
    "leading" : 0.12300024926662445
  }
}
;
  const canvas = document.getElementById('frame');
  const c = canvas.getContext('2d');
  const logo = document.getElementById('logo');
  const ink='#050506', paper='#f5f2eb', red='#b00029', dim='rgb(140.25,137.7,135.15)';
  const clamp=x=>Math.min(1,Math.max(0,x));
  const ease=x=>1-Math.pow(1-clamp(x),4);
  const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
  const statsStart=5, statDuration=2.25, statsEnd=14;
  const font=(size,weight)=>`${size}px AjaxPro-${weight}`;
  function box(x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  function clip(x,y,w,h){c.beginPath();c.rect(x,y,w,h);c.clip();}
  function text(value,x,y,size,color=paper,weight='heavy',width=940,align='left') {
    let s=size;
    while(s>15){c.font=font(s,weight);if(c.measureText(value).width<=width)break;s-=1;}
    c.font=font(s,weight);c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';
    c.save();clip(x,y,width,s*1.5);
    // NSAttributedString's top-aligned line box uses the font ascender.
    const baseline=y+Math.ceil(metrics[weight].ascender*s);
    c.fillText(value,x+(align==='right'?width:align==='center'?width/2:0),baseline);
    c.restore();
  }
  function reveal(progress,rect,draw){c.save();clip(...rect);c.translate(0,(1-ease(progress))*rect[3]);draw();c.restore();}
  function teamLayout(value,preferred,width){
    const measured=(line,size)=>{c.font=font(size,'heavy');return c.measureText(line).width;};
    if(measured(value,preferred)<=width)return [[value],preferred];
    const words=value.split(/\s+/),candidates=[];
    if(words.length>1){for(let i=1;i<words.length;i++)candidates.push([words.slice(0,i).join(' '),words.slice(i).join(' ')]);}
    else {const chars=Array.from(value);for(let i=1;i<chars.length;i++)candidates.push([chars.slice(0,i).join(''),chars.slice(i).join('')]);}
    const best=candidates.reduce((a,b)=>!a||Math.max(...b.map(x=>measured(x,preferred)))<Math.max(...a.map(x=>measured(x,preferred)))?b:a,null)||[value];
    let size=preferred;while(size>20&&best.some(x=>measured(x,size)>width))size-=1;
    return [best,size];
  }
  function slideTeam(value,time,start,top){
    const isAjax=value.toUpperCase()==='AJAX', [lines,size]=teamLayout(value,isAjax?310:180,936);
    const p=ease((time-start)/.42),distance=(isAjax?1180:-1180)*(1-p),lineHeight=size*1.02;
    const y=top+(370-lineHeight*lines.length)/2;
    c.save();clip(0,top-20,1080,410);c.translate(distance,0);
    lines.forEach((line,i)=>text(line,72,y+i*lineHeight,size,paper,'heavy',936));c.restore();
  }
  function teamCaption(value,x,y,color,align){const [lines,size]=teamLayout(value,37,420);lines.forEach((line,i)=>text(line,x,y+i*size*1.05,size,color,'heavy',420,align));}
  function comparisonBar(ratio,time,ajaxHome){
    const x=72,y=1230,w=936,h=16,t=clamp((time-.16)/.94),p=t*t*t*(t*(t*6-15)+10);
    c.save();clip(x,y,w,h);box(x,y,w,h,'rgba(245,242,235,.12)');
    c.save();clip(x,y,w*p,h);const split=w*ratio;
    box(x,y,Math.max(0,split-4),h,ajaxHome?red:dim);
    box(x+split+4,y,Math.max(0,w-split-4),h,ajaxHome?dim:red);c.restore();c.restore();
  }
  const number=(value,s,p)=>(value*ease(p)).toFixed(s.decimals).replace('.',',')+s.suffix;
  function frame(t){
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;box(0,0,1080,1920,ink);
    c.strokeStyle='rgba(245,242,235,.024)';c.lineWidth=1;
    for(let x=-200;x<=1200;x+=12){c.beginPath();c.moveTo(x,0);c.lineTo(x-230,1920);c.stroke();}
    c.save();c.translate(54,96);c.scale(.9,.9);
    if(t<statsEnd){text('AJAXPRO',72,78,38);text('WEDSTRIJD IN CIJFERS',390,78,38,paper,'heavy',618,'right');if(t>=3)box(72,151,936,2,'rgba(245,242,235,.2)');}
    if(t<3){
      slideTeam(match.home,t,.12,440);box(72,865,108*ease((t-.5)/.18),5,red);slideTeam(match.away,t,.65,920);
      text(match.competition.toUpperCase(),72,1428,32,red,'bold',936);
      text('90 MINUTEN. HET VERHAAL IN CIJFERS.',72,1500,34,dim,'bold');
    }else if(t<5){
      const p=ease((t-3)/.5);text(match.date,72,340,48,paper,'bold');text('EINDSTAND',72,430,30,red,'bold');
      teamCaption(match.home,72,630,dim,'left');teamCaption(match.away,588,630,paper,'right');
      c.save();c.globalAlpha=p;c.translate(0,(1-p)*100);text(String(match.homeScore),96,780,360,dim,'heavy',384);text(String(match.awayScore),552,740,420,paper,'heavy',432,'right');c.restore();
      box(495,960,90*p,8,red);text(`${match.home} — ${match.away}`,72,1350,48,paper,'bold');
    }else if(t<statsEnd){
      const index=Math.min(3,Math.floor((t-statsStart)/statDuration)),local=t-statsStart-index*statDuration,s=match.stats[index],p=clamp((local-.12)/.65);
      text(`${match.home}  ${match.homeScore} — ${match.awayScore}  ${match.away}`,72,295,44,paper,'bold');
      reveal(local/.35,[60,510,960,150],()=>text(s.label,72,510,100,paper,'heavy',936));
      teamCaption(match.home,72,760,dim,'left');teamCaption(match.away,588,760,paper,'right');
      text(number(s.home,s,p),62,865,220,dim,'heavy',440);text(number(s.away,s,p),558,865,250,paper,'heavy',460,'right');
      comparisonBar(s.home/Math.max(.001,s.home+s.away),local,match.home.toUpperCase()==='AJAX');
    }else{
      const p=ease((t-statsEnd)/.55);c.save();c.globalAlpha=p;
      if(logo.complete&&logo.naturalWidth)c.drawImage(logo,320,480+(1-p)*45,440,440*2119/1600);c.restore();
      reveal((t-statsEnd-.3)/.5,[60,1190,960,150],()=>text(match.followText,72,1190,96,paper,'bold',936,'center'));
    }
    c.restore();
    for(const boundary of [3,5,7.25,9.5,11.75,14]){
      const offset=t-boundary;
      if(offset>=-.20&&offset<.24){const x=offset<0?1080*(1-smooth((offset+.20)/.20)):-1080*ease(offset/.24);c.save();clip(0,220,1080,1460);box(x,220,1080,1460,red);box(x,220,8,1460,'rgba(245,242,235,.18)');c.restore();}
    }
  }
  let lastTime=0;
  window.__shotstackSeek=timeMs=>{lastTime=Math.max(0,Math.min(17,timeMs/1000));frame(lastTime);};
  Promise.all([document.fonts.load('100px AjaxPro-bold'),document.fonts.load('100px AjaxPro-heavy'),logo.decode()]).then(()=>{window.__ajaxproReady=true;frame(lastTime);});
  frame(0);
})();
