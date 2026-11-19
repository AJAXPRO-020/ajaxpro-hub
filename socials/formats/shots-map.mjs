const AJAX_TEAM_ID=8593;
const valid=value=>typeof value==="number"&&Number.isFinite(value);
export const ajaxShots=payload=>{
  const raw=payload?.fotmobApi?.shots??payload?.fotmobApi?.raw?.content?.shotmap?.shots;
  if(!Array.isArray(raw))return [];
  return raw.filter(shot=>shot?.teamId===AJAX_TEAM_ID&&shot.isOwnGoal!==true&&valid(shot.x)&&valid(shot.y)&&shot.x>=0&&shot.x<=105&&shot.y>=0&&shot.y<=68);
};
export const shotFieldStart=shots=>shots.length?Math.min(75,Math.floor(Math.min(...shots.map(shot=>shot.x))-6)):65;
export const shotPosition=(shot,fieldStart=65)=>({left:Math.max(2,Math.min(98,shot.y/68*100)),top:Math.max(2,Math.min(98,(100-shot.x)/(100-fieldStart)*100))});
export const shotDiameter=shot=>valid(shot.expectedGoals)?Math.round(Math.min(17,7+Math.sqrt(Math.max(0,shot.expectedGoals))*12)):8;
export const onTargetCount=payload=>valid(payload?.teamStats?.shotsOnTarget)?payload.teamStats.shotsOnTarget:null;
export const initShotsMap=(root,sharedState)=>{
  const workspace=root.querySelector('[data-shots-map-workspace]');
  if(!workspace)return {activate(){},deactivate(){},reset(){},getRequirementStatus(){return {matchData:false,matchStats:false}}};
  const preview=workspace.querySelector('[data-shots-map-preview]'),dots=workspace.querySelector('[data-shots-map-dots]'),status=workspace.querySelector('[data-shots-map-status]');
  const fixtures=(()=>{try{return JSON.parse(root.querySelector('template[data-socials-match-context]')?.content.textContent||'[]')}catch{return []}})();
  const render=()=>{
    const fixture=fixtures.find(item=>item.fixture_key===sharedState.selectedFixtureKey)??fixtures[0],payload=fixture?sharedState.getMatchStats?.(fixture.fixture_key):null,shots=ajaxShots(payload);
    preview.dataset.pngDate=fixture?.kickoff_at??'';preview.dataset.pngHome=fixture?.home_team??'';preview.dataset.pngAway=fixture?.away_team??'';
    preview.dataset.pngContext=fixture?`${fixture.competition} · ${fixture.home_team} ${fixture.goals_home??'–'}–${fixture.goals_away??'–'} ${fixture.away_team}`:'';
    workspace.querySelector('[data-shots-map-match]').textContent=fixture?`${fixture.home_team} – ${fixture.away_team}`:'';
    const fieldStart=shotFieldStart(shots);
    preview.style.setProperty('--shots-box-depth',`${(100-83.5)/(100-fieldStart)*100}%`);
    dots.replaceChildren(...[...shots].sort((a,b)=>Number(a.eventType==='Goal')-Number(b.eventType==='Goal')||shotDiameter(b)-shotDiameter(a)).map(shot=>{const dot=document.createElement('span'),pos=shotPosition(shot,fieldStart),size=shotDiameter(shot);dot.className='shots-map-preview__shot'+(shot.eventType==='Goal'?' is-goal':'');dot.style.left=`${pos.left}%`;dot.style.top=`${pos.top}%`;dot.style.width=`${size}px`;dot.style.height=`${size}px`;dot.title=`${shot.playerName??'Ajax'} · ${shot.minute??'–'}′`;return dot}));
    const xg=shots.every(shot=>valid(shot.expectedGoals))?shots.reduce((sum,shot)=>sum+shot.expectedGoals,0):null;
    workspace.querySelector('[data-shots-map-count]').textContent=shots.length?String(shots.length):'—';
    const teamTarget=onTargetCount(payload);
    workspace.querySelector('[data-shots-map-target]').textContent=shots.length&&teamTarget!==null?String(teamTarget):'—';
    workspace.querySelector('[data-shots-map-xg]').textContent=xg===null?'—':xg.toFixed(2).replace('.',',');
    const teamShots=payload?.teamStats?.shots;
    status.textContent=!payload?'Haal eerst de wedstrijdstats op.':shots.length?valid(teamShots)&&teamShots!==shots.length?`${shots.length} schoten op de kaart; wedstrijdstatistiek: ${teamShots}.`:`${shots.length} Ajax-schoten beschikbaar.`:'Geen bruikbare Ajax-schoten beschikbaar voor deze wedstrijd.';
    const output=root.querySelector('[name="social-output"]:checked');preview.dataset.aspect=output?.value??'portrait-4x5';workspace.querySelector('[data-shots-map-ratio]').textContent=output?.value==='vertical-9x16'?'9:16':'4:5';
  };
  root.addEventListener('socials:match-stats',render);root.addEventListener('socials:match-selection',render);
  root.querySelectorAll('[name="social-output"]').forEach(input=>input.addEventListener('change',render));render();
  return {activate:render,deactivate(){},reset:render,getRequirementStatus(){const fixture=fixtures.find(item=>item.fixture_key===sharedState.selectedFixtureKey)??fixtures[0];return {matchData:Boolean(fixture),matchStats:ajaxShots(sharedState.getMatchStats?.(fixture?.fixture_key)).length>0}}};
};
export const shotsMapFormat={id:'shots-map',label:'Schotenkaart',requirements:['matchData','matchStats'],init:initShotsMap};
