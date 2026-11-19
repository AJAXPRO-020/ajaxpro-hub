import assert from 'node:assert/strict';
import test from 'node:test';
import { withSocialClubLogos, type SocialMatchdayFixture } from '../lib/socials-match-context';

test('shared Socials fixtures retain data and deduplicate logo resolution',async()=>{
  const calls:string[]=[];
  const fixtures=[{fixture_key:'one',home_team:'Ajax',away_team:'ADO Den Haag'},{fixture_key:'two',home_team:'Ajax',away_team:'Foreign club'}] as SocialMatchdayFixture[];
  const result=await withSocialClubLogos(fixtures,async name=>{calls.push(name);return name==='Foreign club'?null:`/assets/${name}.svg`});
  assert.equal(result[0].homeLogo,'/assets/Ajax.svg');
  assert.equal(result[0].awayLogo,'/assets/ADO Den Haag.svg');
  assert.equal(result[1].awayLogo,null);
  assert.equal(calls.filter(name=>name==='Ajax').length,1);
  assert.equal(result[0].fixture_key,'one');
  assert.equal(fixtures[0].homeLogo,undefined);
});

test('logo lookup failure preserves fixtures with null logo fallback',async()=>{
  const fixtures=[{fixture_key:'one',home_team:'Ajax',away_team:'Unknown'}] as SocialMatchdayFixture[];
  const result=await withSocialClubLogos(fixtures,async()=>{throw Error('offline')});
  assert.equal(result[0].homeLogo,null);
  assert.equal(result[0].awayLogo,null);
});

test('shared selected context follows match switches and keeps logo metadata',async()=>{
  const {selectedMatchContext}=await import('../socials/match-context.mjs');
  const fixtures=[{fixture_key:'one',homeLogo:'/ajax.png',awayLogo:'/ado.svg'},{fixture_key:'two',homeLogo:null,awayLogo:'/ajax.png'}];
  assert.equal(selectedMatchContext(fixtures,'two'),fixtures[1]);
  assert.equal(selectedMatchContext(fixtures,'one').awayLogo,'/ado.svg');
  assert.equal(selectedMatchContext([],undefined),null);
});
