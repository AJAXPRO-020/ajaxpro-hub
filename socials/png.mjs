const FORMATS={stats:{selector:'[data-stats-preview]',name:'Wedstrijd in cijfers',slug:'wedstrijd-in-cijfers'},outblinker:{selector:'[data-outblinker-preview]',name:'Uitblinker',slug:'uitblinker'},'top-three':{selector:'[data-top-three-preview]',name:'Top 3 spelers',slug:'top-3-spelers'},quote:{selector:'[data-quote-preview]',name:'Quote',slug:'quote'}};
const W=1080,RED='#b00029',PAPER='#f5f2eb',MUTED='#aeb2b9';
const value=(node,selector)=>node.querySelector(selector)?.textContent?.trim()??'';
const font=(size,bold=false)=>`${bold?'700':'400'} ${size}px ${bold?'"AjaxPro Bebas Visual"':'"AjaxPro Refrigerator"'}, "Arial Narrow", Arial, sans-serif`;
const label=(ctx,text,x,y,size=30,color=PAPER,maxWidth)=>{ctx.font=font(size,true);ctx.fillStyle=color;ctx.fillText(String(text).toLocaleUpperCase('nl-NL'),x,y,maxWidth)};
const text=(ctx,content,x,y,size=36,color=PAPER,maxWidth)=>{ctx.font=font(size);ctx.fillStyle=color;ctx.fillText(String(content),x,y,maxWidth)};
const line=(ctx,x1,y1,x2,y2,color='rgba(245,242,235,.2)',width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};
const rounded=(ctx,x,y,w,h,r=18)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r)};
const wrap=(ctx,string,maxWidth,size,bold=false)=>{ctx.font=font(size,bold);const lines=[''];for(let word of String(string).split(/\s+/).filter(Boolean)){let current=lines.at(-1),candidate=current?`${current} ${word}`:word;if(ctx.measureText(candidate).width<=maxWidth){lines[lines.length-1]=candidate;continue}if(current)lines.push('');while(ctx.measureText(word).width>maxWidth&&word.length>1){let part='';for(const char of word){if(ctx.measureText(part+char).width>maxWidth)break;part+=char}lines[lines.length-1]+=part;word=word.slice(part.length);if(word)lines.push('')}if(word)lines[lines.length-1]=word}return lines};
const wrapped=(ctx,string,x,y,maxWidth,size,lineHeight,maxLines=3,color=PAPER,bold=false)=>{const lines=wrap(ctx,string,maxWidth,size,bold);ctx.font=font(size,bold);ctx.fillStyle=color;lines.slice(0,maxLines).forEach((part,index)=>ctx.fillText(part,x,y+index*lineHeight));return lines.length};
const fit=(ctx,string,x,y,maxWidth,size=70,min=35,color=PAPER)=>{let s=size;while(s>min){ctx.font=font(s,true);if(ctx.measureText(string).width<=maxWidth)break;s-=2}label(ctx,string,x,y,s,color,maxWidth)};
const nameLines=(ctx,string,x,y,maxWidth,size,min,lineHeight,maxLines=2)=>{let lines=wrap(ctx,string,maxWidth,size,true);while(lines.length>maxLines&&size>min){size-=3;lines=wrap(ctx,string,maxWidth,size,true)}if(lines.length>maxLines){label(ctx,string,x,y,size,'#fff',maxWidth);return 1}lines.forEach((part,index)=>label(ctx,part,x,y+index*lineHeight,size,'#fff',maxWidth));return lines.length};
const imageFor=async element=>{if(!element||element.hidden||!element.getAttribute('src'))return null;const src=element.currentSrc||element.src;const image=new Image();image.crossOrigin='anonymous';image.src=src;try{await image.decode();return image}catch{return null}};
const logoFor=()=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src='/assets/ajaxpro-logo.png'});
const contain=(ctx,image,x,y,w,h)=>{if(!image)return;const scale=Math.min(w/image.naturalWidth,h/image.naturalHeight),dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;ctx.drawImage(image,x+(w-dw)/2,y+h-dh,dw,dh)};
const cover=(ctx,image,x,y,w,h)=>{if(!image)return;const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight),sw=w/scale,sh=h/scale;ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,x,y,w,h)};
const fade=(ctx,x,y,w,h,from='rgba(3,3,4,0)',to='#030304')=>{const gradient=ctx.createLinearGradient(x,y,x,y+h);gradient.addColorStop(0,from);gradient.addColorStop(1,to);ctx.fillStyle=gradient;ctx.fillRect(x,y,w,h)};
const base=(ctx,H,name,context,logo)=>{ctx.fillStyle='#07090d';ctx.fillRect(0,0,W,H);let glow=ctx.createRadialGradient(850,H*.37,30,750,H*.45,730);glow.addColorStop(0,'rgba(176,0,41,.24)');glow.addColorStop(1,'rgba(176,0,41,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);label(ctx,name,65,89,64,'#fff',740);if(logo)contain(ctx,logo,890,27,125,65);ctx.textAlign='left';line(ctx,65,117,1015,117);const lines=wrap(ctx,context,950,29);lines.slice(0,2).forEach((part,i)=>text(ctx,part,65,162+i*35,29,MUTED,950))};
const footer=(ctx,H)=>{ctx.fillStyle=RED;ctx.fillRect(0,H-96,W,96);ctx.textAlign='left';fit(ctx,'ajaxpro.fans',65,H-35,330,42,34,'#fff');ctx.textAlign='right';label(ctx,'Voor Ajacieden die verder kijken',1015,H-38,27,'#fff',570);ctx.textAlign='left'};
const matchContext=preview=>preview.dataset.pngContext||'';
const statRows=preview=>[...preview.querySelectorAll('.match-numbers-preview__stat')].map(row=>({name:value(row,'span'),home:value(row,'strong:first-child'),away:value(row,'strong:last-child')}));
function drawStats(ctx,H,preview){
  const tall=H>1500,home=value(preview,'[data-preview-team="home"]'),away=value(preview,'[data-preview-team="away"]');
  const scoreTop=tall?360:285,scoreBottom=tall?870:625,nameY=tall?340:270,scoreY=tall?820:580;
  fit(ctx,home,100,nameY,385,60,37,'#fff');ctx.textAlign='right';fit(ctx,away,980,nameY,385,60,37,'#fff');ctx.textAlign='left';
  const hs=value(preview,'[data-preview-score="home"]'),as=value(preview,'[data-preview-score="away"]');
  text(ctx,hs,95,scoreY,tall?445:350,'#fff',360);ctx.textAlign='right';text(ctx,as,985,scoreY,tall?445:350,'#fff',360);ctx.textAlign='center';label(ctx,'FT',540,scoreBottom-45,27,'#e21242');ctx.textAlign='left';
  const divider=tall?955:715,xgY=tall?1135:875;line(ctx,95,divider,985,divider);text(ctx,value(preview,'[data-match-stat="xg-home"]'),100,xgY,tall?155:135,'#fff',350);ctx.textAlign='center';label(ctx,'xG',540,xgY-22,60,'#e21242');ctx.textAlign='right';text(ctx,value(preview,'[data-match-stat="xg-away"]'),980,xgY,tall?155:135,'#fff',350);ctx.textAlign='left';
  const rows=statRows(preview),start=tall?1295:980,step=tall?135:67;
  rows.forEach((row,i)=>{const y=start+i*step;ctx.textAlign='right';text(ctx,row.home,405,y,tall?75:61,'#fff',280);ctx.textAlign='center';label(ctx,row.name,540,y-15,tall?25:23,MUTED,240);ctx.textAlign='left';text(ctx,row.away,675,y,tall?75:61,'#b0b0b0',280)});
  ctx.textAlign='left';
}
function drawOutblinker(ctx,H,preview,photo){
  const tall=H>1500,photoBottom=tall?H-315:H-285,photoTop=tall?220:165;
  const glow=ctx.createRadialGradient(865,tall?700:500,40,865,tall?700:500,700);glow.addColorStop(0,'rgba(176,0,41,.27)');glow.addColorStop(1,'rgba(176,0,41,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H-96);
  contain(ctx,photo,tall?305:350,photoTop,tall?865:730,photoBottom-photoTop);
  fade(ctx,0,tall?1070:735,W,tall?550:385,'rgba(3,3,4,0)','#07090d');
  const hero=value(preview,'.outblinker-preview__hero strong'),heroLabel=value(preview,'.outblinker-preview__hero span');
  label(ctx,heroLabel,65,tall?390:330,38,'#e21242',360);text(ctx,hero,60,tall?610:510,tall?220:190,'#fff',430);
  const name=value(preview,'[data-outblinker-name]');nameLines(ctx,name,65,tall?1250:830,700,tall?135:120,75,tall?115:105);
  const slots=[...preview.querySelectorAll('.outblinker-preview__performance [data-outblinker-preview-slot]')].filter(node=>!node.hidden).slice(0,4);
  const y=tall?1600:1100,gap=235;slots.forEach((slot,i)=>{const x=65+i*gap;if(i===0){ctx.fillStyle=RED;ctx.fillRect(x,y-53,72,5)}label(ctx,value(slot,'span'),x,y,tall?27:25,MUTED,215);text(ctx,value(slot,'strong'),x,y+(tall?105:92),tall?86:78,'#fff',215)});
}
function drawTopThree(ctx,H,preview,photos){
  const slots=[...preview.querySelectorAll('[data-top-three-preview-player]')];
  const top=190,bottom=H-96,split=594,mid=(top+bottom)/2,heroHeight=bottom-top,smallHeight=(bottom-top)/2;
  const panels=[{x:0,y:top,w:split,h:heroHeight},{x:split,y:top,w:W-split,h:smallHeight},{x:split,y:mid,w:W-split,h:smallHeight}];
  const drawPanel=(panel,index)=>{
    const {x,y,w,h}=panel,hero=index===0;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    const glow=ctx.createRadialGradient(x+w*.56,y+h*.43,20,x+w*.56,y+h*.43,w*.9);
    glow.addColorStop(0,hero?'rgba(176,0,41,.42)':'rgba(176,0,41,.34)');glow.addColorStop(1,'rgba(176,0,41,0)');ctx.fillStyle=glow;ctx.fillRect(x,y,w,h);
    ctx.font=font(hero?245:155,true);ctx.lineWidth=2;ctx.strokeStyle='rgba(226,18,66,.68)';ctx.strokeText(`0${index+1}`,x+(hero?62:23),y+(hero?330:205));
    const photoTop=y+(hero?24:8),photoBottom=y+h*(hero?(H>1500?.70:.84):.76);
    contain(ctx,photos[index],x+(hero?(H>1500?-115:-95):16),photoTop,w+(hero?(H>1500?250:215):-12),photoBottom-photoTop);
    const fadeTop=photoBottom-h*.23,photoFade=ctx.createLinearGradient(x,fadeTop,x,y+h);
    photoFade.addColorStop(0,'rgba(3,3,4,0)');photoFade.addColorStop(.48,'rgba(3,3,4,.96)');photoFade.addColorStop(1,'#030304');
    ctx.fillStyle=photoFade;ctx.fillRect(x,fadeTop,w,y+h-fadeTop);
    ctx.restore();
    const left=x+(hero?72:34),nameWidth=w-(hero?115:62),stats=[...slots[index].querySelectorAll('[data-top-three-stat]')].filter(node=>!node.hidden).slice(0,2);
    const nameSize=hero?(H>1500?100:93):(H>1500?69:61),nameLine=hero?nameSize*.9:nameSize*.9;
    const infoY=y+h-(hero?58:35),nameBottom=infoY-(hero?(H>1500?233:108):105);
    const name=value(slots[index],'[data-top-three-name]');let nameFont=nameSize,nameParts=wrap(ctx,name,nameWidth,nameFont,true);
    while(nameParts.length>2&&nameFont>42){nameFont-=3;nameParts=wrap(ctx,name,nameWidth,nameFont,true)}
    const firstNameY=nameBottom-(Math.min(nameParts.length,2)-1)*nameLine;
    if(nameParts.length>2)label(ctx,name,left,nameBottom,nameFont,'#fff',nameWidth);
    else nameParts.forEach((part,i)=>label(ctx,part,left,firstNameY+i*nameLine,nameFont,'#fff',nameWidth));
    const columns=hero?[left,left+184,left+345]:[left,left+137,left+287],ruleTop=infoY-(hero?57:55),ruleBottom=infoY+19;
    line(ctx,columns[1]-28,ruleTop,columns[1]-28,ruleBottom,'rgba(245,242,235,.35)',2);
    line(ctx,columns[2]-28,ruleTop,columns[2]-28,ruleBottom,'rgba(245,242,235,.35)',2);
    const rating=value(slots[index],'[data-top-three-rating] strong');
    if(rating){label(ctx,'Rating',columns[0],infoY-46,hero?24:20,MUTED);text(ctx,rating,columns[0],infoY+15,hero?66:57,'#e21242',hero?140:112)}
    stats.forEach((stat,i)=>{const sx=columns[i+1],statWidth=i===0?columns[i+2]-sx-32:x+w-sx-20;label(ctx,value(stat,'span'),sx,infoY-46,hero?20:18,MUTED,statWidth);text(ctx,value(stat,'strong'),sx,infoY+15,hero?60:54,'#fff',statWidth)});
  };
  panels.forEach(drawPanel);
  line(ctx,split,top,split,bottom,'rgba(226,18,66,.48)',2);
  line(ctx,split,mid,W,mid,'rgba(226,18,66,.48)',2);
}
function drawQuote(ctx,H,preview,portrait,background,inset){
  const tall=H>1500,large=preview.dataset.variant!=='small',content=value(preview,'[data-quote-preview-text]');
  if(background){ctx.save();ctx.globalAlpha=.37;cover(ctx,background,0,205,W,H-301);ctx.restore()}
  const wash=ctx.createLinearGradient(0,0,W,0);wash.addColorStop(0,'rgba(3,3,4,.98)');wash.addColorStop(.4,'rgba(3,3,4,.9)');wash.addColorStop(.75,'rgba(3,3,4,.34)');wash.addColorStop(1,'rgba(3,3,4,.16)');
  if(large)contain(ctx,portrait,tall?390:400,tall?590:445,tall?745:715,tall?1250:815);
  ctx.fillStyle=wash;ctx.fillRect(0,205,W,H-301);
  if(large)fade(ctx,0,H-430,W,335,'rgba(3,3,4,0)','rgba(3,3,4,.72)');
  const size=large?(tall?91:80):(tall?105:95),width=large?(tall?615:590):900,start=tall?330:285,lineHeight=size*(large?.94:.99),maxLines=large?(tall?11:9):(tall?11:8);
  const lines=wrap(ctx,content,width,size,true);if(lines.length>maxLines)return 'De quote is te lang voor een leesbare visual. Kort de tekst in.';
  lines.forEach((part,index)=>label(ctx,part,65,start+index*lineHeight,size,'#fff',width));
  const name=value(preview,'[data-quote-preview-name]'),role=value(preview,'[data-quote-preview-role]');
  if(large){
    const last=start+(lines.length-1)*lineHeight,nameY=Math.max(tall?1230:975,last+105);if(nameY>H-220)return 'De quote is te lang voor een leesbare visual. Kort de tekst in.';
    ctx.fillStyle=RED;ctx.fillRect(65,nameY-68,5,95);fit(ctx,name,85,nameY,540,tall?57:53,32);if(role)text(ctx,role,85,nameY+37,27,MUTED,520);
  }else{
    const circle=tall?205:175,x=65,y=H-(tall?400:345);ctx.save();ctx.beginPath();ctx.arc(x+circle/2,y+circle/2,circle/2,0,Math.PI*2);ctx.clip();contain(ctx,portrait,x,y,circle,circle);ctx.restore();ctx.strokeStyle='rgba(245,242,235,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+circle/2,y+circle/2,circle/2,0,Math.PI*2);ctx.stroke();fit(ctx,name,x+circle+35,y+circle*.52,590,62,35);if(role)text(ctx,role,x+circle+35,y+circle*.76,29,MUTED,550);
  }
  if(inset){const x=820,y=H-(tall?410:365),w=190,h=tall?235:190;ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(2*Math.PI/180);ctx.fillStyle='#f5f2eb';ctx.fillRect(-w/2-3,-h/2-3,w+6,h+6);cover(ctx,inset,-w/2,-h/2,w,h);ctx.restore()}
  return '';
}
const slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('nl-NL').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);
const filename=(id,preview)=>{let subject=id==='stats'?`${value(preview,'[data-preview-team="home"]')}-${value(preview,'[data-preview-team="away"]')}`:id==='outblinker'?value(preview,'[data-outblinker-name]'):id==='top-three'?'wedstrijd':value(preview,'[data-quote-preview-name]');return `ajaxpro-${FORMATS[id].slug}-${slug(subject)}-${preview.dataset.aspect==='vertical-9x16'?'9x16':'4x5'}.png`};
const validate=(id,preview,images)=>{if(id==='stats'){if(!value(preview,'[data-preview-team="home"]')||!value(preview,'[data-preview-team="away"]'))return 'Wedstrijdgegevens ontbreken.';if([value(preview,'[data-preview-score="home"]'),value(preview,'[data-preview-score="away"]')].some(v=>!/^\d+$/.test(v)))return 'Een complete uitslag is nodig.';if([...preview.querySelectorAll('[data-match-stat]')].some(n=>n.textContent.trim()==='—'))return 'Vul eerst de wedstrijdstatistieken in.'}if(id==='outblinker'){if(!images[0])return 'Voor deze speler ontbreekt een bruikbare foto.';if(![...preview.querySelectorAll('.outblinker-preview__performance [data-outblinker-preview-slot]')].some(n=>!n.hidden))return 'Kies een speler met bruikbare stats.'}if(id==='top-three'){if([...preview.querySelectorAll('[data-top-three-preview-player]')].some(n=>n.dataset.selected!=='true'))return 'Kies drie spelers.';if(images.some(image=>!image))return 'Voor één of meer spelers ontbreekt een bruikbare foto.'}if(id==='quote'){if(value(preview,'[data-quote-preview-text]')==='Vul een quote in')return 'Vul eerst een quote in.';if(!images[0])return 'Voor deze persoon ontbreekt een bruikbare foto.'}return ''};
export function mountPngPreviews(root){
  for(const [id,definition] of Object.entries(FORMATS)){
    const preview=root.querySelector(definition.selector);if(!preview)continue;
    const workspace=preview.closest('[data-format-workspace]'),button=workspace.querySelector('.socials-download');if(!button)continue;
    const canvas=document.createElement('canvas');canvas.className='socials-png-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Voorbeeld ${definition.name}`);preview.append(canvas);
    const notice=document.createElement('p');notice.className='socials-png-notice';notice.setAttribute('role','status');button.after(notice);button.textContent='Download PNG';button.disabled=true;
    let revision=0,exportFrame=null;
    const render=async()=>{
      const current=++revision,H=preview.dataset.aspect==='vertical-9x16'?1920:1350;button.disabled=true;exportFrame=null;
      let photos=[];
      if(id==='outblinker')photos=[await imageFor(preview.querySelector('[data-outblinker-photo]'))];
      if(id==='top-three')photos=await Promise.all([...preview.querySelectorAll('[data-top-three-photo]')].map(imageFor));
      if(id==='quote')photos=await Promise.all(['[data-quote-person-photo]','[data-quote-background-preview]','[data-quote-inset-preview]'].map(selector=>imageFor(preview.querySelector(selector))));
      const logo=await logoFor();if(current!==revision)return;await document.fonts.ready;if(current!==revision)return;
      const frame=document.createElement('canvas');frame.width=W;frame.height=H;const ctx=frame.getContext('2d');base(ctx,H,definition.name,matchContext(preview),logo);
      let error=validate(id,preview,photos);if(id==='stats')drawStats(ctx,H,preview);if(id==='outblinker')drawOutblinker(ctx,H,preview,photos[0]);if(id==='top-three')drawTopThree(ctx,H,preview,photos);if(id==='quote')error=drawQuote(ctx,H,preview,...photos)||error;footer(ctx,H);if(current!==revision)return;
      canvas.width=W;canvas.height=H;canvas.getContext('2d').drawImage(frame,0,0);exportFrame=frame;button.disabled=Boolean(error);notice.textContent=error;
    };
    let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;void render()})});observer.observe(preview,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-aspect','data-selected','data-variant','hidden','src']});
    button.addEventListener('click',()=>{if(button.disabled||!exportFrame)return;const frame=exportFrame;button.disabled=true;frame.toBlob(blob=>{button.disabled=Boolean(notice.textContent)||!exportFrame;if(!blob){notice.textContent='PNG-export is mislukt. Probeer opnieuw.';return}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename(id,preview);link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)},'image/png')});void render();
  }
}
