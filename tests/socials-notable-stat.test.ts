import assert from 'node:assert/strict';
import {test} from 'node:test';
import {notableCandidates} from '../socials/formats/notable-stat.mjs';

const twente={home_team:'FC Twente',away_team:'Ajax',goals_home:2,goals_away:2};
const midtjylland={home_team:'FC Midtjylland',away_team:'Ajax',goals_home:1,goals_away:6};
const periods=(first:number,second:number)=>({raw:{content:{stats:{Periods:{FirstHalf:{stats:[{stats:[{key:'expected_goals',rawStats:[{value:1.07},{value:first}]}]}]},SecondHalf:{stats:[{stats:[{key:'expected_goals',rawStats:[{value:.08},{value:second}]}]}]}}}}}});

test('Twente: lage Ajax-xG, twee doelpunten en verschil tussen helften blijven feitelijk',()=>{
  const list=notableCandidates({teamStats:{xg:.69,shots:6,shotsOnTarget:2,bigChances:2},opponentTeamStats:{xg:3.08,shots:23,bigChances:2},players:[{name:'Oscar Gloukh',assists:2}],fotmobApi:periods(.64,.06)},twente);
  assert.equal(list[0].id,'low-xg-goals');
  assert.equal(list[0].value,'0,69 xG');
  assert.match(list[0].headline,/twee|2 keer uit 0,69 xG/);
  assert.ok(list.length>=2);
});

test('Midtjylland: zes goals uit 3,40 xG en aantoonbare kansen',()=>{
  const list=notableCandidates({teamStats:{xg:3.4,shots:24,shotsOnTarget:11,bigChances:8},opponentTeamStats:{xg:1.78,shots:10,bigChances:2},players:[{name:'Oscar Gloukh',xa:1.3,chancesCreated:5,assists:1,rating:8.1}],fotmobApi:periods(1.28,2.12)},midtjylland);
  assert.equal(list[0].id,'goals-above-xg');
  assert.equal(list[0].headline,'Ajax scoort 6 keer uit 3,40 xG');
  assert.ok(list.some(item=>item.id==='half-xg'));
  assert.ok(list.some(item=>item.id==='big-chances'));
  assert.ok(list.some(item=>item.id.startsWith('player-xa')));
});

test('Spelerinzicht behoudt het geselecteerde feit zonder aanvullende cijferstrook',()=>{
  const list=notableCandidates({teamStats:{},opponentTeamStats:{},players:[{name:'Sofyan Amrabat',recoveries:11,tackles:3,interceptions:null,duelsWon:7}]},{home_team:'Ajax',away_team:'Atalanta'});
  assert.equal(list[0].value,'11');
  assert.equal(list[0].headline,'Sofyan Amrabat verovert de bal 11 keer');
  assert.ok(!('support' in list[0]));
});

test('Ontbrekende waarden worden niet als nul gelezen',()=>{
  assert.deepEqual(notableCandidates({teamStats:{xg:null,bigChances:null},opponentTeamStats:{xg:3,bigChances:5},players:[]},twente),[]);
  assert.deepEqual(notableCandidates(null,twente),[]);
});
