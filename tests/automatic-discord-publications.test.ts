import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { renderMotmPng, renderMotmSvg } from '../lib/automatic-discord-publications';

test('automatische MOTM-visual wordt server-side opgebouwd zonder Discord-verzending', async () => {
  const previous=globalThis.fetch;
  globalThis.fetch=async (input) => {
    const url=String(input);
    const pathname=new URL(url).pathname;
    const file=pathname==='/assets/player.png'?'assets/players/motm/bounida_2627.png':pathname.slice(1);
    assert.match(file,/^assets\/(motm\/MOTM-4-Blank\.png|players\/motm\/bounida_2627\.png|fonts\/[a-z-]+\.(woff2|otf))$/);
    return new Response(await readFile(join(process.cwd(),file)),{status:200});
  };
  try {
    const svg=await renderMotmSvg({matchTitle:'AJAX-PSV',firstName:'Davy',lastName:'KLAASSEN',shirtNumber:10,percentage:72,playerImageUrl:'https://ajaxpro.fans/assets/player.png'});
    assert.match(svg.toString('utf8'),/<svg[^>]+width="1350"/);
    assert.match(svg.toString('utf8'),/AJAX-PSV/);
    assert.match(svg.toString('utf8'),/data:image\/png;base64/);
    const withoutNumber=await renderMotmSvg({matchTitle:'AJAX-FC THUN',firstName:'YVES',lastName:'BISSOUMA',shirtNumber:null,percentage:50,playerImageUrl:'https://ajaxpro.fans/assets/player.png'});
    assert.match(withoutNumber.toString('utf8'),/>50%<\/text>/);
    assert.match(withoutNumber.toString('utf8'),/fill="#101010"/);
    assert.doesNotMatch(withoutNumber.toString('utf8'),/fill="#fff"/);
    assert.doesNotMatch(withoutNumber.toString('utf8'),/#null/);
    assert.match(withoutNumber.toString('utf8'),/<image[^>]+x="610" y="30" width="1050" height="1050"/);
    const pixels=new Resvg(withoutNumber.toString('utf8')).render().pixels;
    const darkTextPixels=Array.from({length:75},(_,row)=>row+400).reduce((total,y)=>total+Array.from({length:650},(_,column)=>column+48).filter(x=>{const i=(y*1350+x)*4;return pixels[i]<70&&pixels[i+1]<70&&pixels[i+2]<70}).length,0);
    assert.ok(darkTextPixels>1000,'wedstrijdtekst moet zichtbaar donker op het lichte sjabloon staan');
    const png=await renderMotmPng({matchTitle:'AJAX-PSV',firstName:'Davy',lastName:'KLAASSEN',shirtNumber:10,percentage:72,playerImageUrl:'https://ajaxpro.fans/assets/player.png'});
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  } finally { globalThis.fetch=previous; }
});
