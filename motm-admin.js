const field=name=>document.querySelector(`[name="${name}"]`);
const matchFields={opponent:field('opponent'),competition:field('competition'),kickoffDate:field('kickoffDate'),kickoffTime:field('kickoffTime'),homeOrAway:field('homeOrAway'),seasonKey:field('seasonKey'),scheduledOpenDate:field('scheduledOpenDate'),scheduledOpenTime:field('scheduledOpenTime'),scheduledCloseDate:field('scheduledCloseDate'),scheduledCloseTime:field('scheduledCloseTime')};
const amsterdamParts=value=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
const setDateTime=(dateField,timeField,value)=>{if(!dateField||!timeField)return;const parts=amsterdamParts(value);dateField.value=`${parts.year}-${parts.month}-${parts.day}`;timeField.value=`${parts.hour}:${parts.minute}`};
const localDate=(dateField,timeField)=>dateField?.value&&timeField?.value?new Date(`${dateField.value}T${timeField.value}:00`):null;
const setDefaultSchedule=()=>{const kickoff=localDate(matchFields.kickoffDate,matchFields.kickoffTime);if(!kickoff||Number.isNaN(kickoff.getTime()))return;if(matchFields.scheduledOpenDate&&!matchFields.scheduledOpenDate.value)setDateTime(matchFields.scheduledOpenDate,matchFields.scheduledOpenTime,new Date(kickoff.getTime()+2*3600000));if(matchFields.scheduledCloseDate&&!matchFields.scheduledCloseDate.value)setDateTime(matchFields.scheduledCloseDate,matchFields.scheduledCloseTime,new Date(kickoff.getTime()+3*3600000))};
let seasonTouched=false;matchFields.seasonKey?.addEventListener('change',()=>{seasonTouched=true});
const setDefaultSeason=()=>{if(seasonTouched||!matchFields.seasonKey||!matchFields.kickoffDate?.value)return;const [year,month]=matchFields.kickoffDate.value.split('-').map(Number),start=month>=7?year:year-1,key=`${start}-${String(start+1).slice(-2)}`;if(![...matchFields.seasonKey.options].some(option=>option.value===key)){matchFields.seasonKey.add(new Option(key,key))}matchFields.seasonKey.value=key};
matchFields.kickoffDate?.addEventListener('change',()=>{setDefaultSchedule();setDefaultSeason()});
matchFields.kickoffTime?.addEventListener('change',setDefaultSchedule);
if(matchFields.opponent)fetch('/api/next-match').then(response=>response.ok?response.json():Promise.reject()).then(({match})=>{if(!match)return;matchFields.opponent.value=match.opponent||'';matchFields.competition.value=match.competition||'';setDateTime(matchFields.kickoffDate,matchFields.kickoffTime,match.kickoff);matchFields.homeOrAway.value=match.isHome?'home':'away';setDefaultSchedule()}).catch(()=>{});
document.querySelector('[data-copy]')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(document.querySelector('#share-url').value);document.querySelector('[data-copy]').textContent='Gekopieerd'});
document.querySelector('[data-share]')?.addEventListener('click',()=>{const shareField=document.querySelector('#share-url'),url=shareField.value,title=shareField.dataset.shareTitle,text=shareField.dataset.shareText;if(navigator.share)navigator.share({title,text,url});else navigator.clipboard.writeText(url)});
const playerInputs=[...document.querySelectorAll('.admin-player input')],playerCount=document.querySelector('[data-player-count]');
const updatePlayerCount=()=>{if(playerCount)playerCount.textContent=String(playerInputs.filter(input=>input.checked).length)};
playerInputs.forEach(input=>input.addEventListener('change',updatePlayerCount));

