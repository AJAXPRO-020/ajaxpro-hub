const assert=require('node:assert/strict');
const {solveTopThree,createBattle,uniqueIds}=require('../assets/shirt-battle/battle-logic');

const ids=Array.from({length:40},(_,i)=>`shirt-${i}`);
let max=0,total=0;
for(let run=0;run<10000;run++){
  const order=ids.map((id,i)=>({id,rank:(i*37+run*13)%40})).sort((a,b)=>a.rank-b.rank);
  const rank=new Map(order.map((x,i)=>[x.id,40-i]));
  const result=solveTopThree(ids,(a,b)=>rank.get(a)-rank.get(b));
  assert.deepEqual(result.top3,order.slice(0,3).map(x=>x.id));
  max=Math.max(max,result.comparisons); total+=result.comparisons;
}
assert.ok(max<=54);

const battle=createBattle(ids,{seed:42,maxDuels:50});
const first=battle.nextDuel();battle.choose(first.left);const snap=battle.state;
assert.equal(battle.progress().completed,1);
battle.choose(battle.nextDuel().left);battle.undo();assert.equal(battle.progress().completed,1);
const resumed=createBattle(ids,{seed:1,maxDuels:50});resumed.resume(snap);assert.equal(resumed.state.cursor,1);assert.deepEqual(resumed.state.order,snap.order);

// The production state machine must preserve a participant through odd rounds.
// This is deliberately exercised with every catalog ID, not only a comparator solver.
const catalog=JSON.parse(require('fs').readFileSync('./assets/ajax-shirts/shirts.json','utf8')).shirtBattleCollection.uniqueVariantIds;
for(const target of catalog){
  for(const seed of [1,2,3,17,99]){
    const fixed=createBattle(catalog,{seed,maxDuels:52});
    while(fixed.nextDuel()){
      const duel=fixed.nextDuel();
      fixed.choose(duel.left===target||duel.right===target?target:duel.left);
    }
    assert.equal(fixed.state.champion,target,`always-selected shirt lost: ${target}/${seed}`);
  }
}

// A complete deterministic preference order must produce the same exact top three.
const preference=catalog.slice().sort();
const rank=new Map(preference.map((id,index)=>[id,catalog.length-index]));
for(let seed=1;seed<=100;seed++){
  const ranked=createBattle(catalog,{seed,maxDuels:52});
  while(ranked.nextDuel()){
    const duel=ranked.nextDuel();
    ranked.choose(rank.get(duel.left)>rank.get(duel.right)?duel.left:duel.right);
  }
  assert.deepEqual([ranked.state.champion,ranked.state.second,ranked.state.third],preference.slice(0,3));
}

// Resume and undo at the first bye-bearing round (after 30 initial duels).
const byeBattle=createBattle(catalog,{seed:42,maxDuels:52});
while(byeBattle.state.duels.length<30)byeBattle.choose(byeBattle.nextDuel().left);
const byeSnapshot=byeBattle.state;
const resumedBye=createBattle(catalog,{maxDuels:52});
resumedBye.resume(byeSnapshot);
assert.deepEqual(resumedBye.state,byeSnapshot);
resumedBye.choose(resumedBye.nextDuel().left);
resumedBye.undo();
assert.deepEqual(resumedBye.state,byeSnapshot);
assert.throws(()=>uniqueIds(['a','a']),/Duplicate/);
assert.throws(()=>createBattle(['a','b']),/At least 3/);
console.log(JSON.stringify({simulations:10000,maxComparisons:max,averageComparisons:Number((total/10000).toFixed(2)),minDuels:39,maxDuels:max,undoResume:'pass',duplicateIds:'pass'}));
