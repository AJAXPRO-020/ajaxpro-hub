import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createMotmVisualData,
  fitFontSize,
  MOTM_VISUAL_HEIGHT,
  MOTM_VISUAL_WIDTH,
  splitPlayerName,
} from "../lib/motm-visual";

const winner = {
  player_id: "brandt",
  name_snapshot: "Julian Brandt",
  image_url_snapshot: "/assets/players/motm/julian-brandt_2627.webp",
  votes: 8,
  percentage: 67,
};

test("gesloten stemming levert deterministische visualdata uit snapshots", () => {
  const input = { status:"closed", slug:"shelbourne-2026", opponent:"Shelbourne FC", homeOrAway:"home", shirtNumber:8, winner };
  const first = createMotmVisualData(input);
  const second = createMotmVisualData(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    matchTitle:"AJAX-SHELBOURNE FC",
    firstName:"JULIAN",
    lastName:"BRANDT",
    shirtNumber:8,
    percentage:67,
    playerId:"brandt",
    playerImageUrl:"/assets/players/motm/julian-brandt_2627.webp",
    filename:"ajaxpro-motm-shelbourne-2026-brandt.png",
  });
});

test("lange spelers- en wedstrijdnamen blijven schaalbaar binnen hun tekstvak", () => {
  assert.deepEqual(splitPlayerName("Don-Angelo Lange Samengestelde Achternaam"), {
    firstName:"Don-Angelo",
    lastName:"Lange Samengestelde Achternaam",
  });
  const size = fitFontSize("EEN ZEER LANGE WEDSTRIJDNAAM", 64, 38, 320, (fontSize, text) => fontSize * text.length * .55);
  assert.ok(size >= 38 && size < 64);
  assert.ok(size * "EEN ZEER LANGE WEDSTRIJDNAAM".length * .55 <= 320 || size === 38);
});

test("geen stemmen, open status of ontbrekend rugnummer leveren geen visual", () => {
  const base = { status:"closed", slug:"test", opponent:"Test FC", homeOrAway:"home", shirtNumber:8, winner };
  assert.equal(createMotmVisualData({...base,status:"open"}),null);
  assert.equal(createMotmVisualData({...base,winner:{...winner,votes:0,percentage:0}}),null);
  assert.equal(createMotmVisualData({...base,shirtNumber:null}),null);
});

test("Canvas-export gebruikt exact 1350 bij 1080 en wacht op fonts en afbeeldingen", () => {
  assert.equal(MOTM_VISUAL_WIDTH,1350);
  assert.equal(MOTM_VISUAL_HEIGHT,1080);
  const manage=readFileSync(new URL("../api-impl/motm/manage.ts",import.meta.url),"utf8");
  const script=readFileSync(new URL("../motm-admin.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../motm.css",import.meta.url),"utf8");
  assert.match(manage,/canvas width="\$\{MOTM_VISUAL_WIDTH\}" height="\$\{MOTM_VISUAL_HEIGHT\}"/);
  assert.match(script,/document\.fonts\.ready/);
  assert.match(script,/Promise\.all\(\[loadImage\(winnerVisual\.dataset\.templateUrl\),loadImage\(winnerVisual\.dataset\.playerImage\)\]\)/);
  assert.match(script,/canvas\.toBlob\(.+['"]image\/png['"]/s);
  assert.match(script,/winnerVisual\.querySelector\('\[data-download-visual\]'\)\|\|document\.querySelector\('\[data-download-visual\]'\)/);
  for(const font of ["refrigerator-deluxe-regular.otf","refrigerator-deluxe-bold.otf","refrigerator-deluxe-heavy.otf","bebas-neue-visual.woff2"])assert.ok(css.includes(font));
});

test("de generator wordt gedeeld door beheer en Club-home, maar niet door de stempagina", () => {
  const manage=readFileSync(new URL("../api-impl/motm/manage.ts",import.meta.url),"utf8");
  const club=readFileSync(new URL("../api-impl/club.ts",import.meta.url),"utf8");
  const vote=readFileSync(new URL("../api-impl/motm/vote.ts",import.meta.url),"utf8");
  assert.match(manage,/getSessionWithPermission\(request, permissions\.motmManage\)/);
  assert.match(manage,/data-download-visual/);
  assert.match(club,/createMotmVisualData/);
  assert.match(club,/data-winner-visual/);
  assert.doesNotMatch(vote,/data-download-visual|createMotmVisualData/);
});
