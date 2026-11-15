import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { espnXmltvCandidates } from '../lib/press-conference-espn';
import { mergeCandidates } from '../lib/press-conferences';

const fixtures=[{fixture_key:'ajax-psv',home_team:'Ajax',away_team:'PSV',kickoff_at:'2026-11-17T19:00:00Z'}];
const program=(title:string,start:string,channel='ESPN2.nl')=>`<programme start="${start} +0000" stop="20261117220000 +0000" channel="${channel}"><title lang="nl">${title}</title><desc>Live programma rondom de wedstrijd.</desc></programme>`;

test('ESPN XMLTV distinguishes press conferences from interviews and previews',()=>{
 const xml=`<tv>${program('Ajax - PSV Voorbeschouwing','20261116130000')}${program('Ajax - PSV Interviews','20261117210000')}${program('Ajax - PSV Persconferentie','20261116130000')}${program('Ajax - PSV Interviews + Persconferentie','20261117210000')}${program('ESPN Oranje Persconferentie','20261116130000')}</tv>`;
 const found=espnXmltvCandidates(xml,fixtures,new Date('2026-11-15T12:00:00Z'));
 assert.equal(found.length,2);
 assert.equal(found[0].kind,'preview');
 assert.equal(found[0].eventDate,'2026-11-16');
 assert.equal(found[1].kind,'review');
 assert.equal(found[1].eventDate,'2026-11-17');
 assert.equal(found[0].startsAt?.toISOString(),'2026-11-16T13:00:00.000Z');
 assert.ok(found[0].watchLinks['ESPN 2 · programmagids']);
 const merged=mergeCandidates([found[0],{...found[0],sourceUrl:'https://www.ajax.nl/artikelen/ajax-psv-persco/',watchLinks:{'Ajax.nl':'https://www.ajax.nl/artikelen/ajax-psv-persco/'},priority:2}]);
 assert.equal(merged.length,1);
 assert.match(merged[0].sourceUrl,/ajax.nl/);
 assert.ok(merged[0].watchLinks['ESPN 2 · programmagids']);
});

test('ESPN XMLTV ignores elapsed, distant and unrelated broadcasts',()=>{
 const xml=`<tv>${program('Ajax - PSV Persconferentie','20261114130000')}${program('Ajax - PSV Persconferentie','20261125130000')}${program('Feyenoord - PSV Persconferentie','20261116130000')}${program('Ajax - PSV Persconferentie','20261116130000','ESPNPremium.nl')}</tv>`;
 assert.deepEqual(espnXmltvCandidates(xml,fixtures,new Date('2026-11-15T12:00:00Z')),[]);
});
