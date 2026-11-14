const valid=value=>typeof value==='number'&&Number.isFinite(value);
const number=(value,digits=0)=>value.toFixed(digits).replace('.',',');
const ajaxIndex=fixture=>fixture?.home_team?.trim().toLowerCase()==='ajax'?0:1;
const periodStat=(payload,period,key,index)=>{
  const groups=payload?.fotmobApi?.raw?.content?.stats?.Periods?.[period]?.stats;
  if(!Array.isArray(groups))return null;
  for(const group of groups){
    for(const item of group?.stats??[]){
      if(item?.key!==key)continue;
      const value=item.rawStats?.[index]?.value;
      if(valid(value))return value;
    }
  }
  return null;
};
const candidate=(id,score,value,headline,detail)=>({id,score,value,headline,detail});

export const notableCandidates=(payload,fixture)=>{
  if(!payload)return [];
  const ajax=payload.teamStats??{},opponent=payload.opponentTeamStats??{},players=Array.isArray(payload.players)?payload.players:[],result=[];
  const add=(...args)=>result.push(candidate(...args));
  const ajaxGoals=fixture?.home_team?.trim().toLowerCase()==='ajax'?fixture?.goals_home:fixture?.goals_away;
  if(valid(ajaxGoals)&&valid(ajax.xg)&&ajaxGoals>=2&&ajaxGoals-ajax.xg>=1.25)
    add('goals-above-xg',94,`${ajaxGoals}`,`Ajax scoort ${ajaxGoals} keer uit ${number(ajax.xg,2)} xG`,'Doelpunten en xG in deze wedstrijd');
  if(valid(ajaxGoals)&&valid(ajax.xg)&&ajaxGoals>=2&&ajax.xg<=1&&ajaxGoals-ajax.xg>=1)
    add('low-xg-goals',96,`${number(ajax.xg,2)} xG`,`Ajax scoort ${ajaxGoals} keer uit ${number(ajax.xg,2)} xG`,'Doelpunten en xG in deze wedstrijd');
  if(valid(ajax.bigChances)&&valid(opponent.bigChances)&&ajax.bigChances>=4&&ajax.bigChances-opponent.bigChances>=3)
    add('big-chances',82+Math.min(6,ajax.bigChances-opponent.bigChances),`${ajax.bigChances}`,`Ajax creëert ${ajax.bigChances} grote kansen`,`Tegenstander: ${opponent.bigChances}`);
  if(valid(ajax.xg)&&valid(opponent.xg)&&ajax.xg>=2&&ajax.xg-opponent.xg>=1.5)
    add('xg-gap',79,`${number(ajax.xg,2)} xG`,`Ajax komt tot ${number(ajax.xg,2)} xG`,`Tegenstander: ${number(opponent.xg,2)} xG`);
  if(valid(ajax.shots)&&valid(opponent.shots)&&ajax.shots>=15&&ajax.shots-opponent.shots>=8)
    add('shots-gap',70,`${ajax.shots}`,`Ajax neemt ${ajax.shots} schoten`,`Tegenstander: ${opponent.shots}`);
  const index=ajaxIndex(fixture),firstXg=periodStat(payload,'FirstHalf','expected_goals',index),secondXg=periodStat(payload,'SecondHalf','expected_goals',index);
  if(valid(firstXg)&&valid(secondXg)&&Math.abs(secondXg-firstXg)>=.7){
    const after=secondXg>firstXg,higher=after?secondXg:firstXg,lower=after?firstXg:secondXg;
    add('half-xg',88,`${number(higher,2)} xG`,`Ajax creëert ${number(higher,2)} xG ${after?'na':'voor'} rust`,`${number(lower,2)} xG ${after?'voor':'na'} rust`);
  }
  for(const player of players){
    if(!player?.name)continue;
    if(valid(player.chancesCreated)&&player.chancesCreated>=5)
      add(`player-chances-${player.fotmobId??player.name}`,76,`${player.chancesCreated}`,`${player.name} creëert ${player.chancesCreated} kansen`,'Gecreëerde kansen in deze wedstrijd');
    if(valid(player.xa)&&player.xa>=.8)
      add(`player-xa-${player.fotmobId??player.name}`,74,`${number(player.xa,2)} xA`,`${player.name} komt tot ${number(player.xa,2)} xA`,'Verwachte assists in deze wedstrijd');
    if(valid(player.recoveries)&&player.recoveries>=10)
      add(`player-recoveries-${player.fotmobId??player.name}`,68,`${player.recoveries}`,`${player.name} verovert de bal ${player.recoveries} keer`,'Balheroveringen in deze wedstrijd');
  }
  return result.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
};

