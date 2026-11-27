(function(){
  const typeEnglish=type=>({'Thuis':'Home','Uit':'Away','Special thuis':'Special Home','UEFA Cup uit':'UEFA Away','Derde shirt':'Third','Champions League thuis':'CL Home','Europees: Champions League thuis':'CL Home','De Meer thuis':'De Meer Home'}[type]||type);
  const cutout=shirt=>'/assets/shirt-battle/cutouts/'+shirt.id+'.png';
  let generation=0;
  result=async function(){
    const current=++generation;
    const fixed=['AJ-1992-T','AJ-1992-U','AJ-1993-U'].map(id=>data.find(shirt=>shirt.id===id));
    const list=decodeResult(routeResultToken||query.get('result'))||((query.get('preview')==='result'||query.get('test')==='1')?fixed:ranking());
    if(list.length!==3||list.some(shirt=>!shirt)){root.innerHTML='<p role="alert">RESULT UNAVAILABLE</p>';return}
    const url=resultUrl(list);
    if(!root.querySelector('.scene.duel'))root.innerHTML='<div class="shirt-result-loading" role="status">LOADING YOUR TOP 3</div>';
    const loaded=await Promise.all(list.map(async shirt=>{
      for(const source of [cutout(shirt),posterAsset(shirt)]){
        const image=new Image();image.src=source;
        try{await image.decode();return source}catch{}
      }
      return '';
    }));
    if(current!==generation)return;
    const entries=list.map((shirt,index)=>'<figure class="result-entry"><img src="'+loaded[index]+'" alt="Ajax shirt '+shirt.season+' '+typeEnglish(shirt.type)+'"><figcaption><b>0'+(index+1)+'</b><span>'+shirt.season+' / '+typeEnglish(shirt.type)+'</span></figcaption></figure>').join('');
    root.innerHTML='<section class="scene shirt-result"><header class="result-masthead"><img src="/ajaxpro-logo.png" alt="AjaxPro"><span>THE ABN AMRO ERA / 1991–2008</span></header><h1>AJAX SHIRTS TOP 3</h1><div class="result-podium">'+entries+'</div><p class="result-invite">WHAT’S YOUR TOP 3?</p><div class="result-actions"><button id="share">SHARE MY TOP 3</button><div class="secondary-actions"><button id="download">DOWNLOAD IMAGE</button><button id="link">SHARE LINK</button><button id="xshare">X</button><button id="whatsapp">WHATSAPP</button></div><button id="again">PLAY AGAIN</button></div></section>';
    root.querySelector('#again').onclick=()=>{if(routeResultToken||query.has('result'))location.href='/shirts';else start()};
    root.querySelector('#download').onclick=()=>remoteShare(list,false);
    root.querySelector('#share').onclick=()=>remoteShare(list,true);
    root.querySelector('#link').onclick=()=>copyResultLink(url);
    root.querySelector('#xshare').onclick=()=>location.href='https://x.com/intent/post?text='+encodeURIComponent('My Ajax shirts top 3. What’s yours?')+'&url='+encodeURIComponent(url);
    root.querySelector('#whatsapp').onclick=()=>location.href='https://wa.me/?text='+encodeURIComponent('My Ajax shirts top 3. What’s yours? '+url);
  };
  copyResultLink=async function(url){try{await navigator.clipboard.writeText(url);root.querySelector('#link').textContent='LINK COPIED'}catch{window.prompt('Copy your result link',url)}};
  remoteShare=async function(list,share){
    const imageUrl=new URL('/api/shirt-battle/share/'+resultToken(list)+'?format=story',location.origin).toString();
    if(share&&navigator.share){try{await navigator.share({title:'My Ajax shirts top 3',text:'What’s your top 3? Play on AjaxPro.fans',url:resultUrl(list)});return}catch(error){if(error?.name==='AbortError')return}}
    const anchor=document.createElement('a');anchor.href=imageUrl;anchor.download='ajaxpro-top-three.png';anchor.target='_blank';anchor.click();
  };
})();
