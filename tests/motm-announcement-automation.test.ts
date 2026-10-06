import assert from "node:assert/strict";
import test from "node:test";
import { validGitHubOidcClaims } from "../lib/github-oidc";
import { shouldTryAutomaticAnnouncement } from "../lib/motm-announcements";
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

const plannedFixture = { kickoff_at:"2026-10-06T19:00:00Z", provider_status:"NS", finished_at:null };

test("geen vijfminutencontroles op dagen zonder wedstrijd",()=>{
  assert.equal(announcementPlan(undefined,new Date("2026-10-06T08:00:00Z")).active,false);
  assert.equal(announcementPlan(plannedFixture,new Date("2026-10-05T08:00:00Z")).active,false);
  assert.equal(announcementPlan(plannedFixture,new Date("2026-10-06T08:00:00Z")).active,true);
  assert.equal(announcementPlan(plannedFixture,new Date("2026-10-06T20:09:00Z")).due,false);
  assert.equal(announcementPlan(plannedFixture,new Date("2026-10-06T20:10:00Z")).due,true);
});

test("planning gebruikt de Nederlandse datum, ook in wintertijd",()=>{
  const summer = {...plannedFixture,kickoff_at:"2026-10-06T12:00:00Z"};
  assert.equal(announcementPlan(summer,new Date("2026-10-05T22:30:00Z")).active,true);
  const winter = {...plannedFixture,kickoff_at:"2026-12-06T12:00:00Z"};
  assert.equal(announcementPlan(winter,new Date("2026-12-05T22:30:00Z")).active,false);
  assert.equal(announcementPlan(winter,new Date("2026-12-05T23:30:00Z")).active,true);
});

test("verlenging over middernacht blijft actief; afgelopen en uitgestelde wedstrijden stoppen",()=>{
  const late = {...plannedFixture,kickoff_at:"2026-10-06T21:00:00Z",provider_status:"ET"};
  assert.equal(announcementPlan(late,new Date("2026-10-06T23:30:00Z")).due,true);
  assert.equal(announcementPlan(late,new Date("2026-10-07T03:00:00Z")).active,false);
  for (const provider_status of ["FT","AET","PEN","CANC","PST","SUSP"]) {
    assert.equal(announcementPlan({...late,provider_status},new Date("2026-10-06T23:30:00Z")).active,false);
  }
  assert.equal(announcementPlan({...late,finished_at:"2026-10-06T23:00:00Z"},new Date("2026-10-06T23:30:00Z")).active,false);
});

test("de automatische mededeling wordt pas in de tweede helft vanaf minuut 80 geprobeerd",()=>{
  assert.equal(shouldTryAutomaticAnnouncement({elapsed:79,provider_status:"2H"}),false);
  assert.equal(shouldTryAutomaticAnnouncement({elapsed:80,provider_status:"2H"}),true);
  assert.equal(shouldTryAutomaticAnnouncement({elapsed:85,provider_status:"HT"}),false);
  assert.equal(shouldTryAutomaticAnnouncement({elapsed:null,provider_status:"2H"}),false);
});
