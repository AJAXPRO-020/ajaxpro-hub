export const outblinkerStats=[
  {id:"minutes",label:"Minuten"},
  {id:"goals",label:"Goals"},
  {id:"assists",label:"Assists"},
  {id:"rating",label:"Rating"},
  {id:"xg",label:"xG"},
  {id:"xa",label:"xA"},
  {id:"xgot",label:"xGOT"},
  {id:"shots",label:"Schoten"},
  {id:"shotsOnTarget",label:"Schoten op doel"},
  {id:"chancesCreated",label:"Kansen gecreëerd"},
  {id:"passes",label:"Passes"},
  {id:"passAccuracy",label:"Passnauwkeurigheid"},
  {id:"tackles",label:"Tackles"},
  {id:"interceptions",label:"Intercepties"},
  {id:"recoveries",label:"Recoveries"},
  {id:"groundDuelsWon",label:"Gewonnen grondduels"},
  {id:"aerialDuelsWon",label:"Gewonnen luchtduels"},
  {id:"duelsWon",label:"Gewonnen duels"},
];

const automaticOrder=["rating","goals","xg","shots","shotsOnTarget","assists","xa","xgot","chancesCreated","passes","passAccuracy","minutes","tackles","interceptions","recoveries","groundDuelsWon","aerialDuelsWon","duelsWon"];
const readTemplate=(root,selector)=>{const template=root.querySelector(selector);if(!template)return [];try{const value=JSON.parse(template.content.textContent||"[]");return Array.isArray(value)?value:[]}catch{return []}};
const hasValue=value=>value!==null&&value!==undefined;
const statFor=id=>outblinkerStats.find(stat=>stat.id===id)??null;
const providerKey=player=>player?.fotmobId!==null&&player?.fotmobId!==undefined?`fotmob:${player.fotmobId}`:player?.optaId!==null&&player?.optaId!==undefined?`opta:${player.optaId}`:`name:${normalizeName(player?.name)}`;
const formatDate=value=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Amsterdam"}).format(new Date(value));

export const normalizeName=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("nl-NL").replace(/[^a-z0-9]+/g," ").trim();
export const registryPlayerFor=(providerPlayer,registryPlayers)=>{
  const expected=normalizeName(providerPlayer?.name);
  if(!expected)return null;
  const exact=registryPlayers.find(player=>normalizeName(player?.name)===expected);
  if(exact)return exact;
  const surname=expected.split(" ").at(-1),matches=registryPlayers.filter(player=>normalizeName(player?.name).split(" ").at(-1)===surname);
  return matches.length===1?matches[0]:null;
};
export const automaticStatsFor=player=>automaticOrder.filter(id=>hasValue(player?.[id])).slice(0,5);
export const hasUsableStats=player=>automaticStatsFor(player).length>0;
export const displayStatValue=(player,id)=>{
  if(!player||!hasValue(player[id]))return "—";
  if(id==="passes")return hasValue(player.accuratePasses)?`${player.accuratePasses}/${player.passes}`:String(player.passes);
  const value=Number(player[id]);
  if(id==="minutes")return `${value}’`;
  if(id==="passAccuracy")return `${String(value).replace(".",",")}%`;
  if(["rating","xg","xa","xgot"].includes(id))return value.toFixed(2).replace(".",",");
  return String(player[id]).replace(".",",");
};

