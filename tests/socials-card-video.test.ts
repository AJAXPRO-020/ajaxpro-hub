import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {cardVideoArgs,isVerticalCardPng} from '../lib/socials-card-video';

test('kaartvideo accepteert uitsluitend 1080 × 1920 PNG-kaarten',()=>{
  const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(1080,16);png.writeUInt32BE(1920,20);
  assert.equal(isVerticalCardPng(png),true);
  png.writeUInt32BE(1350,20);assert.equal(isVerticalCardPng(png),false);
  assert.equal(isVerticalCardPng(Buffer.alloc(24)),false);
});

test('renderprofiel gebruikt drie kaarten, een vaste eindkaart en H.264 MP4',()=>{
  const args=cardVideoArgs('/tmp/cards'),filter=args[args.indexOf('-filter_complex')+1];
  assert.match(filter,/xfade=transition=custom:duration=0\.4:offset=3\.6/);
  assert.match(filter,/xfade=transition=custom:duration=0\.4:offset=7\.2/);
  assert.match(filter,/P\*P\*\(3-2\*P\)/);
  assert.match(filter,/\[cards\]\[end\]xfade=transition=fade:duration=0\.4:offset=10\.8\[out\]/);
  assert.equal(args.filter((value,index)=>args[index-1]==='-framerate'&&value==='1').length,4);
  assert.equal((filter.match(/fps=30,trim=duration=4,setpts=PTS-STARTPTS/g)??[]).length,3);
  assert.deepEqual(args.filter(value=>value.endsWith('.png')).length,4);
  assert.equal(isVerticalCardPng(readFileSync('assets/social-video/card-video-end.png')),true);
  assert.ok(args.includes('libx264'));
  assert.ok(args.includes('yuv420p'));
  assert.ok(args.includes('+faststart'));
});
