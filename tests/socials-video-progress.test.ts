import assert from "node:assert/strict";
import test from "node:test";
import {progressLabel} from "../socials/video-progress.mjs";

test("video status labels follow actual render phases",()=>{
 assert.equal(progressLabel("queued"),"In wachtrij");
 assert.equal(progressLabel("fetching"),"Bestanden voorbereiden");
 assert.equal(progressLabel("fetching","preprocessing"),"Bestanden voorbereiden");
 assert.equal(progressLabel("rendering"),"Video renderen");
 assert.equal(progressLabel("rendering","saving"),"Video opslaan");
 assert.equal(progressLabel("done"),"Video klaar");
 assert.equal(progressLabel("uncertain"),"Status onbekend");
});
