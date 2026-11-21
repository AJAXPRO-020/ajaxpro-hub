const formatDate=(value)=>{if(!value)return"";const date=new Date(`${value}T12:00:00Z`);return new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(date)};
const clean=(value)=>String(value??"").replace(/[\u2013\u2014]/g,"-");
const text=(tag,value,className)=>{const element=document.createElement(tag);if(className)element.className=className;element.textContent=clean(value);return element};

const contractType=(label,tone="default")=>text("span",label,`contract-card__type contract-card__type--${tone}`);

const fact=(label,value,note)=>{
  const item=document.createElement("div");item.className="contract-card__fact";
  item.append(text("span",label),text("strong",value));
  if(note)item.append(text("small",note));
  return item;
};

const cardHeader=(name,position,typeLabel,typeTone)=>{
  const header=document.createElement("header");header.className="contract-card__header";
  const identity=document.createElement("div");identity.className="contract-card__identity";identity.append(text("h3",name),text("p",position));
  header.append(identity,contractType(typeLabel,typeTone));return header;
};

const loanDealPanel=(deal)=>{
  if(!deal||!Array.isArray(deal.terms)||!deal.terms.length||!Array.isArray(deal.sources)||!deal.sources.length)return null;
  const reported=deal.status==="reported",disclosure=document.createElement("details");disclosure.className="loan-deal";
  const summary=document.createElement("summary"),title=document.createElement("span");title.className="loan-deal__title";title.append(text("strong","Huurconstructie"),text("small","Bekende afspraken en bronnen"));
  const summaryMeta=document.createElement("span");summaryMeta.className="loan-deal__summary-meta";summaryMeta.append(text("span",reported?"Niet bevestigd":"Bron bevestigd",`loan-deal__status loan-deal__status--${reported?"reported":"confirmed"}`),text("span","","loan-deal__chevron"));summaryMeta.lastElementChild.setAttribute("aria-hidden","true");summary.append(title,summaryMeta);
  const body=document.createElement("div");body.className="loan-deal__body";body.append(text("h4","Bekende afspraken"));
  const terms=document.createElement("ul");terms.className="loan-deal__terms";deal.terms.forEach(term=>terms.append(text("li",term)));body.append(terms);
  if(deal.note){const caveat=document.createElement("div");caveat.className="loan-deal__caveat";caveat.append(text("strong",reported?"Wat is onzeker?":"Wat is niet openbaar?"),text("p",deal.note));body.append(caveat)}
  const sources=document.createElement("div");sources.className="loan-deal__sources";sources.append(text("span",deal.sources.length===1?"Bron":"Bronnen"));deal.sources.forEach(source=>{if(!source?.url?.startsWith("https://"))return;const link=text("a",source.label);link.href=source.url;link.target="_blank";link.rel="noreferrer";sources.append(link)});body.append(sources);
  disclosure.append(summary,body);return disclosure;
};

const arrivalDealPanel=(deal)=>{
  if(!deal||!deal.fromClub||!deal.transferType||!deal.fee||!Array.isArray(deal.sources)||!deal.sources.length)return null;
  const reported=deal.status==="partly_reported",disclosure=document.createElement("details");disclosure.className="loan-deal arrival-deal";
  const summary=document.createElement("summary"),title=document.createElement("span");title.className="loan-deal__title";title.append(text("strong","Herkomst & transferdeal"),text("small",`${deal.fromClub} · ${deal.transferType}`));
  const summaryMeta=document.createElement("span");summaryMeta.className="loan-deal__summary-meta";summaryMeta.append(text("span",reported?"Deels gemeld":"Bron bevestigd",`loan-deal__status loan-deal__status--${reported?"reported":"confirmed"}`),text("span","","loan-deal__chevron"));summaryMeta.lastElementChild.setAttribute("aria-hidden","true");summary.append(title,summaryMeta);
  const body=document.createElement("div");body.className="loan-deal__body";
  const overview=document.createElement("dl");overview.className="arrival-deal__overview";
  [["Overgekomen van",deal.fromClub],["Overgang",deal.transferType],["Bedrag",deal.fee]].forEach(([label,value])=>{const item=document.createElement("div");item.append(text("dt",label),text("dd",value));overview.append(item)});body.append(overview);
  if(Array.isArray(deal.terms)&&deal.terms.length){body.append(text("h4","Bekende constructie"));const terms=document.createElement("ul");terms.className="loan-deal__terms";deal.terms.forEach(term=>terms.append(text("li",term)));body.append(terms)}
  if(deal.note){const caveat=document.createElement("div");caveat.className="loan-deal__caveat";caveat.append(text("strong",reported?"Wat is onzeker?":"Wat is niet openbaar?"),text("p",deal.note));body.append(caveat)}
  const sources=document.createElement("div");sources.className="loan-deal__sources";sources.append(text("span",deal.sources.length===1?"Bron":"Bronnen"));deal.sources.forEach(source=>{if(!source?.url?.startsWith("https://"))return;const link=text("a",source.label);link.href=source.url;link.target="_blank";link.rel="noreferrer";sources.append(link)});body.append(sources);
  disclosure.append(summary,body);return disclosure;
};

