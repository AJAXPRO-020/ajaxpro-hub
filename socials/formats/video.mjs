import {renderStoryboard} from '/socials/video-storyboard.mjs?v=20261023-video-flow';
const endpoint='/api/club-tools?view=socials-video';
const busy=new Set(['submitting','queued','fetching','rendering','uncertain']);
const clone=value=>structuredClone(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const el=(tag,text,klass)=>{const node=document.createElement(tag);node.textContent=text;if(klass)node.className=klass;return node};
const valid=data=>{
 const limits={home:54,away:54,date:42,competition:54,followText:34};
 for(const [key,max] of Object.entries(limits))if(typeof data[key]!=='string'||!data[key].trim()||data[key].trim().length>max||/[\r\n]/.test(data[key]))return 'Controleer de tekstvelden: een veld is leeg of te lang.';
 for(const key of ['homeScore','awayScore'])if(!Number.isSafeInteger(data[key])||data[key]<0||data[key]>99)return 'Controleer de eindstand.';
 if(data.stats.length!==4)return 'Er zijn vier statistieken nodig.';
 for(const [index,row] of data.stats.entries()){
  if(!row.label.trim()||row.label.trim().length>30)return `Controleer het label van statistiek ${index+1}.`;
  for(const side of ['home','away'])if(!Number.isFinite(row[side])||row[side]<0||row[side]>5000||(!row.decimals&&!Number.isSafeInteger(row[side])))return `Controleer de waarden van statistiek ${index+1}.`;
 }
 return null;
};
export const videoFormat={id:'video',fixedOutput:true,requirements:['matchData','matchStats'],init(root,shared){
 const workspace=root.querySelector('[data-video-flow]');if(!workspace)return {activate(){},getRequirementStatus(){return {}}};
 const $=selector=>workspace.querySelector(selector),content=$('[data-video-content]'),panel=$('[data-video-preview-panel]'),storyboard=$('[data-video-storyboard]'),result=$('[data-video-result]'),title=$('[data-video-title]'),status=$('[data-video-status]'),mode=$('[data-video-mode]'),primary=$('[data-video-primary]'),secondary=$('[data-video-secondary]'),reset=$('[data-video-reset]'),refresh=$('[data-video-refresh]'),confirm=$('[data-video-confirm]'),confirmStart=$('[data-video-confirm-start]'),confirmCancel=$('[data-video-confirm-cancel]'),player=$('video'),download=$('[data-video-download]'),dialog=$('[data-video-dialog]');
 const previewMode=root.dataset.socialsLocalVideoPreview==='true';
 let active=false,request=0,poll=null,phase='loading',source=null,data=null,approved=null,current=null,ready=false,locked=false,fixtureLoaded=null,error='',submitting=false,attempt=null;
 const fixture=()=>shared.selectedFixtureKey,done=()=>!previewMode&&locked&&current?.status==='done'&&Boolean(current.mediaUrl);
 const summary=()=>{const section=el('section','','socials-video-summary');const match=el('div','','socials-video-summary__match');match.append(el('strong',`${data.home} ${data.homeScore} — ${data.awayScore} ${data.away}`),el('span',`${data.date} · ${data.competition}`));section.append(match);const list=el('ol','','socials-video-summary__stats');for(const stat of data.stats){const row=el('li');row.append(el('span',`${stat.home}${stat.suffix}`),el('strong',stat.label),el('b',`${stat.away}${stat.suffix}`));list.append(row)}section.append(list,el('p',data.followText,'socials-video-summary__outro'));return section};
 const field=(label,key,value,max,kind='text',statIndex=-1)=>{const wrap=el('label','','socials-video-field');wrap.append(el('span',label));const input=document.createElement('input');input.type=kind;input.value=value;input.dataset.videoKey=key;if(statIndex>=0)input.dataset.videoStat=String(statIndex);if(max)input.maxLength=max;if(kind==='number'){input.min='0';input.max=max;input.step=statIndex>=0&&data.stats[statIndex].decimals?'0.01':'1';input.inputMode=statIndex>=0&&data.stats[statIndex].decimals?'decimal':'numeric'}wrap.append(input);return wrap};
 const editView=()=>{
  const form=el('div','','socials-video-inline');
  const match=el('div','','socials-video-inline__match');
  const home=el('div','','socials-video-inline__team'),away=el('div','','socials-video-inline__team');
  home.append(field('Thuisteam','home',data.home,54),field('Goals thuis','homeScore',data.homeScore,99,'number'));
  away.append(field('Uitteam','away',data.away,54),field('Goals uit','awayScore',data.awayScore,99,'number'));
  match.append(home,away);form.append(match);
  const context=el('div','','socials-video-inline__context');
  context.append(field('Wedstrijddatum','date',data.date,42),field('Competitie','competition',data.competition,54));form.append(context);
  const stats=el('div','','socials-video-inline__stats');
  const heading=el('div','','socials-video-inline__stat-head');heading.append(el('span','Thuis'),el('span','Statistiek'),el('span','Uit'));stats.append(heading);
  for(const [index,stat] of data.stats.entries()){
   const row=el('div','','socials-video-inline__stat');
   row.append(field(`Thuis ${stat.suffix}`,'home',stat.home,5000,'number',index),field(`Statistiek ${index+1}`,'label',stat.label,30,'text',index),field(`Uit ${stat.suffix}`,'away',stat.away,5000,'number',index));stats.append(row)
  }
  form.append(stats,field('Afsluitende tekst','followText',data.followText,34));return form;
 };
 const setJob=job=>{current=job;if(job?.status==='done'&&job.mediaUrl&&!previewMode){player.src=job.mediaUrl;download.href=job.mediaUrl+'&download=1'}else{player.pause();player.removeAttribute('src');download.removeAttribute('href')}};
 const draw=()=>{
  workspace.dataset.phase=phase;mode.hidden=!previewMode;content.replaceChildren();status.hidden=!error;status.textContent=error;panel.hidden=!['preview','result'].includes(phase);storyboard.hidden=phase!=='preview';result.hidden=phase!=='result';
  primary.hidden=!['edit','preview','processing'].includes(phase);secondary.hidden=phase!=='preview';reset.hidden=phase!=='edit'||equal(source,data);refresh.hidden=phase!=='missing';
  if(phase==='loading'){title.textContent='Gegevens laden…'}
  if(phase==='missing'){title.textContent='Statistieken controleren';refresh.textContent='Statistieken vernieuwen'}
  if(phase==='edit'){title.textContent='Controleer de gegevens';content.append(editView());primary.textContent='Bekijk voorbeeld';primary.disabled=false}
  if(phase==='preview'){title.textContent='Bekijk de zeven scènes';content.append(summary());primary.textContent=previewMode?'Voorbeeldmodus · render uitgeschakeld':'Genereer definitieve video';primary.disabled=previewMode||!approved||!equal(approved,data);secondary.textContent='Gegevens wijzigen'}
  if(phase==='processing'){title.textContent='Video wordt gemaakt';content.append(summary());primary.textContent='Video wordt gemaakt…';primary.disabled=true}
  if(phase==='result'){title.textContent='Video gegenereerd';content.append(summary())}
  root.dispatchEvent(new CustomEvent('socials:format-status-change',{detail:{formatId:'video'}}));
 };
 const invalidate=()=>{approved=null;attempt=null;storyboard.replaceChildren();confirm.hidden=true;if(phase==='preview')phase='edit'};
 async function load(){if(!active||!fixture())return;clearTimeout(poll);const key=fixture(),token=++request;error='';try{const response=await fetch(endpoint+'&fixture='+encodeURIComponent(key),{headers:{Accept:'application/json'}}),payload=await response.json();if(token!==request||!active||key!==fixture())return;if(!response.ok)throw new Error(payload.error||'Videogegevens konden niet worden geladen.');ready=Boolean(payload.data)&&!payload.validationError&&(previewMode||!payload.configError);locked=previewMode?false:Boolean(payload.locked);fixtureLoaded=key;setJob(previewMode?null:(payload.jobs.find(job=>job.status==='done')??payload.jobs[0]??null));source=payload.data?clone(payload.data):null;data=done()?clone(current.data):source?clone(source):null;approved=null;storyboard.replaceChildren();error=payload.validationError||payload.statusWarning||(!previewMode&&payload.configError)||'';phase=done()?'result':current&&busy.has(current.status)?'processing':ready?'edit':'missing';draw();if(phase==='processing'&&current.status!=='uncertain')poll=setTimeout(load,5000)}catch(e){if(token!==request)return;ready=false;error=e.message||'Videogegevens konden niet worden geladen.';phase='missing';draw()}}
 async function preview(){if(!ready||!data||phase==='processing'||phase==='result')return;const problem=valid(data);if(problem){error=problem;draw();return}error='';primary.disabled=true;primary.textContent='Voorbeeld opbouwen…';const snapshot=clone(data),key=fixture(),token=request;const success=await renderStoryboard(storyboard,snapshot);if(token!==request||key!==fixture())return;if(!equal(data,snapshot)){storyboard.replaceChildren();primary.disabled=false;primary.textContent='Bekijk voorbeeld';return}if(success){approved=snapshot;phase='preview';error=''}else{approved=null;error='Het voorbeeld kon niet worden opgebouwd. Klik opnieuw op Bekijk voorbeeld.'}draw()}
 async function start(){if(previewMode||submitting||!approved||!equal(approved,data)||fixtureLoaded!==fixture()||phase!=='preview'||!ready||locked)return;submitting=true;confirm.hidden=true;const finalData=clone(approved);attempt??={fixture:fixture(),requestKey:crypto.randomUUID(),data:finalData,...(current?.status==='failed'?{regenerateOf:current.id}:{})};phase='processing';draw();try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(attempt)}),payload=await response.json();if(!response.ok)throw new Error(payload.error||'Videoaanvraag is mislukt.');attempt=null;setJob(payload.job);data=clone(payload.job.data);approved=null;storyboard.replaceChildren();error=payload.job.error||''}catch(e){error=(e.message||'Videoaanvraag is mislukt.')+' Controleer de status voordat je opnieuw probeert.'}finally{submitting=false;draw();void load()}}
 content.addEventListener('input',event=>{const input=event.target;if(!input.matches('[data-video-key]')||phase!=='edit')return;const index=input.dataset.videoStat,key=input.dataset.videoKey,value=input.type==='number'?input.valueAsNumber:input.value;if(index!==undefined)data.stats[Number(index)][key]=value;else data[key]=value;invalidate();error='';reset.hidden=equal(source,data)});
 primary.addEventListener('click',()=>{if(phase==='edit')void preview();else if(phase==='preview'&&approved&&equal(approved,data)&&!previewMode)confirm.hidden=false});
 secondary.addEventListener('click',()=>{if(phase!=='preview')return;approved=null;storyboard.replaceChildren();phase='edit';error='';draw()});
 reset.addEventListener('click',()=>{data=clone(source);invalidate();error='';draw()});
 confirmCancel.addEventListener('click',()=>confirm.hidden=true);confirmStart.addEventListener('click',start);
 refresh.addEventListener('click',async()=>{refresh.disabled=true;error='Statistieken worden vernieuwd…';draw();try{const response=await fetch('/api/club-tools?view=socials-match-stats-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fixture:fixture()})}),payload=await response.json();if(!response.ok)throw new Error(payload.error||'Verversen is mislukt.');shared.matchStatsByFixture.set(fixture(),payload);root.dispatchEvent(new CustomEvent('socials:match-stats',{detail:{fixtureKey:fixture()}}));await load()}catch(e){error=e.message||'Verversen is mislukt.';draw()}finally{refresh.disabled=false}});
 storyboard.addEventListener('click',event=>{const button=event.target.closest('.socials-storyboard-open');if(!button)return;const image=button.querySelector('img');dialog.querySelector('img').src=image.src;dialog.querySelector('img').alt=image.alt;dialog.showModal()});dialog.querySelector('[data-video-dialog-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
 root.addEventListener('socials:match-selection',()=>{request++;source=null;data=null;approved=null;ready=false;locked=false;current=null;phase='loading';storyboard.replaceChildren();draw();if(active)void load()});root.addEventListener('socials:match-stats',()=>{if(active)void load()});
 return {activate(){active=true;void load()},deactivate(){active=false;request++;clearTimeout(poll);player.pause()},reset(){if(source&&phase!=='result'&&phase!=='processing'){data=clone(source);invalidate();draw()}},getRequirementStatus(){return {matchData:Boolean(fixture()),matchStats:ready}}};
}};
