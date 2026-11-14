const readFixtures=root=>{
  const template=root.querySelector("template[data-socials-match-context]");
  if(!template)return [];
  try{const parsed=JSON.parse(template.content.textContent||"[]");return Array.isArray(parsed)?parsed:[]}catch{return []}
};

const ajaxIsHome=fixture=>String(fixture.home_team).toLocaleLowerCase("nl-NL").includes("ajax");
const validScore=value=>value!==null&&value!==undefined&&value!==""&&Number.isInteger(Number(value))&&Number(value)>=0?Number(value):null;
export const resolvedScore=(fixture,payload)=>({
  home:validScore(fixture?.goals_home)??validScore(payload?.match?.homeScore),
  away:validScore(fixture?.goals_away)??validScore(payload?.match?.awayScore),
});
const contextFor=(fixture,payload)=>{
  const home=ajaxIsHome(fixture),score=resolvedScore(fixture,payload);
  return {
    ajaxIsHome:home,
    homeTeam:fixture.home_team,
    awayTeam:fixture.away_team,
    homeScore:score.home,
    awayScore:score.away,
    competition:fixture.competition,
    kickoff:fixture.kickoff_at,
  };
};
const formatDate=value=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Amsterdam"}).format(new Date(value));
const displayValue=input=>{
  if(!input||input.value.trim()===""||!input.validity.valid)return "—";
  if(["xg","xgot"].includes(input.dataset.statId))return Number(input.value).toFixed(2).replace(".",",");
  const suffix=input.dataset.statId==="possession"?"%":"";
  return `${input.value.replace(".",",")}${suffix}`;
};
const loadedTeamFields={xg:"xg",xgot:"xgot",possession:"possession",shots:"shots",shotsOnTarget:"shotsOnTarget",bigChances:"bigChances",corners:"corners"};

const statPriority={xg:100,bigChances:94,shotsOnTarget:90,possession:86,xgot:82,corners:70,shots:62};
const hasValue=value=>value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value));
const comparable=(payload,id)=>hasValue(payload?.teamStats?.[id])&&hasValue(payload?.opponentTeamStats?.[id]);
const differenceBonus=(payload,id)=>{
  const ajax=Number(payload.teamStats[id]),opponent=Number(payload.opponentTeamStats[id]),scale=Math.max(Math.abs(ajax),Math.abs(opponent),1);
  return Math.min(10,Math.round((Math.abs(ajax-opponent)/scale)*10));
};
export const automaticStatSelection=payload=>Object.keys(statPriority)
  .filter(id=>comparable(payload,id))
  .sort((a,b)=>(statPriority[b]+differenceBonus(payload,b))-(statPriority[a]+differenceBonus(payload,a)))
  .slice(0,4);

export const loadedStatsFor=payload=>Object.fromEntries(Object.entries(loadedTeamFields).map(([inputId,payloadId])=>[inputId,{
  ajax:payload?.teamStats?.[payloadId]??null,
  opponent:payload?.opponentTeamStats?.[payloadId]??null,
}]));

