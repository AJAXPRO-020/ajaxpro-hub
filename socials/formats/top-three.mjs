import { displayStatValue, normalizeName, registryPlayerFor } from "./outblinker.mjs";

export const topThreeStats=[
  {id:"goals",label:"Goals"},{id:"assists",label:"Assists"},{id:"xg",label:"xG"},{id:"xa",label:"xA"},
  {id:"shotsOnTarget",label:"Schoten op doel"},{id:"chancesCreated",label:"Kansen gecreëerd"},
  {id:"passAccuracy",label:"Passnauwkeurigheid"},{id:"duelsWon",label:"Gewonnen duels"},
  {id:"tackles",label:"Tackles"},{id:"interceptions",label:"Intercepties"},
];

const readTemplate=(root,selector)=>{const template=root.querySelector(selector);if(!template)return [];try{const value=JSON.parse(template.content.textContent||"[]");return Array.isArray(value)?value:[]}catch{return []}};
const hasValue=value=>value!==null&&value!==undefined;
const providerKey=player=>player?.fotmobId!==null&&player?.fotmobId!==undefined?`fotmob:${player.fotmobId}`:player?.optaId!==null&&player?.optaId!==undefined?`opta:${player.optaId}`:`name:${normalizeName(player?.name)}`;
const registryAliases=new Map([["fotmob:564847","tsygankov"]]);
const formatDate=value=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Amsterdam"}).format(new Date(value));

export const interestingStatsFor=player=>topThreeStats.filter(stat=>hasValue(player?.[stat.id])&&Number(player[stat.id])!==0).slice(0,2);
export const playerOptionsFor=(players,selections,slot)=>players.map(player=>({key:providerKey(player),name:player.name,disabled:selections.some((value,index)=>index!==slot&&value===providerKey(player))}));
export const registryPhotoFor=(providerPlayer,registryPlayers)=>registryPlayerFor(providerPlayer,registryPlayers)??registryPlayers.find(player=>player.id===registryAliases.get(providerKey(providerPlayer)))??null;

