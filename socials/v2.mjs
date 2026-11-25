const root=document.querySelector('[data-socials-v2]');
if(root){
  const matchIds=['stats','shots-map','notable-stat','outblinker','top-three','card-video','video'];
  const otherIds=['ajax-vandaag','quote'];
  const cards=root.querySelector('[data-v2-cards]');
  const overview=root.querySelector('[data-v2-overview]');
  const back=root.querySelector('[data-v2-back]');
  const editorTitle=root.querySelector('[data-v2-editor-title]');
  const matchPanel=root.querySelector('.socials-data-panel');
  const categoryButtons=[...root.querySelectorAll('[data-v2-category]')];
  const providerGroup=root.querySelector('.socials-status-group--providers');
  if(providerGroup){
    const details=document.createElement('details');details.className='socials-v2-sources';
    const summary=document.createElement('summary');summary.textContent='Databronnen bekijken';
    providerGroup.replaceWith(details);details.append(summary,providerGroup);
  }
  let category='match';
  let editing=false;
  let previewUrls=[];
  const renderCards=()=>{
    overview.querySelector('h2').textContent=category==='match'?'Beschikbare wedstrijdcontent':'Overige content';
    previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];
    cards.replaceChildren();
    for(const id of category==='match'?matchIds:otherIds){
      const source=root.querySelector(`[data-format-id="${id}"]`);
      const workspace=root.querySelector(`[data-format-workspace="${id}"]`);
      if(!source||!workspace)continue;
      const card=document.createElement('article');card.className='socials-v2-card';
      const title=document.createElement('h3');title.textContent=source.querySelector('strong')?.textContent||id;
      const preview=document.createElement('div');preview.className='socials-v2-card-preview';
      const artwork=workspace.querySelector('.socials-preview-panel article, .socials-preview-panel img, .card-video-poster');
      if(artwork){const copy=artwork.cloneNode(true);copy.removeAttribute('id');
        if(id==='notable-stat'){
          const canvas=artwork.querySelector('canvas');
          if(canvas){const image=document.createElement('img');image.alt='Voorbeeld Opvallend cijfer';copy.replaceChildren(image);canvas.toBlob(blob=>{if(blob&&image.isConnected){const url=URL.createObjectURL(blob);previewUrls.push(url);image.src=url}else if(!blob)copy.textContent='Voorbeeld beschikbaar in de editor'},'image/png')}
        }else copy.querySelectorAll('canvas').forEach(canvas=>canvas.remove());
        preview.append(copy)}
      else preview.textContent=id==='ajax-vandaag'?'Drie historische voorstellen':'Voorbeeld verschijnt bij bewerken';
      const status=document.createElement('p');status.className='socials-v2-card-status';
      status.textContent=id==='quote'?'Maak zelf een quote':id==='ajax-vandaag'?'Genereer op datum':source.dataset.dataReady==='false'?'Gegevens ontbreken':'Voorstel beschikbaar';
      const edit=document.createElement('button');edit.type='button';edit.className='button secondary';edit.textContent='Bewerken';edit.disabled=source.disabled;
      edit.addEventListener('click',()=>{editing=true;root.dataset.v2Editing='true';overview.hidden=true;back.hidden=false;editorTitle.textContent=title.textContent;editorTitle.hidden=false;source.click();back.scrollIntoView({block:'start'});});
      card.append(title,preview,status,edit);cards.append(card);
    }
  };
  const showOverview=()=>{editing=false;root.dataset.v2Editing='false';overview.hidden=false;back.hidden=true;editorTitle.hidden=true;renderCards();overview.scrollIntoView({block:'start'});};
  back.addEventListener('click',showOverview);
  categoryButtons.forEach(button=>button.addEventListener('click',()=>{
    category=button.dataset.v2Category;
    matchPanel.hidden=category!=='match';
    categoryButtons.forEach(item=>{if(item===button)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current')});
    showOverview();
  }));
  root.addEventListener('socials:match-stats',()=>{if(!editing)requestAnimationFrame(()=>requestAnimationFrame(renderCards))});
  root.addEventListener('socials:match-selection',()=>{if(!editing)renderCards()});
  root.dataset.v2Editing='false';
  renderCards();
}
