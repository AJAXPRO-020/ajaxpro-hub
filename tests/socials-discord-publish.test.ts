import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Socials-publicatie gebruikt de bestaande staffroute en centrale publisher", () => {
  const route = readFileSync(new URL("../api/club-tools.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../api-impl/socials/index.ts", import.meta.url), "utf8");
  const png = readFileSync(new URL("../socials/png.mjs", import.meta.url), "utf8");
  const video = readFileSync(new URL("../socials/formats/video.mjs", import.meta.url), "utf8");
  assert.match(route, /view==="socials-publish"/);
  assert.match(route, /getSessionWithPermission\(request,permissions\.toolsSocials\)/);
  assert.match(route, /publishDiscord/);
  assert.match(page, /Plaats in Discord/);
  assert.match(png, /socials:publish-request/);
  assert.match(video, /socials:publish-request/);
});
