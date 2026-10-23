import { readFileSync, writeFileSync } from 'node:fs';
const base=JSON.parse(readFileSync('assets/social-video/template.json','utf8'));
const original=/const match = [\s\S]*?;\n  const metrics =/;
if(!original.test(base.js))throw new Error('Matchdata in videotemplate ontbreekt.');
const runtime=base.js.replace(original,"const match = JSON.parse(new URLSearchParams(location.search).get('data') || 'null');\n  const metrics =").replace("text('Ajaxpro.fans',72,1190,96,paper,'bold',936,'center')","text(match.followText,72,1190,96,paper,'bold',936,'center')");
writeFileSync('assets/social-video/storyboard-frame.js',runtime);
writeFileSync('assets/social-video/storyboard-frame.css',base.css);
writeFileSync('assets/social-video/storyboard-frame.html',`<!doctype html><html lang="nl"><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/social-video/storyboard-frame.css"></head><body>${base.html}<script src="/assets/social-video/storyboard-frame.js" defer></script></body></html>`);
