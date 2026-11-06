import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
test("openbare deelroute en bestaande interne stemroute blijven beide bestaan",()=>{
  const routes=new Map(config.rewrites.map((route:{source:string;destination:string})=>[route.source,route.destination]));
  assert.equal(routes.get("/stem/:slug"),"/api/motm-public?action=share&slug=:slug");
  assert.equal(routes.get("/club/stemmen/:slug"),"/api/motm-public?action=vote&slug=:slug");
  assert.equal(routes.get("/club/stand"),"/api/motm-public?action=stand");
  assert.equal(routes.get("/api/motm"),"/api/motm-public?action=index");
  assert.equal(routes.get("/api/motm/vote"),"/api/motm-public?action=vote");
  assert.equal(routes.get("/api/motm/stand"),"/api/motm-public?action=stand");
  assert.equal(routes.get("/api/motm/share"),"/api/motm-public?action=share");
  assert.equal(routes.get("/api/motm/manage"),"/api/motm-manage");
  assert.equal(routes.get("/club/tools/socials"),"/api/club-tools?view=socials");
  for(const [source,destination] of routes)assert.doesNotMatch(`${source} ${destination}`,/transfer-talk/i);
});

test("Socials gebruikt de bestaande club-tools serverless function",()=>{
  assert.equal(config.rewrites.find((route:{source:string})=>route.source==="/club/tools/socials")?.destination,"/api/club-tools?view=socials");
  assert.equal(config.functions["api/socials.ts"],undefined);
});

test("Persconferenties hergebruikt de bestaande club-tools functie binnen Hobby-limiet",()=>{
  assert.equal(config.rewrites.find((route:{source:string})=>route.source==="/api/press-conferences")?.destination,"/api/club-tools?view=press-conferences");
  assert.equal(config.functions["api/press-conferences.ts"],undefined);
});

test("programma wordt dagelijks automatisch ververst via de bestaande match-API",()=>{
  assert.deepEqual(config.crons.find((cron:{path:string})=>cron.path==="/api/next-match?view=program"),{
    path:"/api/next-match?view=program",
    schedule:"0 5 * * *",
  });
});

test("MOTM-fallback gebruikt GitHub OIDC en geen extra Vercel-functie",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/motm-announcement.yml",import.meta.url),"utf8");
  assert.match(workflow,/cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/view=motm-announcement/);
  assert.equal(config.functions["api/motm-announcement.ts"],undefined);
});
