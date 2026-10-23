import assert from "node:assert/strict";
import test from "node:test";
import {progressLabel,elapsedLabel} from "../socials/video-progress.mjs";

test("video status labels follow actual render phases",()=>{
 assert.equal(progressLabel("queued"),"In wachtrij");
 assert.equal(progressLabel("fetching"),"Bestanden voorbereiden");
 assert.equal(progressLabel("rendering"),"Video renderen");
 assert.equal(progressLabel("rendering","saving"),"Video opslaan");
 assert.equal(progressLabel("done"),"Video klaar");
 assert.equal(progressLabel("uncertain"),"Status onbekend");
});

test("elapsed time is based on the persisted job start time",()=>{
 const start="2026-10-23T12:00:00.000Z";
 assert.equal(elapsedLabel(start,Date.parse(start)+84_000),"Bezig: 1 minuut en 24 seconden");
 assert.equal(elapsedLabel(start,Date.parse(start)+1_000),"Bezig: 1 seconde");
 assert.equal(elapsedLabel(start,Date.parse(start)-5_000),"Bezig: 0 seconden");
});
