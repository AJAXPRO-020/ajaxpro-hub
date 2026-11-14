import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderMotmPng, renderMotmSvg } from '../lib/automatic-discord-publications';

test('automatische MOTM-visual wordt server-side opgebouwd zonder Discord-verzending', async () => {
  const previous=globalThis.fetch;
  globalThis.fetch=async (input) => {
    const url=String(input);
    assert.match(url,/MOTM-4-Blank\.png|player\.png/);
    return new Response(url.includes('player.png')?new Uint8Array([1,2,3]):new Uint8Array([4,5,6]),{status:200});
  };
  try {
    const svg=await renderMotmSvg({matchTitle:'AJAX-PSV',firstName:'Davy',lastName:'KLAASSEN',shirtNumber:10,percentage:72,playerImageUrl:'https://ajaxpro.fans/assets/player.png'});
    assert.match(svg.toString('utf8'),/<svg[^>]+width="1350"/);
    assert.match(svg.toString('utf8'),/AJAX-PSV/);
    assert.match(svg.toString('utf8'),/data:image\/png;base64/);
    const png=await renderMotmPng({matchTitle:'AJAX-PSV',firstName:'Davy',lastName:'KLAASSEN',shirtNumber:10,percentage:72,playerImageUrl:'https://ajaxpro.fans/assets/player.png'});
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  } finally { globalThis.fetch=previous; }
});
