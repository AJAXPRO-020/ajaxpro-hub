import assert from "node:assert/strict";
import test from "node:test";
import { validGitHubOidcClaims } from "../lib/github-oidc";
import { sendAnnouncement } from "../lib/motm-announcements";
import { announcementPlan } from "../lib/motm-announcement-plan";

const now=1_800_000_000;
const validClaims={
  iss:"https://token.actions.githubusercontent.com",
  aud:"ajaxpro-motm-announcement",
  repository:"AJAXPRO-020/ajaxpro-hub",
  ref:"refs/heads/main",
  workflow_ref:"AJAXPRO-020/ajaxpro-hub/.github/workflows/motm-announcement.yml@refs/heads/main",
  exp:now+300,
  nbf:now-30,
};

test("alleen de vaste GitHub-workflow op main krijgt toegang",()=>{
  assert.equal(validGitHubOidcClaims(validClaims,now),true);
  assert.equal(validGitHubOidcClaims({...validClaims,workflow_ref:"AJAXPRO-020/ajaxpro-hub/.github/workflows/motm-announcement-plan.yml@refs/heads/main"},now),true);
  assert.equal(validGitHubOidcClaims({...validClaims,repository:"aanvaller/repo"},now),false);
  assert.equal(validGitHubOidcClaims({...validClaims,repository:"ajaxpro020/ajaxpro-hub"},now),false);
  assert.equal(validGitHubOidcClaims({...validClaims,ref:"refs/heads/feature"},now),false);
  assert.equal(validGitHubOidcClaims({...validClaims,workflow_ref:"AJAXPRO-020/ajaxpro-hub/.github/workflows/other.yml@refs/heads/main"},now),false);
  assert.equal(validGitHubOidcClaims({...validClaims,exp:now-1},now),false);
});

const plannedMatch = { status:"draft", scheduled_open_at:"2026-10-06T21:00:00Z", scheduled_close_at:"2026-10-06T22:00:00Z" };

test("geen vijfminutencontroles op dagen zonder geplande MOTM-opening",()=>{
  assert.equal(announcementPlan(undefined,new Date("2026-10-06T08:00:00Z")).active,false);
  assert.equal(announcementPlan(plannedMatch,new Date("2026-10-05T08:00:00Z")).active,false);
  assert.equal(announcementPlan(plannedMatch,new Date("2026-10-06T08:00:00Z")).active,true);
  assert.equal(announcementPlan(plannedMatch,new Date("2026-10-06T20:59:00Z")).due,false);
  assert.equal(announcementPlan({...plannedMatch,status:"open"},new Date("2026-10-06T21:00:00Z")).due,true);
});

test("planning gebruikt de Nederlandse datum, ook in wintertijd",()=>{
  const summer = {...plannedMatch,scheduled_open_at:"2026-10-06T12:00:00Z",scheduled_close_at:"2026-10-06T14:00:00Z"};
  assert.equal(announcementPlan(summer,new Date("2026-10-05T22:30:00Z")).active,true);
  const winter = {...plannedMatch,scheduled_open_at:"2026-12-06T12:00:00Z",scheduled_close_at:"2026-12-06T14:00:00Z"};
  assert.equal(announcementPlan(winter,new Date("2026-12-05T22:30:00Z")).active,false);
  assert.equal(announcementPlan(winter,new Date("2026-12-05T23:30:00Z")).active,true);
});

test("gewijzigde planning en late wedstrijden volgen uitsluitend het MOTM-schema",()=>{
  const late = {status:"open",scheduled_open_at:"2026-10-06T23:00:00Z",scheduled_close_at:"2026-10-07T01:00:00Z"};
  assert.equal(announcementPlan(late,new Date("2026-10-06T23:30:00Z")).due,true);
  assert.equal(announcementPlan(late,new Date("2026-10-07T01:00:00Z")).active,false);
  const postponed={...late,status:"draft",scheduled_open_at:"2026-10-08T20:00:00Z",scheduled_close_at:"2026-10-08T21:00:00Z"};
  assert.equal(announcementPlan(postponed,new Date("2026-10-06T23:30:00Z")).active,false);
  assert.equal(announcementPlan({...late,status:"closed"},new Date("2026-10-06T23:30:00Z")).active,false);
});

test("Discord onderscheidt bekende fouten van onbekende ontvangst", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 400 });
    assert.deepEqual(await sendAnnouncement("https://example.invalid/test-webhook", "tekst", "https://ajaxpro.fans/stem/test"), { status: "failed", error: "Discord webhook mislukt (400)" });
    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.deepEqual(await sendAnnouncement("https://example.invalid/test-webhook", "tekst", "https://ajaxpro.fans/stem/test"), { status: "unknown", error: "Discord webhook mislukt (503)" });
    globalThis.fetch = async () => { throw new Error("timeout"); };
    assert.deepEqual(await sendAnnouncement("https://example.invalid/test-webhook", "tekst", "https://ajaxpro.fans/stem/test"), { status: "unknown", error: "timeout" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
