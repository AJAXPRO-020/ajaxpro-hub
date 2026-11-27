const assert=require('node:assert/strict');
const {solveTopThree,createBattle,uniqueIds}=require('./battle-logic');

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
assert.throws(()=>uniqueIds(['a','a']),/Duplicate/);
assert.throws(()=>createBattle(['a','b']),/At least 3/);
console.log(JSON.stringify({simulations:10000,maxComparisons:max,averageComparisons:Number((total/10000).toFixed(2)),minDuels:39,maxDuels:max,undoResume:'pass',duplicateIds:'pass'}));