export const initOutblinker=(root,sharedState)=>{
  const workspace=root.querySelector("[data-outblinker-workspace]"),fixtures=readTemplate(root,"template[data-socials-match-context]"),registryPlayers=readTemplate(root,"template[data-socials-players]");
  if(!workspace||!fixtures.length)return {activate(){},deactivate(){}};
  const playerSelect=workspace.querySelector("[data-outblinker-player-select]"),statSelects=[...workspace.querySelectorAll("[data-outblinker-stat-slot]")],outputInputs=[...root.querySelectorAll('[name="social-output"]')],preview=workspace.querySelector("[data-outblinker-preview]"),status=workspace.querySelector("[data-outblinker-status]"),photoStatus=workspace.querySelector("[data-outblinker-photo-status]");
  const selections=new Map();
  let providerPlayers=[],selectedPlayerKey="";
  const fixtureForSelection=()=>fixtures.find(fixture=>fixture.fixture_key===sharedState.selectedFixtureKey)??fixtures[0];
  const selectedPlayer=()=>providerPlayers.find(player=>providerKey(player)===selectedPlayerKey)??providerPlayers[0]??null;
  const selectionFor=player=>{if(!player)return [];const key=providerKey(player);if(!selections.has(key))selections.set(key,automaticStatsFor(player));return selections.get(key)};
  const availableStats=player=>outblinkerStats.filter(stat=>hasValue(player?.[stat.id]));
  const replaceOptions=(select,player,selected,index)=>{
    const chosen=new Set(selected.filter((_,slot)=>slot!==index));
    select.replaceChildren(new Option("Geen stat",""),...availableStats(player).map(stat=>{const option=new Option(stat.label,stat.id);option.disabled=chosen.has(stat.id);return option}));
    select.value=selected[index]??"";select.disabled=!player;
  };
  const replacePlayers=()=>{
    const current=selectedPlayerKey;
    playerSelect.replaceChildren(...providerPlayers.map(player=>new Option(player.name,providerKey(player))));
    selectedPlayerKey=providerPlayers.some(player=>providerKey(player)===current)?current:providerKey(providerPlayers[0]);
    playerSelect.value=selectedPlayerKey;playerSelect.disabled=!providerPlayers.length;
  };
  const syncPlayers=()=>{
    const payload=sharedState.getMatchStats?.(fixtureForSelection().fixture_key),next=Array.isArray(payload?.players)?payload.players.filter(player=>player&&player.name):[];
    const changed=next.length!==providerPlayers.length||next.some((player,index)=>providerKey(player)!==providerKey(providerPlayers[index]));
    providerPlayers=next;if(changed)replacePlayers();return Boolean(payload);
  };
  const render=()=>{
    const hasPayload=syncPlayers(),player=selectedPlayer(),registry=registryPlayerFor(player,registryPlayers),selected=selectionFor(player),context=fixtureForSelection();
    const usable=hasUsableStats(player);
    status.textContent=!hasPayload?"Haal eerst de wedstrijdstats op.":!player?"Geen Ajax-spelers met wedstrijddata gevonden.":!usable?"Voor deze speler zijn geen wedstrijdstatistieken beschikbaar. Kies een andere speler.":`${providerPlayers.length} Ajax-spelers beschikbaar.`;
    status.dataset.state=hasPayload&&player&&!usable?"missing":"available";
    preview.hidden=!usable;workspace.querySelector("[data-outblinker-preview-empty]").hidden=usable||!player;
    photoStatus.textContent=!player?"Nog geen speler gekozen.":registry?.imageUrl?`Eigen AjaxPro-foto gekoppeld aan ${registry.name}.`:`Geen eigen foto gevonden voor ${player.name}.`;
    photoStatus.dataset.state=registry?.imageUrl?"available":player?"missing":"idle";
    statSelects.forEach((select,index)=>replaceOptions(select,usable?player:null,usable?selected:[],index));
    const photo=workspace.querySelector("[data-outblinker-photo]"),placeholder=workspace.querySelector("[data-outblinker-photo-placeholder]");
    if(registry?.imageUrl){photo.src=registry.imageUrl;photo.alt=`Foto van ${registry.name}`;photo.hidden=false;placeholder.hidden=true}else{photo.removeAttribute("src");photo.alt="";photo.hidden=true;placeholder.hidden=false}
    workspace.querySelector("[data-outblinker-name]").textContent=registry?.name??player?.name??"UITBLINKER";
    workspace.querySelector("[data-outblinker-match]").textContent=`${context.competition} · ${formatDate(context.kickoff_at)} · ${context.home_team} ${context.goals_home??"–"}–${context.goals_away??"–"} ${context.away_team}`.toLocaleUpperCase("nl-NL");
    [...workspace.querySelectorAll("[data-outblinker-preview-slot]")].forEach((slot,index)=>{const id=selected[index],stat=statFor(id);slot.hidden=!stat||!player;if(stat&&player){slot.querySelector("span").textContent=stat.label;slot.querySelector("strong").textContent=displayStatValue(player,id)}});
    const output=outputInputs.find(input=>input.checked)??outputInputs[0];
    if(output){preview.dataset.aspect=output.value;workspace.querySelector("[data-outblinker-preview-ratio]").textContent=output.value==="vertical-9x16"?"9:16":"4:5";workspace.querySelector("[data-outblinker-dimensions]").textContent=`${output.dataset.width} × ${output.dataset.height}`}
    root.dispatchEvent(new CustomEvent("socials:format-status-change",{detail:{formatId:"outblinker"}}));
  };
  playerSelect.addEventListener("change",()=>{selectedPlayerKey=playerSelect.value;render()});
  statSelects.forEach((select,index)=>select.addEventListener("change",()=>{const player=selectedPlayer();if(!player)return;const selected=[...selectionFor(player)];if(select.value)selected[index]=select.value;else selected.splice(index,1);selections.set(providerKey(player),selected.filter(Boolean).slice(0,5));render()}));
  root.addEventListener("socials:match-selection",()=>{providerPlayers=[];selectedPlayerKey="";replacePlayers();render()});
  outputInputs.forEach(input=>input.addEventListener("change",render));
  root.addEventListener("socials:match-stats",event=>{if(event.detail?.fixtureKey===fixtureForSelection().fixture_key)render()});
  render();
  return {activate:render,deactivate(){},reset(){selections.clear();selectedPlayerKey=providerKey(providerPlayers[0]);if(playerSelect)playerSelect.value=selectedPlayerKey;render()},getRequirementStatus(){const payload=sharedState.getMatchStats?.(fixtureForSelection().fixture_key),player=selectedPlayer(),registry=registryPlayerFor(player,registryPlayers);return {matchData:Boolean(fixtureForSelection()),matchStats:Boolean(payload),playerStats:hasUsableStats(player),playerPhoto:Boolean(registry?.imageUrl)}}};
};

export const outblinkerFormat={id:"outblinker",label:"Uitblinker",requirements:["matchData","matchStats","playerStats","playerPhoto"],init:initOutblinker};
