import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clubRoleLabel, verifiedClubStatus } from "../lib/club-profile";

const roles={owner:"1268471493046566987",admin:"1268471493046566986",moderator:"1268471493034246376",helper:"1271472085788786718",analyst:"1422264769863221319"};

test("AjaxPro Verified toont de herkenbare Discord-rol",()=>{
  for(const [role,label] of [[roles.owner,"Owner"],[roles.admin,"Admin"],[roles.moderator,"Moderator"],[roles.helper,"Helper"],[roles.analyst,"Analist"]])assert.equal(clubRoleLabel([role]),label);
  assert.equal(clubRoleLabel([]),"Lid");
  assert.match(verifiedClubStatus({discordRoleIds:[roles.helper]}),/AjaxPro Verified[\s\S]*Geverifieerd via Discord · Helper/);
});

test("Club-pagina's herhalen AjaxPro Club niet en noemen nergens gratis tools",()=>{
  const source=["../api-impl/club.ts","../api/club-tools.ts","../api-impl/motm/stand.ts","../lib/motm-view.ts","../lib/portal-tools.config.ts"].map(path=>readFileSync(new URL(path,import.meta.url),"utf8")).join("\n");
  assert.doesNotMatch(source,/AjaxPro Club/i);
  assert.doesNotMatch(source,/gratis\s+tools?/i);
});
