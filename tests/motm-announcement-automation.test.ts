import assert from "node:assert/strict";
import test from "node:test";
import { validGitHubOidcClaims } from "../lib/github-oidc";
import { shouldTryAutomaticAnnouncement } from "../lib/motm-announcements";

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
  assert.equal(validGitHubOidcClaims({...validClaims,repository:"aanvaller/repo"},now),false);
  assert.equal(validGitHubOidcClaims({...validClaims,repository:"ajaxpro020/ajaxpro-hub"},now),false);
  assert.equal(validGitHubOidcClaims({...validClaims,ref:"refs/heads/feature"},now),false);
  assert.equal(validGitHubOidcClaims({...validClaims,workflow_ref:"AJAXPRO-020/ajaxpro-hub/.github/workflows/other.yml@refs/heads/main"},now),false);
  assert.equal(validGitHubOidcClaims({...validClaims,exp:now-1},now),false);
});

test("de automatische mededeling wordt pas in de tweede helft vanaf minuut 80 geprobeerd",()=>{
  assert.equal(shouldTryAutomaticAnnouncement({elapsed:79,provider_status:"2H"}),false);
  assert.equal(shouldTryAutomaticAnnouncement({elapsed:80,provider_status:"2H"}),true);
  assert.equal(shouldTryAutomaticAnnouncement({elapsed:85,provider_status:"HT"}),false);
  assert.equal(shouldTryAutomaticAnnouncement({elapsed:null,provider_status:"2H"}),false);
});