const contractCard=(player,loan=false)=>{
  const incoming=!loan&&player.contractForm==="loaned_in";
  const article=document.createElement("article");article.className=`contract-card${loan?" contract-card--loan":incoming?" contract-card--incoming":""}`;
  article.append(cardHeader(player.name,player.contractPosition||player.position,loan?"Verhuurd":incoming?"Gehuurd":"Bij Ajax",loan||incoming?"loan":"default"));
  const facts=document.createElement("div");facts.className="contract-card__facts";
  if(loan){
    facts.append(fact("Tijdelijk bij",player.loanClub||"Niet bekend"),fact("Verhuur tot",player.loanEnd?formatDate(player.loanEnd):"Niet bekend",player.loanNote),fact("Ajax-contract tot",player.contractEnd?formatDate(player.contractEnd):"Niet bekend",player.contractNote));
  }else if(incoming){
    facts.append(fact("Gehuurd van",player.contractNote?.match(/^gehuurd van\s+(.+)/i)?.[1]||player.arrivalDeal?.fromClub||"Niet vastgelegd"),fact("Huurperiode tot",player.contractEnd?formatDate(player.contractEnd):"Niet bekend"));
  }else{
    facts.append(fact(player.contractForm==="no_contract"?"Contractstatus":"Contract tot",player.contractForm==="no_contract"?"Geen Ajax-contract":player.contractEnd?formatDate(player.contractEnd):"Nog niet bekend"));
    if(player.contractNote)facts.append(fact("Opmerking",player.contractNote));
  }
  article.append(facts);
  const arrivalPanel=!loan?arrivalDealPanel(player.arrivalDeal):null;if(arrivalPanel)article.append(arrivalPanel);
  const dealPanel=loan?loanDealPanel(player.loanDeal):null;if(dealPanel)article.append(dealPanel);
  return article;
};

const staticDate=(article,value)=>{
  const raw=clean(value).replace(/^Huur t\/m\s+/i,"").replace(/^Verhuurd t\/m\s+/i,"").replace(/^Ajax-contract t\/m\s+/i,"").split(" · ")[0];
  if(!/^30 jun$/i.test(raw))return raw;
  const year=article.closest(".contract-year")?.querySelector(".contract-year__heading h2")?.textContent?.trim();
  return year&&/^\d{4}$/.test(year)?`30 juni ${year}`:raw;
};

const enhanceStaticDeal=(deal)=>{
  if(!deal||deal.dataset.enhanced)return;deal.dataset.enhanced="true";
  const summary=deal.querySelector("summary"),body=deal.querySelector(".loan-deal__body"),status=body?.querySelector(".loan-deal__status"),terms=body?.querySelector(".loan-deal__terms"),note=body?.querySelector(".loan-deal__note");if(!summary||!body||!status)return;
  const reported=status.classList.contains("loan-deal__status--reported"),title=document.createElement("span");title.className="loan-deal__title";title.append(text("strong","Huurconstructie"),text("small","Bekende afspraken en bronnen"));
  status.textContent=reported?"Niet bevestigd":"Bron bevestigd";const meta=document.createElement("span");meta.className="loan-deal__summary-meta";const chevron=summary.querySelector(".loan-deal__chevron");meta.append(status,chevron||text("span","","loan-deal__chevron"));summary.replaceChildren(title,meta);
  if(terms)terms.before(text("h4","Bekende afspraken"));
  if(note){const caveat=document.createElement("div");caveat.className="loan-deal__caveat";caveat.append(text("strong",reported?"Wat is onzeker?":"Wat is niet openbaar?"),text("p",note.textContent));note.replaceWith(caveat)}
};