export const initTopThree=(root,sharedState)=>{
  const workspace=root.querySelector("[data-top-three-workspace]"),fixtures=readTemplate(root,"template[data-socials-match-context]"),registryPlayers=readTemplate(root,"template[data-socials-players]");
  if(!workspace||!fixtures.length)return {activate(){},deactivate(){},reset(){},getRequirementStatus(){return {matchData:false,matchStats:false,playerStats:false,playerPhoto:false}}};
  const playerSelects=[...workspace.querySelectorAll("[data-top-three-player-slot]")],outputInputs=[...root.querySelectorAll('[name="social-output"]')],preview=workspace.querySelector("[data-top-three-preview]"),status=workspace.querySelector("[data-top-three-status]"),photoStatus=workspace.querySelector("[data-top-three-photo-status]");
  let providerPlayers=[],selections=["","",""];
  const fixtureForSelection=()=>fixtures.find(fixture=>fixture.fixture_key===sharedState.selectedFixtureKey)??fixtures[0];
  const selectedPlayers=()=>selections.map(key=>providerPlayers.find(player=>providerKey(player)===key)??null);
  const replaceOptions=()=>playerSelects.forEach((select,index)=>{const current=selections[index];select.replaceChildren(new Option("Kies speler",""),...playerOptionsFor(providerPlayers,selections,index).map(item=>{const option=new Option(item.name,item.key);option.disabled=item.disabled;return option}));select.value=providerPlayers.some(player=>providerKey(player)===current)?current:"";select.disabled=!providerPlayers.length});
  const syncPlayers=()=>{const payload=sharedState.getMatchStats?.(fixtureForSelection().fixture_key),next=Array.isArray(payload?.players)?payload.players.filter(player=>player&&player.name):[];const changed=next.length!==providerPlayers.length||next.some((player,index)=>providerKey(player)!==providerKey(providerPlayers[index]));providerPlayers=next;if(changed){selections=selections.map(key=>providerPlayers.some(player=>providerKey(player)===key)?key:"");replaceOptions()}return Boolean(payload)};
  const renderPlayer=(slot,player)=>{
    const registry=registryPhotoFor(player,registryPlayers),photo=slot.querySelector("[data-top-three-photo]"),placeholder=slot.querySelector("[data-top-three-placeholder]"),rating=slot.querySelector("[data-top-three-rating]");
    slot.dataset.selected=String(Boolean(player));slot.querySelector("[data-top-three-name]").textContent=registry?.name??player?.name??"KIES EEN SPELER";
    if(registry?.imageUrl){photo.src=registry.imageUrl;photo.alt=`Foto van ${registry.name}`;photo.hidden=false;placeholder.hidden=true}else{photo.removeAttribute("src");photo.alt="";photo.hidden=true;placeholder.hidden=false;placeholder.textContent=player?"Eigen foto ontbreekt":"Kies een speler"}
    rating.hidden=!hasValue(player?.rating);if(hasValue(player?.rating))rating.querySelector("strong").textContent=displayStatValue(player,"rating");
    const stats=interestingStatsFor(player);[...slot.querySelectorAll("[data-top-three-stat]")].forEach((node,index)=>{const stat=stats[index];node.hidden=!stat;if(stat){node.querySelector("strong").textContent=displayStatValue(player,stat.id);node.querySelector("span").textContent=stat.label}});
    return {player,registry};
  };
  const render=()=>{
    const hasPayload=syncPlayers(),chosen=selectedPlayers(),count=chosen.filter(Boolean).length,context=fixtureForSelection();replaceOptions();
    preview.dataset.pngContext=`${context.competition} · ${context.home_team} ${context.goals_home??'–'}–${context.goals_away??'–'} ${context.away_team}`;
    status.textContent=count===3?"Compleet":`${count} van 3 spelers gekozen`;
    status.hidden=count===3;
    const rendered=[...workspace.querySelectorAll("[data-top-three-preview-player]")].map((slot,index)=>renderPlayer(slot,chosen[index]));
    const missing=rendered.filter(item=>item.player&&!item.registry?.imageUrl).map(item=>item.player.name);
    photoStatus.textContent=!hasPayload?"Haal eerst de wedstrijdstats op.":missing.length?`Eigen foto ontbreekt voor ${missing.join(", ")}.`:count?`Eigen AjaxPro-foto's beschikbaar voor ${count} ${count===1?"speler":"spelers"}.`:"Kies spelers om hun AjaxPro-foto's te controleren.";
    photoStatus.dataset.state=missing.length?"missing":count?"available":"idle";
    photoStatus.hidden=count>0&&!missing.length;
    workspace.querySelector("[data-top-three-match]").textContent=`${context.competition} · ${formatDate(context.kickoff_at)} · ${context.home_team} ${context.goals_home??"–"}–${context.goals_away??"–"} ${context.away_team}`.toLocaleUpperCase("nl-NL");
    const output=outputInputs.find(input=>input.checked)??outputInputs[0];if(output){preview.dataset.aspect=output.value;workspace.querySelector("[data-top-three-preview-ratio]").textContent=output.value==="vertical-9x16"?"9:16":"4:5";workspace.querySelector("[data-top-three-dimensions]").textContent=`${output.dataset.width} × ${output.dataset.height}`}
    root.dispatchEvent(new CustomEvent("socials:format-status-change",{detail:{formatId:"top-three"}}));
  };
  playerSelects.forEach((select,index)=>select.addEventListener("change",()=>{selections[index]=select.value;render()}));
  root.addEventListener("socials:match-selection",()=>{providerPlayers=[];selections=["","",""];replaceOptions();render()});
  root.addEventListener("socials:match-stats",event=>{if(event.detail?.fixtureKey===fixtureForSelection().fixture_key)render()});
  outputInputs.forEach(input=>input.addEventListener("change",render));
  render();
  return {activate:render,deactivate(){},reset(){selections=["","",""];render()},getRequirementStatus(){const payload=sharedState.getMatchStats?.(fixtureForSelection().fixture_key),chosen=selectedPlayers(),selected=chosen.filter(Boolean);return {matchData:Boolean(fixtureForSelection()),matchStats:Boolean(payload),playerStats:Boolean(providerPlayers.length),playerPhoto:Boolean(selected.length)&&selected.every(player=>Boolean(registryPhotoFor(player,registryPlayers)?.imageUrl))}}};
};

export const topThreeFormat={id:"top-three",label:"Top 3 spelers",requirements:["matchData","matchStats","playerStats","playerPhoto"],init:initTopThree};
