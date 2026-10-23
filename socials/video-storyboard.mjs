// Still frames from the exact canvas drawing code used by the Shotstack template.
const scenes=[
  ['01','INTRO','0–3 SEC',2.45],
  ['02','EINDSTAND','3–5 SEC',4.2],
  ['03','BALBEZIT','5–7,25 SEC',6.55],
  ['04','SCHOTEN','7,25–9,5 SEC',8.8],
  ['05','SCHOTEN OP DOEL','9,5–11,75 SEC',11.05],
  ['06','EXPECTED GOALS','11,75–14 SEC',13.3],
  ['07','OUTRO','14–17 SEC',16],
];
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const thumbnails=new WeakMap();
export async function renderStoryboard(target,data){
 const frame=document.createElement('iframe');frame.className='socials-storyboard-source';frame.setAttribute('aria-hidden','true');
 frame.src='/assets/social-video/storyboard-frame.html?data='+encodeURIComponent(JSON.stringify(data));
 for(const url of thumbnails.get(target)||[])URL.revokeObjectURL(url);
 thumbnails.delete(target);
 target.replaceChildren();target.setAttribute('aria-busy','true');
 const loading=document.createElement('p');loading.className='socials-storyboard-loading';loading.textContent='Zeven scènes worden opgebouwd…';target.append(loading);
 document.body.append(frame);
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Storyboard start niet.')),10000);frame.addEventListener('load',()=>{const check=()=>{if(frame.contentWindow?.__ajaxproReady){clearTimeout(timer);resolve()}else setTimeout(check,40)};check()},{once:true})});
  const canvas=frame.contentDocument?.getElementById('frame');if(!canvas)throw new Error('Storyboardcanvas ontbreekt.');
  const cards=[],urls=[];
  for(const [number,label,duration,time] of scenes){
   frame.contentWindow.__shotstackSeek(time*1000);await nextFrame();
   const card=document.createElement('figure');card.className='socials-storyboard-card';
   const open=document.createElement('button');open.type='button';open.className='socials-storyboard-open';open.setAttribute('aria-label',`Vergroot scène ${number}: ${label}`);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Scènebeeld ontbreekt.');
   const image=new Image();image.alt=`Scène ${number}: ${label}`;const url=URL.createObjectURL(blob);urls.push(url);image.src=url;open.append(image);
   const caption=document.createElement('figcaption');const n=document.createElement('span'),name=document.createElement('strong'),seconds=document.createElement('small');n.textContent=number;name.textContent=label;seconds.textContent=duration;caption.append(n,name,seconds);card.append(open,caption);cards.push(card);
  }
  thumbnails.set(target,urls);target.replaceChildren(...cards);return true;
 }catch(error){target.replaceChildren();const message=document.createElement('p');message.className='socials-storyboard-error';message.textContent='Het voorbeeld kon niet worden opgebouwd. Probeer het opnieuw.';target.append(message);console.error('Storyboard',error);return false}
 finally{frame.remove();target.removeAttribute('aria-busy')}
}