const enhanceStaticCard=(article)=>{
  if(article.dataset.enhanced)return;article.dataset.enhanced="true";
  const identity=article.querySelector(":scope > .contract-card__identity"),name=identity?.querySelector("h3")?.textContent?.trim(),positionLine=identity?.querySelector("p")?.textContent?.trim()||"",date=article.querySelector(":scope > .contract-card__date");if(!identity||!name||!date)return;
  const loan=article.classList.contains("contract-card--loan"),incoming=!loan&&/gehuurd van/i.test(positionLine),position=positionLine.split(" · ")[0],facts=document.createElement("div");facts.className="contract-card__facts";
  if(loan){const route=article.querySelector(":scope > .loan-route"),until=article.querySelector(":scope > .loan-until"),club=route?.querySelector("strong")?.textContent?.trim()||"Niet bekend",loanParts=(until?.textContent||"").split(" · "),contractParts=date.textContent.split(" · ");facts.append(fact("Tijdelijk bij",club),fact("Verhuur tot",staticDate(article,loanParts[0]),loanParts[1]),fact("Ajax-contract tot",staticDate(article,contractParts[0]),contractParts[1]));route?.remove();until?.remove();}
  else if(incoming){const club=positionLine.split(/gehuurd van\s+/i)[1]||"Niet bekend";facts.append(fact("Gehuurd van",club),fact("Huurperiode tot",staticDate(article,date.textContent)));article.classList.add("contract-card--incoming");}
  else facts.append(fact("Contract tot",staticDate(article,date.textContent)));
  const header=cardHeader(name,position,loan?"Verhuurd":incoming?"Gehuurd":"Bij Ajax",loan||incoming?"loan":"default");identity.remove();date.remove();article.prepend(header);article.insertBefore(facts,article.querySelector(".loan-deal"));enhanceStaticDeal(article.querySelector(".loan-deal"));
};

const enhanceStaticCards=()=>document.querySelectorAll(".contract-card").forEach(enhanceStaticCard);

const renderRegistry=({players,updatedAt})=>{
  if(!Array.isArray(players)||!players.length)return;
  const content=document.querySelector(".contracts-content"),loanSection=document.querySelector(".loan-section");if(!content||!loanSection)return;
  const active=players.filter(player=>player.active),loans=players.filter(player=>player.loanedOut);if(!active.length)return;
  document.querySelectorAll(".contract-year").forEach(section=>section.remove());
  const years=new Map();active.forEach(player=>{const year=player.contractEnd?player.contractEnd.slice(0,4):"Onbekend",group=years.get(year)||[];group.push(player);years.set(year,group)});
  [...years].sort(([a],[b])=>a==="Onbekend"?1:b==="Onbekend"?-1:a.localeCompare(b)).forEach(([year,group])=>{const section=document.createElement("section");section.className="contract-year";const id=`year-${year.toLowerCase()}`;section.setAttribute("aria-labelledby",id);const heading=document.createElement("div");heading.className="contract-year__heading";const title=text("h2",year);title.id=id;heading.append(title,text("span",`${group.length} ${group.length===1?"speler":"spelers"}`));const grid=document.createElement("div");grid.className="contracts-grid";group.sort((a,b)=>a.name.localeCompare(b.name,"nl")).forEach(player=>grid.append(contractCard(player)));section.append(heading,grid);content.insertBefore(section,loanSection)});
  const loanGrid=loanSection.querySelector(".contracts-grid");if(loanGrid)loanGrid.replaceChildren(...loans.sort((a,b)=>a.name.localeCompare(b.name,"nl")).map(player=>contractCard(player,true)));
  const summary=document.querySelectorAll(".contracts-summary dd");if(summary[0])summary[0].textContent=`${active.length} spelers`;if(summary[1])summary[1].textContent=`${loans.length} spelers`;if(summary[2])summary[2].textContent=[...years.keys()].filter(year=>year!=="Onbekend").sort().at(-1)||"Niet bekend";
  const navCounts=document.querySelectorAll(".contracts-status-nav span");if(navCounts[0])navCounts[0].textContent=String(active.length);if(navCounts[1])navCounts[1].textContent=String(loans.length);
  const updated=document.querySelector("[data-player-registry-updated]");if(updated&&updatedAt){const date=new Date(updatedAt);updated.dateTime=date.toISOString();updated.textContent=new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Amsterdam"}).format(date)}
};

enhanceStaticCards();
fetch("/api/players?include=contracts",{headers:{Accept:"application/json"}}).then(response=>response.ok?response.json():Promise.reject(new Error("REGISTRY_UNAVAILABLE"))).then(renderRegistry).catch(()=>{/* De statische contractenlijst blijft zichtbaar als veilige fallback. */});
