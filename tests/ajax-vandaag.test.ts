import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {matchInterest} from "../lib/ajax-vandaag-content";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const match=(description:string,competition="Eredivisie")=>({match_id:description,match_date:"11/1/1975",description,competition,player_count:11,source_url:null});

test("Ajax Vandaag geeft Klassiekers en Europese duels voorrang boven gewone uitslagen",()=>{
  assert.ok(matchInterest(match("Ajax - Feyenoord 6 - 0 (1 - 0)"))>matchInterest(match("Ajax - FC Dordrecht 4 - 0 (1 - 0)")));
  assert.ok(matchInterest(match("Lausanne Sports - Ajax 0 - 4 (0 - 3)","UEFA Cup"))>matchInterest(match("Ajax - FC Dordrecht 4 - 0 (1 - 0)")));
});

test("Ajax Vandaag gebruikt geselecteerde datumvelden en wist eerdere resultaten vóór genereren",()=>{
  const source=read("../socials/formats/ajax-vandaag.mjs");
  assert.match(source,/text\(ctx,f\.dayNumber/);
  assert.match(source,/text\(ctx,f\.monthShort/);
  assert.doesNotMatch(source,/text\(ctx,"31"|text\(ctx,"OKT"/);
  assert.match(source,/results\.replaceChildren\(\);status\.textContent="Feiten en beeldsuggesties ophalen/);
  assert.match(source,/data\.date!==selectedDate/);
  assert.match(source,/ratio\.value==="9:16"\?1920:1350/);
  assert.match(source,/canvas\.toBlob/);
});

test("Ajax Vandaag koppelt canonieke tabellen en beide bestaande private mediabuckets",()=>{
  const source=read("../lib/ajax-vandaag-content.ts");
  for(const table of ["matches","clean_players","player_matches","clean_images","historical_media.assets"])assert.match(source,new RegExp(table.replace(".","\\.")));
  assert.match(source,/historical-player-images/);
  assert.match(source,/historical-media/);
  assert.doesNotMatch(source,/historical_matches|historical_players/);
});