export const initStats=(root,sharedState)=>{
  const workspace=root.querySelector("[data-stats-workspace]");
  const fixtures=readFixtures(root);
  if(!workspace||!fixtures.length)return {activate(){},deactivate(){}};
  const inputs=[...workspace.querySelectorAll("[data-stat-id][data-team]")],statSelectors=[...workspace.querySelectorAll("[data-stats-selection]")],resetControl=workspace.querySelector("[data-stats-reset]");
  const outputInputs=[...root.querySelectorAll('[name="social-output"]')];
  const preview=workspace.querySelector("[data-stats-preview]");
  const fixtureForSelection=()=>fixtures.find(fixture=>fixture.fixture_key===sharedState.selectedFixtureKey)??fixtures[0];
  let selectedStats=[],manualStats=false,loadedFixtureKey="";
  const inputFor=(id,team)=>inputs.find(input=>input.dataset.statId===id&&input.dataset.team===team);
  const displayForSide=(id,side,context)=>displayValue(inputFor(id,context.ajaxIsHome===(side==="home")?"ajax":"opponent"));
  const applyLoadedStats=(force=false)=>{
    const fixture=fixtureForSelection();
    const payload=sharedState.getMatchStats?.(fixture.fixture_key);
    if(!payload?.teamStats||!payload?.opponentTeamStats)return false;
    if(!force&&loadedFixtureKey===fixture.fixture_key)return true;
    Object.entries(loadedStatsFor(payload)).forEach(([inputId,values])=>{
      for(const team of ["ajax","opponent"]){
        const input=inputFor(inputId,team),value=values[team];
        if(input)input.value=value===null||value===undefined?"":String(value);
      }
    });
    loadedFixtureKey=fixture.fixture_key;
    if(!manualStats)selectedStats=automaticStatSelection(payload);
    return true;
  };
  const clearInputs=()=>inputs.forEach(input=>{input.value="";input.setCustomValidity("");input.removeAttribute("aria-invalid")});
  const render=()=>{
    const fixture=fixtureForSelection(),payload=sharedState.getMatchStats?.(fixture.fixture_key),context=contextFor(fixture,payload);
    preview.dataset.pngContext=`${context.competition} · ${context.homeTeam} ${context.homeScore??'–'}–${context.awayScore??'–'} ${context.awayTeam}`;
    preview.dataset.pngHome=context.homeTeam;preview.dataset.pngAway=context.awayTeam;preview.dataset.pngDate=context.kickoff;
    preview.dataset.ajaxSide=context.ajaxIsHome?"home":"away";
    workspace.querySelector('[data-preview-team="home"]').textContent=context.homeTeam;
    workspace.querySelector('[data-preview-team="away"]').textContent=context.awayTeam;
    workspace.querySelector('[data-preview-score="home"]').textContent=context.homeScore??"–";
    workspace.querySelector('[data-preview-score="away"]').textContent=context.awayScore??"–";
    workspace.querySelector("[data-preview-meta]").textContent=`${context.competition} · ${formatDate(context.kickoff)}`.toLocaleUpperCase("nl-NL");
    inputs.forEach(input=>{
      const hasValue=input.value.trim()!=="";
      input.setAttribute("aria-invalid",String(hasValue&&!input.validity.valid));
    });
    statSelectors.forEach((select,index)=>{
      const id=selectedStats[index]??"";
      select.value=id;
      const chosen=new Set(selectedStats.filter((_,slot)=>slot!==index));
      [...select.options].forEach(option=>{option.disabled=Boolean(option.value&&(chosen.has(option.value)||!hasValue(inputFor(option.value,"ajax")?.value)&&!hasValue(inputFor(option.value,"opponent")?.value)))});
    });
    workspace.querySelectorAll("[data-preview-slot]").forEach(slot=>{slot.hidden=true;slot.querySelectorAll("[data-match-stat-home],[data-match-stat-away]").forEach(value=>value.textContent="—")});
    selectedStats.forEach((id,index)=>{
      const home=workspace.querySelector(`[data-preview-slot="${index}"] [data-match-stat-home]`),away=workspace.querySelector(`[data-preview-slot="${index}"] [data-match-stat-away]`),label=workspace.querySelector(`[data-preview-slot="${index}"] [data-match-stat-label]`),field=inputFor(id,"ajax");
      const slot=workspace.querySelector(`[data-preview-slot="${index}"]`);
      if(slot)slot.hidden=false;
      if(label)label.textContent=field?.closest(".stats-field")?.querySelector(".stats-field-label")?.textContent??id;
      if(home)home.textContent=displayForSide(id,"home",context);
      if(away)away.textContent=displayForSide(id,"away",context);
    });
    const output=outputInputs.find(input=>input.checked)??outputInputs[0];
    if(output){preview.dataset.aspect=output.value;workspace.querySelector("[data-preview-ratio]").textContent=output.value==="vertical-9x16"?"9:16":"4:5";workspace.querySelector("[data-preview-dimensions]").textContent=`${output.dataset.width} × ${output.dataset.height}`}
  };
  inputs.forEach(input=>input.addEventListener("input",render));
  statSelectors.forEach(select=>select.addEventListener("change",()=>{manualStats=true;selectedStats=statSelectors.map(item=>item.value).filter(Boolean).slice(0,4);render()}));
  resetControl?.addEventListener("click",()=>{manualStats=false;const payload=sharedState.getMatchStats?.(fixtureForSelection().fixture_key);selectedStats=automaticStatSelection(payload);render()});
  outputInputs.forEach(input=>input.addEventListener("change",render));
  root.addEventListener("socials:match-selection",()=>{manualStats=false;selectedStats=[];loadedFixtureKey="";if(!applyLoadedStats(true))clearInputs();render()});
  root.addEventListener("socials:match-stats",event=>{if(event.detail?.fixtureKey===fixtureForSelection().fixture_key){applyLoadedStats();render()}});
  const reset=()=>{manualStats=false;selectedStats=[];loadedFixtureKey="";clearInputs();applyLoadedStats(true);render()};
  applyLoadedStats(true);
  render();
  return {activate:render,deactivate(){},reset,getRequirementStatus(){return {matchData:Boolean(fixtureForSelection()),matchStats:Boolean(sharedState.getMatchStats?.(fixtureForSelection().fixture_key))}}};
};

export const statsFormat={id:"stats",label:"Wedstrijd in cijfers",requirements:["matchData","matchStats"],init:initStats};
