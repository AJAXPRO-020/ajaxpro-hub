(() => {
  const tabs = [...document.querySelectorAll('[data-program-tab]')];
  const panels = [...document.querySelectorAll('[data-program-panel]')];
  const status = document.querySelector('[data-press-status]');
  const list = document.querySelector('[data-press-list]');
  const checked = document.querySelector('[data-press-checked]');
  const button = document.querySelector('[data-press-check]');
  const date = value => new Intl.DateTimeFormat('nl-NL', { timeZone:'Europe/Amsterdam', weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(new Date(value));
  const time = value => new Intl.DateTimeFormat('nl-NL', { timeZone:'Europe/Amsterdam', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
  const node = (tag, cls, value) => { const el=document.createElement(tag); if(cls) el.className=cls; if(value != null) el.textContent=value; return el; };
  const labels = { unconfirmed:'Nog niet bevestigd', announced:'Aangekondigd', live:'Live', ended:'Afgelopen' };
  const open = name => {
    tabs.forEach(tab => { const active=tab.dataset.programTab===name; tab.setAttribute('aria-selected',String(active)); tab.tabIndex=active?0:-1; });
    panels.forEach(panel => { panel.hidden=panel.dataset.programPanel!==name; });
    if(name==='persconferenties' && !list.dataset.loaded) load();
    if(name==='persconferenties' && !button.dataset.checked) checkStaff();
  };
  tabs.forEach((tab,index) => { tab.addEventListener('click',()=>open(tab.dataset.programTab)); tab.addEventListener('keydown',event=>{ if(!['ArrowLeft','ArrowRight'].includes(event.key)) return; event.preventDefault(); const target=tabs[(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length]; target.focus(); open(target.dataset.programTab); }); });
  const render = payload => {
    list.replaceChildren();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Amsterdam', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
    const items = (payload.items || []).filter(item => item.status !== 'ended' && String(item.event_date).slice(0,10) >= today);
    status.textContent = payload.unavailable ? 'Persconferenties zijn tijdelijk niet beschikbaar.' : items.length ? `${items.length} persconferentie${items.length===1?'':'s'}` : 'Er zijn nog geen bevestigde persconferenties gevonden.';
    for(const item of items) {
      const card=node('article','press-card');
      const head=node('div','press-card__head');
      head.append(node('span','press-card__kind',item.kind==='review'?'Nabeschouwing':'Voorbeschouwing'),node('span',`press-card__status press-card__status--${item.status}`,labels[item.status]||'Nog niet bevestigd'));
      card.append(head,node('h2','press-card__match',item.home_team && item.away_team ? `${item.home_team} – ${item.away_team}` : 'Ajax-wedstrijd'));
      const day=node('p','press-card__date',`${date(`${String(item.event_date).slice(0,10)}T12:00:00Z`)} · ${item.starts_at ? `${time(item.starts_at)} uur` : 'Tijd nog onbekend'}`);
      card.append(day);
      const links=node('div','press-card__links');
      const source=node('a','', 'Officiële bron ↗'); source.href=item.source_url; source.target='_blank'; source.rel='noopener noreferrer'; links.append(source);
      for(const [label,href] of Object.entries(item.watch_links||{})) { if(!/^https:\/\//.test(href)) continue; const a=node('a','',`${label} ↗`); a.href=href; a.target='_blank'; a.rel='noopener noreferrer'; links.append(a); }
      card.append(links,node('p','press-card__updated',`Bijgewerkt: ${date(item.updated_at)}`)); list.append(card);
    }
    checked.textContent=payload.preview?'Lokale preview met gecontroleerde historische testgegevens. Live bronnen worden hier niet benaderd.':payload.checkedAt?`Bronnen voor het laatst gecontroleerd: ${date(payload.checkedAt)} om ${time(payload.checkedAt)} uur`:'Nog geen geslaagde broncontrole geregistreerd.';
    list.dataset.loaded='1';
  };
  const load = (fresh = false) => fetch(`/api/press-conferences${fresh ? `?checked=${Date.now()}` : ''}`).then(r=>{if(!r.ok)throw Error();return r.json()}).then(render).catch(()=>{status.textContent='Persconferenties zijn tijdelijk niet beschikbaar.'});
  const checkStaff=()=>{button.dataset.checked='1';fetch('/api/press-conferences?action=staff').then(r=>r.json()).then(data=>{button.hidden=!data.allowed}).catch(()=>{});};
  button.addEventListener('click',async()=>{button.disabled=true;status.textContent='Bronnen controleren…';try{const response=await fetch('/api/press-conferences',{method:'POST',headers:{Origin:location.origin}});if(!response.ok)throw Error();await load(true);}catch{status.textContent='Controle mislukt. De bestaande gegevens blijven zichtbaar.'}finally{button.disabled=false}});
  if(location.hash==='#persconferenties') open('persconferenties');
})();
