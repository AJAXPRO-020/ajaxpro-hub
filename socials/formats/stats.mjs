const readFixtures=root=>{
  const template=root.querySelector("template[data-socials-match-context]");
  if(!template)return [];
  try{const parsed=JSON.parse(template.content.textContent||"[]");return Array.isArray(parsed)?parsed:[]}catch{return []}
};

const ajaxIsHome=fixture=>String(fixture.home_team).toLocaleLowerCase("nl-NL").includes("ajax");
const contextFor=fixture=>{
  const home=ajaxIsHome(fixture);
  return {
    ajaxIsHome:home,
    homeTeam:fixture.home_team,
    awayTeam:fixture.away_team,
    homeScore:fixture.goals_home,
    awayScore:fixture.goals_away,
    competition:fixture.competition,
    kickoff:fixture.kickoff_at,
  };
};
const formatDate=value=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Amsterdam"}).format(new Date(value));
const displayValue=input=>{
  if(!input||input.value.trim()===""||!input.validity.valid)return "—";
  if(input.dataset.statId==="xg")return Number(input.value).toFixed(2).replace(".",",");
  const suffix=input.dataset.statId==="possession"?"%":"";
  return `${input.value.replace(".",",")}${suffix}`;
};
const loadedTeamFields={xg:"xg",possession:"possession",shots:"shots",shotsOnTarget:"shotsOnTarget",bigChances:"bigChances"};

export const loadedStatsFor=payload=>Object.fromEntries(Object.entries(loadedTeamFields).map(([inputId,payloadId])=>[inputId,{
  ajax:payload?.teamStats?.[payloadId]??null,
  opponent:payload?.opponentTeamStats?.[payloadId]??null,
}]));

export const initStats=(root,sharedState)=>{
  const workspace=root.querySelector("[data-stats-workspace]");
  const fixtures=readFixtures(root);
  if(!workspace||!fixtures.length)return {activate(){},deactivate(){}};
  const inputs=[...workspace.querySelectorAll("[data-stat-id][data-team]")];
  const outputInputs=[...root.querySelectorAll('[name="social-output"]')];
  const preview=workspace.querySelector("[data-stats-preview]");
  const fixtureForSelection=()=>fixtures.find(fixture=>fixture.fixture_key===sharedState.selectedFixtureKey)??fixtures[0];
  const inputFor=(id,team)=>inputs.find(input=>input.dataset.statId===id&&input.dataset.team===team);
  const displayForSide=(id,side,context)=>displayValue(inputFor(id,context.ajaxIsHome===(side==="home")?"ajax":"opponent"));
  const applyLoadedStats=()=>{
    const fixture=fixtureForSelection();
    const payload=sharedState.getMatchStats?.(fixture.fixture_key);
    if(!payload?.teamStats||!payload?.opponentTeamStats)return false;
    Object.entries(loadedStatsFor(payload)).forEach(([inputId,values])=>{
      for(const team of ["ajax","opponent"]){
        const input=inputFor(inputId,team),value=values[team];
        if(input)input.value=value===null||value===undefined?"":String(value);
      }
    });
    return true;
  };
  const clearInputs=()=>inputs.forEach(input=>{input.value="";input.setCustomValidity("");input.removeAttribute("aria-invalid")});
  const render=()=>{
    const context=contextFor(fixtureForSelection());
    preview.dataset.pngContext=`${context.competition} · ${context.homeTeam} ${context.homeScore??'–'}–${context.awayScore??'–'} ${context.awayTeam}`;
    preview.dataset.pngHome=context.homeTeam;preview.dataset.pngAway=context.awayTeam;
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
    Object.keys(loadedTeamFields).forEach(id=>{
      workspace.querySelector(`[data-match-stat="${id}-home"]`).textContent=displayForSide(id,"home",context);
      workspace.querySelector(`[data-match-stat="${id}-away"]`).textContent=displayForSide(id,"away",context);
    });
    const output=outputInputs.find(input=>input.checked)??outputInputs[0];
    if(output){preview.dataset.aspect=output.value;workspace.querySelector("[data-preview-ratio]").textContent=output.value==="vertical-9x16"?"9:16":"4:5";workspace.querySelector("[data-preview-dimensions]").textContent=`${output.dataset.width} × ${output.dataset.height}`}
  };
  inputs.forEach(input=>input.addEventListener("input",render));
  outputInputs.forEach(input=>input.addEventListener("change",render));
  root.addEventListener("socials:match-selection",()=>{if(!applyLoadedStats())clearInputs();render()});
  root.addEventListener("socials:match-stats",event=>{if(event.detail?.fixtureKey===fixtureForSelection().fixture_key){applyLoadedStats();render()}});
  const reset=()=>{clearInputs();applyLoadedStats();render()};
  applyLoadedStats();
  render();
  return {activate:render,deactivate(){},reset,getRequirementStatus(){return {matchData:Boolean(fixtureForSelection()),matchStats:Boolean(sharedState.getMatchStats?.(fixtureForSelection().fixture_key))}}};
};

export const statsFormat={id:"stats",label:"Wedstrijd in cijfers",requirements:["matchData","matchStats"],init:initStats};
