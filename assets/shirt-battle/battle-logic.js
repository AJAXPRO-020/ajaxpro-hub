/* AjaxPro Shirt Battle: comparison logic independent from the UI. */
function uniqueIds(ids){
  const clean=[...ids];
  if(clean.some(id=>id==null||id==='')) throw new Error('Shirt IDs must be non-empty');
  if(new Set(clean).size!==clean.length) throw new Error('Duplicate shirt ID');
  return clean;
}

function seededShuffle(values,seed=Date.now()){
  const out=[...values]; let state=(seed>>>0)||1;
  const random=()=>((state=(state*1664525+1013904223)>>>0)/4294967296);
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
  return out;
}

function solveTopThree(ids,compare){
  const values=uniqueIds(ids); if(values.length<3) throw new Error('At least 3 shirts are required');
  const log=[];
  const beat=(a,b)=>{const winner=compare(a.id,b.id)>0?a:b;const loser=winner===a?b:a;log.push({winner:winner.id,loser:loser.id});winner.beaten.push(loser);return winner};
  let round=values.map(id=>({id,beaten:[]}));
  while(round.length>1){const next=[];for(let i=0;i<round.length;i+=2)next.push(round[i+1]?beat(round[i],round[i+1]):round[i]);round=next}
  const first=round[0];
  const second=first.beaten.reduce((best,item)=>best?beat(best,item):item,null);
  const candidates=[...new Set(first.beaten.concat(second.beaten))].filter(x=>x!==second&&x!==first);
  const third=candidates.reduce((best,item)=>best?beat(best,item):item,null);
  return {top3:[first.id,second.id,third.id],comparisons:log.length,log};
}

function createBattle(ids,{seed=Date.now(),maxDuels=52,initialOrder=null}={}){
  const order=initialOrder?uniqueIds(initialOrder):seededShuffle(uniqueIds(ids),seed); if(order.length<3) throw new Error('At least 3 shirts are required');
  let state={order,duels:[],cursor:0,maxDuels,stage:'initial',nodes:{},queue:[],roundWinners:[]};
  const save=()=>JSON.parse(JSON.stringify(state));
  const rebuild=(choices,rebuildOrder=order)=>{const fresh=createBattle(rebuildOrder,{seed:1,maxDuels,initialOrder:rebuildOrder});for(const choice of choices)fresh.choose(choice.winner);return fresh};
  const pairQueue=list=>{state.queue=[];for(let i=0;i<list.length;i+=2)if(list[i+1])state.queue.push([list[i],list[i+1]])};
  const advance=()=>{
    if(state.queue.length)return;
    if(state.stage==='initial'){
      if(state.roundWinners.length>1){const winners=state.roundWinners;state.roundWinners=[];pairQueue(winners);return;}
      state.champion=state.roundWinners[0];state.nodes[state.champion].champion=true;state.stage='second';state.roundWinners=[];const losers=state.nodes[state.champion].beaten;pairQueue(losers);if(losers.length<=1)finishSecond(losers[0]);
    } else if(state.stage==='second'){
      if(state.roundWinners.length>1){const winners=state.roundWinners;state.roundWinners=[];pairQueue(winners);return;}
      const winner=state.roundWinners[0];state.roundWinners=[];finishSecond(winner);
    } else if(state.stage==='third'){
      if(state.roundWinners.length>1){const winners=state.roundWinners;state.roundWinners=[];pairQueue(winners);return;}
      state.stage='done';state.third=state.roundWinners[0]||null;
    }
  };
  const finishSecond=winner=>{state.second=winner;state.stage='third';const candidates=[...new Set([...(state.nodes[state.champion]?.beaten||[]),...(state.nodes[winner]?.beaten||[])])].filter(id=>id!==state.champion&&id!==winner);pairQueue(candidates);if(candidates.length<=1){state.lastWinner=candidates[0]||null;state.stage='done';}};
  const chooseInternal=winner=>{const duel=state.queue.shift(),loser=winner===duel[0]?duel[1]:duel[0];state.nodes[winner].beaten.push(loser);state.roundWinners.push(winner);state.duels.push({left:duel[0],right:duel[1],winner,loser});state.cursor=state.duels.length;advance();};
  order.forEach(id=>{state.nodes[id]={id,beaten:[]}});pairQueue(order);
  return {get state(){return save()},nextDuel(){const duel=state.queue[0];return duel?{left:duel[0],right:duel[1],number:state.cursor+1,total:state.maxDuels}:null},choose(winner){const duel=this.nextDuel();if(!duel)throw new Error('No duel available');if(winner!==duel.left&&winner!==duel.right)throw new Error('Winner is not in current duel');chooseInternal(winner);return save()},undo(){if(!state.duels.length)return save();state=rebuild(state.duels.slice(0,-1),state.order).state;return save()},resume(snapshot){if(!snapshot||!Array.isArray(snapshot.order)||!Array.isArray(snapshot.duels))throw new Error('Invalid battle snapshot');state=rebuild(snapshot.duels,snapshot.order).state;return save()},progress(){return {completed:state.duels.length,remaining:Math.max(0,state.maxDuels-state.duels.length),ratio:state.maxDuels?state.duels.length/state.maxDuels:0}},canContinue(){return state.stage!=='done'&&state.duels.length<state.maxDuels}};
}

if(typeof module!=='undefined'&&module.exports) module.exports={uniqueIds,seededShuffle,solveTopThree,createBattle};
if(typeof window!=='undefined') window.AjaxProBattle={uniqueIds,seededShuffle,solveTopThree,createBattle};