const fixturesFor=root=>{try{return JSON.parse(root.querySelector('template[data-socials-match-context]')?.content.textContent||'[]')}catch{return []}};
export const initNotableStat=(root,sharedState)=>{
  const workspace=root.querySelector('[data-notable-stat-workspace]');
  if(!workspace)return {activate(){},deactivate(){},reset(){},getRequirementStatus(){return {matchData:false,matchStats:false}}};
  const fixtures=fixturesFor(root),select=workspace.querySelector('[data-notable-select]'),valueInput=workspace.querySelector('[data-notable-value-input]'),headlineInput=workspace.querySelector('[data-notable-headline-input]'),detailInput=workspace.querySelector('[data-notable-detail-input]'),reset=workspace.querySelector('[data-notable-reset]'),preview=workspace.querySelector('[data-notable-preview]'),status=workspace.querySelector('[data-notable-status]');
  const stateByFixture=new Map();
  const fixture=()=>fixtures.find(item=>item.fixture_key===sharedState.selectedFixtureKey)??fixtures[0]??null;
  const stateFor=key=>{if(!stateByFixture.has(key))stateByFixture.set(key,{selectedId:'',manual:false,value:'',headline:'',detail:''});return stateByFixture.get(key)};
  const syncPreview=(current,match)=>{
    preview.dataset.pngDate=match?.kickoff_at??'';preview.dataset.pngHome=match?.home_team??'';preview.dataset.pngAway=match?.away_team??'';
    preview.dataset.pngContext=match?`${match.competition} · ${match.home_team} ${match.goals_home??'–'}–${match.goals_away??'–'} ${match.away_team}`:'';
    preview.dataset.notableValue=current.value.trim();preview.dataset.notableHeadline=current.headline.trim();preview.dataset.notableDetail=current.detail.trim();
  };
  const render=()=>{
    const match=fixture(),payload=match?sharedState.getMatchStats?.(match.fixture_key):null,candidates=notableCandidates(payload,match),current=stateFor(match?.fixture_key??'');
    if(!current.manual){const proposal=candidates[0];current.selectedId=proposal?.id??'';current.value=proposal?.value??'';current.headline=proposal?.headline??'';current.detail=proposal?.detail??'';}
    select.replaceChildren(new Option('Kies een inzicht',''),...candidates.map(item=>new Option(item.headline,item.id)));
    select.value=current.selectedId;select.disabled=!candidates.length;
    valueInput.value=current.value;headlineInput.value=current.headline;detailInput.value=current.detail;
    const usable=Boolean(current.value.trim()&&current.headline.trim());
    valueInput.disabled=headlineInput.disabled=detailInput.disabled=!candidates.length;
    reset.disabled=!candidates.length||!current.manual;
    status.textContent=!payload?'Haal eerst de wedstrijdstats op.':!candidates.length?'Geen geschikt inzicht beschikbaar voor deze wedstrijd.':`${candidates.length} inzichten beschikbaar.`;
    status.hidden=Boolean(candidates.length);
    preview.hidden=!usable;workspace.querySelector('[data-notable-empty]').hidden=usable;
    syncPreview(current,match);
    const output=root.querySelector('[name="social-output"]:checked');preview.dataset.aspect=output?.value??'portrait-4x5';workspace.querySelector('[data-notable-ratio]').textContent=output?.value==='vertical-9x16'?'9:16':'4:5';
    root.dispatchEvent(new CustomEvent('socials:format-status-change',{detail:{formatId:'notable-stat'}}));
  };
  select.addEventListener('change',()=>{const match=fixture(),current=stateFor(match?.fixture_key??''),proposal=notableCandidates(sharedState.getMatchStats?.(match?.fixture_key),match).find(item=>item.id===select.value);if(proposal){Object.assign(current,{selectedId:proposal.id,manual:true,value:proposal.value,headline:proposal.headline,detail:proposal.detail});render()}});
  for(const [input,field] of [[valueInput,'value'],[headlineInput,'headline'],[detailInput,'detail']])input.addEventListener('input',()=>{const current=stateFor(fixture()?.fixture_key??'');current[field]=input.value;current.manual=true;reset.disabled=false;syncPreview(current,fixture());preview.hidden=!(current.value.trim()&&current.headline.trim());workspace.querySelector('[data-notable-empty]').hidden=!preview.hidden});
  reset.addEventListener('click',()=>{stateByFixture.delete(fixture()?.fixture_key??'');render()});
  root.addEventListener('socials:match-stats',event=>{if(event.detail?.fixtureKey===fixture()?.fixture_key)render()});
  root.addEventListener('socials:match-selection',render);
  root.querySelectorAll('[name="social-output"]').forEach(input=>input.addEventListener('change',render));
  render();
  return {activate:render,deactivate(){},reset(){stateByFixture.delete(fixture()?.fixture_key??'');render()},getRequirementStatus(){const match=fixture();return {matchData:Boolean(match),matchStats:notableCandidates(sharedState.getMatchStats?.(match?.fixture_key),match).length>0}}};
};
export const notableStatFormat={id:'notable-stat',label:'Opvallend cijfer',requirements:['matchData','matchStats'],init:initNotableStat};
