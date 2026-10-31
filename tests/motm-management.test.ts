import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mayRemovePlayer, nullableScore, parseRevision, safeAuditData, validDeleteConfirmation } from "../lib/motm-management";
import { permissions, rolesHavePermission } from "../lib/permissions.config";

const roles={owner:"1268471493046566987",admin:"1268471493046566986",moderator:"1268471493034246376",helper:"1271472085788786718",analyst:"1422264769863221319"};
process.env.MOTM_MANAGER_ROLE_IDS=[roles.owner,roles.admin,roles.moderator,roles.helper].join(",");
process.env.MOTM_DELETE_ROLE_IDS=[roles.owner,roles.admin].join(",");

test("rechtenmatrix houdt beheer en verwijderen centraal gescheiden",()=>{
  assert.equal(rolesHavePermission([roles.analyst],permissions.motmManage),false);
  for(const role of [roles.helper,roles.moderator,roles.admin,roles.owner])assert.equal(rolesHavePermission([role],permissions.motmManage),true);
  for(const role of [roles.helper,roles.moderator,roles.analyst])assert.equal(rolesHavePermission([role],permissions.motmDelete),false);
  for(const role of [roles.admin,roles.owner])assert.equal(rolesHavePermission([role],permissions.motmDelete),true);
  assert.equal(rolesHavePermission([roles.analyst,roles.helper],permissions.motmManage),true,"rollen zijn additief");
});

test("revision accepteert alleen positieve gehele versies",()=>{
  assert.equal(parseRevision("3"),3);for(const value of [null,"","0","1.5","x"])assert.equal(parseRevision(value),null);
});

test("scores mogen leeg zijn maar nooit negatief of niet-geheel",()=>{
  assert.equal(nullableScore(""),null);assert.equal(nullableScore("0"),0);assert.equal(nullableScore("12"),12);assert.equal(nullableScore("-1"),undefined);assert.equal(nullableScore("1.5"),undefined);
});

test("soft-delete vereist expliciete tekstbevestiging",()=>{
  assert.equal(validDeleteConfirmation("VERWIJDEREN","PSV"),true);assert.equal(validDeleteConfirmation("psv","PSV"),true);assert.equal(validDeleteConfirmation("Ajax","PSV"),false);
});

test("spelers verwijderen respecteert status, recht en bestaande stemmen",()=>{
  assert.equal(mayRemovePlayer("draft",0,false),true);assert.equal(mayRemovePlayer("open",0,false),false);assert.equal(mayRemovePlayer("closed",0,true),true);assert.equal(mayRemovePlayer("draft",1,true),false);assert.equal(mayRemovePlayer("open",3,true),false);
});

test("auditdata verwijdert stem- en secretvelden",()=>{
  assert.deepEqual(safeAuditData({opponent:"PSV",votes:[1],voterId:"x",sessionCookie:"x",token:"x"}),{opponent:"PSV"});
});

test("beheerbron gebruikt soft delete, revision locking, audit en kopieert geen stemmen",()=>{
  const source=readFileSync(new URL("../api-impl/motm/manage.ts",import.meta.url),"utf8");
  assert.match(source,/deleted_at=now\(\)/);assert.match(source,/revision=revision\+1/);assert.match(source,/AND revision=\$\{/);assert.match(source,/motm_audit_log/);assert.doesNotMatch(source,/INSERT INTO motm_votes/);assert.doesNotMatch(source,/DELETE FROM motm_votes/);
});

test("Discord-mededeling gebruikt webhook, allowed_mentions en eenmalige atomische claim",()=>{
  const source=readFileSync(new URL("../api-impl/motm/manage.ts",import.meta.url),"utf8");
  const announcements=readFileSync(new URL("../lib/motm-announcements.ts",import.meta.url),"utf8");
  const migration=readFileSync(new URL("../db/migrations/008_motm_announcements.sql",import.meta.url),"utf8");
  for(const value of ["DISCORD_MOTM_ANNOUNCEMENT_WEBHOOK","allowed_mentions: { parse: [\"everyone\"] }","announcement_sent_at","announcement_sent_by_discord_user_id","announcement_sent"])assert.ok(announcements.includes(value),value);
  assert.match(announcements,/announcement_status='sending'/);
  assert.match(announcements,/sendAnnouncement\(announcementWebhook\(\), text, link\)/);
  assert.match(migration,/announcement_sent_at/);assert.match(migration,/announcement_sent_by_discord_user_id/);
});

test("automatische mededeling hergebruikt dezelfde lock en schrijft een systeem-audit",()=>{
  const source=readFileSync(new URL("../lib/motm-announcements.ts",import.meta.url),"utf8");
  for(const value of ["system:auto-minute-80","Automatische mededeling","trigger: \"minute_80\"","status !== \"open\""])assert.ok(source.includes(value),value);
});

test("alle publieke hoofdqueries filteren verwijderde stemmingen",()=>{
  for(const file of ["../api/club.ts","../api-impl/motm/index.ts","../api-impl/motm/share.ts","../api-impl/motm/vote.ts","../lib/motm-scheduling.ts"]){const source=readFileSync(new URL(file,import.meta.url),"utf8");assert.match(source,/deleted_at IS NULL/,file);}
});

test("migratie is additive en bewaart stemmen",()=>{
  const sql=readFileSync(new URL("../db/migrations/003_motm_management.sql",import.meta.url),"utf8");
  for(const field of ["deleted_at","deleted_by_discord_user_id","delete_reason","revision","motm_audit_log"])assert.ok(sql.includes(field));assert.doesNotMatch(sql,/DROP|TRUNCATE|DELETE\s+FROM/i);
});