const livePanel=document.querySelector('[data-live-votes]');
if(livePanel){
  const total=livePanel.querySelector('[data-live-total]'),totalLabel=livePanel.querySelector('[data-live-total-label]'),list=livePanel.querySelector('[data-live-list]'),updated=livePanel.querySelector('[data-live-updated]'),message=livePanel.querySelector('[data-live-message]'),error=livePanel.querySelector('[data-live-error]'),refresh=livePanel.querySelector('[data-live-refresh]'),trend=livePanel.querySelector('[data-live-trend]');
  let timer;
  const renderRow=player=>{const row=document.createElement('div');row.className='live-vote-row';row.dataset.playerId=player.player_id;const image=document.createElement('img');image.src=player.image_url_snapshot;image.alt='';const name=document.createElement('strong');name.textContent=player.name_snapshot;const count=document.createElement('span');count.textContent=`${player.votes} · ${player.percentage}%`;const bar=document.createElement('progress');bar.max=100;bar.value=player.percentage;bar.setAttribute('aria-hidden','true');row.append(image,name,count,bar);return row};
  const renderTrend=rows=>{if(!trend)return;trend.replaceChildren();const heading=document.createElement('div');heading.className='live-trend__heading';const title=document.createElement('div'),label=document.createElement('h3');label.textContent='Stemtrend';const help=document.createElement('p');help.textContent='Nieuwe stemmers per uur';title.append(label,help);const trendTotal=document.createElement('strong');trendTotal.dataset.liveTrendTotal='';trendTotal.textContent=String(rows.reduce((sum,row)=>sum+Number(row.votes),0));heading.append(title,trendTotal);trend.append(heading);if(!rows.length){const empty=document.createElement('p');empty.textContent='Nog geen stemmen om een trend te tonen.';trend.classList.add('live-trend--empty');trend.append(empty);return}trend.classList.remove('live-trend--empty');const list=document.createElement('ol');list.className='live-trend__list';const max=Math.max(...rows.map(row=>Number(row.votes)),1);rows.forEach(row=>{const item=document.createElement('li'),time=document.createElement('time'),bar=document.createElement('span'),count=document.createElement('strong');time.dateTime=new Date(row.bucket).toISOString();time.textContent=new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit'}).format(new Date(row.bucket));bar.className='live-trend__bar';bar.style.setProperty('--trend-width',`${Math.round(Number(row.votes)*100/max)}%`);bar.setAttribute('aria-hidden','true');count.textContent=`+${row.votes}`;item.append(time,bar,count);list.append(item)});trend.append(list)};
  const render=data=>{total.textContent=String(data.total);totalLabel.textContent=data.total===1?'stem':'stemmen';renderTrend(data.trend||[]);list.replaceChildren();const visible=data.players.filter(player=>player.votes>0);if(visible.length)visible.forEach(player=>list.append(renderRow(player)));else{const empty=document.createElement('p');empty.className='live-votes__empty';empty.textContent='Nog geen stemmen uitgebracht.';list.append(empty)}updated.textContent=`Bijgewerkt om ${new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(data.updatedAt))}`;message.textContent=data.status==='open'?'Live stemverloop.':data.status==='closed'?'Definitieve stemverdeling.':'De stemming is nog niet geopend.';livePanel.dataset.liveStatus=data.status;if(data.status!=='open'&&timer)clearInterval(timer)};
  const load=async()=>{refresh.disabled=true;error.hidden=true;try{const response=await fetch(livePanel.dataset.liveUrl,{headers:{Accept:'application/json'},cache:'no-store'});if(!response.ok)throw new Error('LIVE_VOTES_FAILED');render(await response.json())}catch{error.hidden=false}finally{refresh.disabled=false}};
  refresh.addEventListener('click',load);
  if(livePanel.dataset.liveStatus==='open')timer=setInterval(load,30000);
}

const winnerVisual=document.querySelector('[data-winner-visual]');
if(winnerVisual){
  const canvas=winnerVisual.querySelector('canvas'),context=canvas.getContext('2d'),status=winnerVisual.querySelector('[data-visual-status]'),download=winnerVisual.querySelector('[data-download-visual]')||document.querySelector('[data-download-visual]');
  let pngBlob;
  const loadImage=source=>new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`IMAGE_LOAD_FAILED:${source}`));image.src=source});
  const font=(size,family,weight)=>`${weight} ${size}px "${family}"`;
  const ensureVisualFonts=async()=>{const definitions=[['AjaxPro Bebas Visual','/assets/fonts/bebas-neue-visual.woff2','700'],['AjaxPro Refrigerator','/assets/fonts/refrigerator-deluxe-regular.otf','400'],['AjaxPro Refrigerator','/assets/fonts/refrigerator-deluxe-bold.otf','700'],['AjaxPro Refrigerator','/assets/fonts/refrigerator-deluxe-heavy.otf','900']];await Promise.all(definitions.map(async([family,source,weight])=>{const loaded=[...document.fonts].some(candidate=>candidate.family===family&&candidate.weight===weight&&candidate.status==='loaded');if(loaded)return;const face=new FontFace(family,`url(${source})`,{weight});await face.load();document.fonts.add(face)}))};
  const fitSize=(text,preferred,minimum,maximumWidth,family,weight)=>{let size=preferred;while(size>minimum){context.font=font(size,family,weight);if(context.measureText(text).width<=maximumWidth)break;size-=1}return size};
  const drawFitText=({text,x,y,preferred,minimum,width,family,weight,color,align='left'})=>{const size=fitSize(text,preferred,minimum,width,family,weight);context.font=font(size,family,weight);context.fillStyle=color;context.textAlign=align;context.textBaseline='alphabetic';context.fillText(text,x,y,width);return size};
  const render=async()=>{
    try{
      await ensureVisualFonts();
      await Promise.all([
        document.fonts.load('700 64px "AjaxPro Bebas Visual"'),
        document.fonts.load('700 83px "AjaxPro Refrigerator"'),
        document.fonts.load('900 141px "AjaxPro Refrigerator"'),
        document.fonts.load('400 40px "AjaxPro Refrigerator"'),
      ]);
      await document.fonts.ready;
      const [template,player]=await Promise.all([loadImage(winnerVisual.dataset.templateUrl),loadImage(winnerVisual.dataset.playerImage)]);
      context.clearRect(0,0,canvas.width,canvas.height);
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
      context.drawImage(template,0,0,canvas.width,canvas.height);

      const playerHeight=1050,playerWidth=player.naturalWidth/player.naturalHeight*playerHeight;
      context.save();
      context.shadowColor='rgba(16,16,16,.28)';
      context.shadowBlur=18;
      context.shadowOffsetX=-6;
      context.shadowOffsetY=8;
      context.drawImage(player,610,30,playerWidth,playerHeight);
      context.restore();

      drawFitText({text:winnerVisual.dataset.matchTitle,x:48,y:456,preferred:64,minimum:38,width:625,family:'AjaxPro Bebas Visual',weight:700,color:'#101010'});
      const firstName=winnerVisual.dataset.firstName,lastName=winnerVisual.dataset.lastName;
      if(lastName){
        drawFitText({text:firstName,x:180,y:690,preferred:83,minimum:44,width:245,family:'AjaxPro Refrigerator',weight:700,color:'#101010',align:'center'});
        drawFitText({text:lastName,x:180,y:775,preferred:83,minimum:44,width:245,family:'AjaxPro Refrigerator',weight:700,color:'#101010',align:'center'});
      }else{
        drawFitText({text:firstName,x:180,y:735,preferred:83,minimum:44,width:245,family:'AjaxPro Refrigerator',weight:700,color:'#101010',align:'center'});
      }
      if (winnerVisual.dataset.shirtNumber) drawFitText({text:`#${winnerVisual.dataset.shirtNumber}`,x:180,y:865,preferred:83,minimum:58,width:245,family:'AjaxPro Refrigerator',weight:700,color:'#101010',align:'center'});
      drawFitText({text:`${winnerVisual.dataset.percentage}%`,x:410,y:815,preferred:205,minimum:125,width:300,family:'AjaxPro Refrigerator',weight:900,color:'#A50324'});
      drawFitText({text:'VAN DE STEMMEN',x:410,y:868,preferred:48,minimum:36,width:300,family:'AjaxPro Refrigerator',weight:400,color:'#101010'});

      pngBlob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG_EXPORT_FAILED')),'image/png'));
      status.textContent='Definitieve preview · 1350 × 1080 px';
      if(download)download.disabled=false;
    }catch(error){
      console.error('MOTM visual generation failed',error);
      status.textContent='De resultaatvisual kon niet worden geladen.';
    }
  };
  download?.addEventListener('click',()=>{if(!pngBlob)return;const url=URL.createObjectURL(pngBlob),link=document.createElement('a');link.href=url;link.download=winnerVisual.dataset.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)});
  render();
}
