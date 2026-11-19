import assert from 'node:assert/strict';
import test from 'node:test';
import {renderSocials} from '../api-impl/socials/index';
import type {Session} from '../lib/discord-auth';
import type {SocialMatchdayFixture} from '../lib/socials-match-context';

const session:Session={userId:'staff',username:'Redactie',avatarUrl:'/avatar.png',discordRoleIds:['staff'],issuedAt:1,expiresAt:2};
const fixture:SocialMatchdayFixture={fixture_key:'twente-ajax',home_team:'FC Twente',away_team:'Ajax',competition:'Eredivisie',kickoff_at:'2026-11-08T13:30:00Z',provider_status:'FT',goals_home:2,goals_away:2,finished_at:'2026-11-08T15:30:00Z'};

test('Schotenkaart is selecteerbaar en heeft een preview voor de bestaande PNG-flow',async()=>{
  const html=await renderSocials(session,async()=>[fixture]).then(response=>response.text());
  assert.match(html,/data-format-id="shots-map"/);
  assert.match(html,/data-shots-map-preview/);
  assert.match(html,/data-shots-map-dots/);
});

test('Ajax-schoten volgen team-ID, sluiten eigen doelpunten uit en behouden xG als schaal',async()=>{
  // @ts-expect-error Browservriendelijke pure module.
  const {ajaxShots,shotPosition,shotDiameter,shotFieldStart,onTargetCount}=await import('../socials/formats/shots-map.mjs');
  const raw=[{teamId:8593,x:98,y:40,expectedGoals:.05,eventType:'Miss',isOwnGoal:false},{teamId:8593,x:101.5,y:34,expectedGoals:.6,eventType:'Goal',isOwnGoal:false},{teamId:8593,x:3,y:40,isOwnGoal:true},{teamId:8611,x:90,y:50,expectedGoals:.2}];
  const shots=ajaxShots({fotmobApi:{raw:{content:{shotmap:{shots:raw}}}}});
  assert.equal(shots.length,2);
  assert.ok(shotDiameter(shots[1])>shotDiameter(shots[0]));
  assert.ok(shotDiameter({expectedGoals:.8})<=17);
  assert.ok(shotDiameter({expectedGoals:.009})>=8);
  assert.equal(shotFieldStart(shots),75);
  assert.equal(onTargetCount({teamStats:{shotsOnTarget:2}}),2);
  assert.equal(onTargetCount({teamStats:{shotsOnTarget:null}}),null);
  assert.deepEqual(shotPosition(shots[1]),{left:50,top:2});
  assert.equal(ajaxShots({fotmobApi:{shots:raw}}).length,2);
});
