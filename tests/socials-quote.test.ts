import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { renderSocials } from "../api-impl/socials/index";
import { socialFormats, socialOutputFormats } from "../lib/socials";
import { isValidQuotePhoto, QUOTE_MAX_LENGTH, QUOTE_PHOTO_MAX_BYTES } from "../lib/socials-quote";

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Quote staat als beschikbaar format zonder wedstrijdafhankelijkheid geregistreerd",()=>{
  const quote=socialFormats.find(format=>format.id==="quote");
  assert.deepEqual(quote&&{matchContext:quote.matchContext,availability:quote.availability},{matchContext:"none",availability:"available"});
});

test("Quote begrenst alleen de quote en gebruikt twee lokale beeldvelden",()=>{
  assert.equal(QUOTE_MAX_LENGTH,280);
});

test("Quote valideert lokale foto's op type en maximale bestandsgrootte",()=>{
  for(const type of ["image/jpeg","image/png","image/webp"])assert.equal(isValidQuotePhoto({type,size:1024}),true);
  assert.equal(isValidQuotePhoto({type:"image/gif",size:1024}),false);
  assert.equal(isValidQuotePhoto({type:"image/jpeg",size:QUOTE_PHOTO_MAX_BYTES+1}),false);
  assert.equal(isValidQuotePhoto({type:"image/png",size:0}),false);
});

test("Quote is zonder wedstrijdcontext actief en bruikbaar",async()=>{
  const response=await renderSocials(session,async()=>[]),html=await response.text();
  assert.match(html,/data-format-id="quote"[^>]*aria-pressed="true"/);
  assert.match(html,/data-format-workspace="quote" data-quote-workspace>/);
  assert.match(html,new RegExp(`data-quote-field="quote" maxlength="${QUOTE_MAX_LENGTH}"`));
  assert.match(html,/data-quote-count>0</);
  assert.match(html,/data-quote-person-select/);
  assert.match(html,/data-quote-variant checked[^>]*>/);
  assert.match(html,/Quote groot/);
  assert.match(html,/Quote klein/);
  assert.match(html,/data-quote-background/);
  assert.match(html,/data-quote-inset/);
  assert.match(html,/quote-upload__button/);
  assert.doesNotMatch(html,/data-quote-person-note|data-quote-preview-ratio|data-quote-preview-dimensions/);
  assert.match(html,/accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(response.headers.get("content-security-policy")??"",/img-src 'self' https:\/\/cdn\.discordapp\.com blob:/);
  assert.doesNotMatch(html,/data-match-select/);
});

test("Quote gebruikt dezelfde twee outputformaten als Stats",()=>{
  assert.deepEqual(socialOutputFormats.map(({id,width,height})=>({id,width,height})),[
    {id:"portrait-4x5",width:1080,height:1350},
    {id:"vertical-9x16",width:1080,height:1920},
  ]);
});

test("Quote-foto blijft lokaal en object-URL's worden opgeruimd",()=>{
  const source=read("../socials/formats/quote.mjs");
  assert.match(source,/URL\.createObjectURL/);
  assert.match(source,/URL\.revokeObjectURL/);
  assert.match(source,/beforeunload/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|FormData|localStorage|sessionStorage/);
});

test("Quote-state leeft in een afzonderlijke formatmodule",()=>{
  const main=read("../socials/main.mjs"),page=read("../api-impl/socials/index.ts"),stats=read("../socials/formats/stats.mjs"),quote=read("../socials/formats/quote.mjs");
  assert.match(main,/quoteFormat/);
  assert.match(page,/socials\/main\.mjs\?v=20261023-status/);
  assert.match(quote,/quote-people\.mjs\?v=20260915-people/);
  assert.match(main,/formatDefinitions=\[statsFormat,outblinkerFormat,topThreeFormat,quoteFormat,videoFormat\]/);
  assert.match(main,/quote\.mjs\?v=20260915-quote-variants/);
  assert.doesNotMatch(stats,/data-quote-field|photoFile/);
  assert.doesNotMatch(quote,/data-stat-id|data-match-select/);
});

test("Quote heeft twee compositorische varianten zonder gedeelde editorstate",()=>{
  const page=read("../api-impl/socials/index.ts"),quote=read("../socials/formats/quote.mjs"),css=read("../socials.css");
  assert.match(page,/name="quote-variant" value="large"/);
  assert.match(page,/name="quote-variant" value="small"/);
  assert.match(quote,/state\.variant="large"/);
  assert.match(quote,/preview\.dataset\.variant=state\.variant/);
  assert.match(quote,/variantInputs\.forEach/);
  assert.match(css,/data-variant=large/);
  assert.match(css,/data-variant=small/);
  assert.match(css,/quote-upload__button/);
  assert.doesNotMatch(quote,/fetch\(|XMLHttpRequest|FormData|localStorage|sessionStorage/);
});

test("Quote-only personen zijn lokaal geconfigureerd zonder de spelersregistry uit te breiden",()=>{
  const source=read("../socials/quote-people.mjs");
  const expected=[
    ["Míchel","Hoofdtrainer","michel.png"],
    ["Jordi Cruijff","Technisch directeur","jordi-cruijff.png"],
    ["Shashi Baboeram Panday","Financieel directeur","shashi-baboeram-panday.png"],
    ["Menno Geelen","Algemeen directeur","menno-geelen.png"],
  ];
  for(const [name,role,asset] of expected){
    assert.match(source,new RegExp(`${name}.*${role}.*${asset}`));
    assert.equal(existsSync(new URL(`../assets/socials/quotes/people/${asset}`,import.meta.url)),true);
  }
  assert.doesNotMatch(source,/disabled:true|player-registry|assets\/players/);
});

test("Quote groot geeft de cutout een eigen beeldvlak en houdt de downloadzone in de previewkolom",()=>{
  const css=read("../socials-quote-large.css"),page=read("../api-impl/socials/index.ts");
  assert.match(css,/Quote groot is a dedicated poster composition/);
  assert.match(css,/grid-template-rows:8% minmax\(0,1fr\) 5%/);
  assert.match(css,/data-variant=large\] \.quote-editorial-preview__portrait\{position:absolute;right:4cqw;bottom:0;width:60cqw;height:92%/);
  assert.match(css,/data-aspect=vertical-9x16\]\[data-variant=large\] \.quote-editorial-preview__portrait\{right:1cqw;bottom:0;width:72cqw;height:94%/);
  assert.match(css,/width:60%;max-width:60%/);
  assert.match(css,/overflow-wrap:normal;word-break:normal;hyphens:none;text-wrap:balance/);
  assert.match(css,/\.quote-editorial-preview\+\.socials-download\{display:flex;box-sizing:border-box;width:min\(100%,480px\);min-height:48px/);
  assert.match(css,/footer\{z-index:7;min-height:0;padding:0 5\.2cqw/);
  assert.match(page,/socials-quote-large\.css\?v=20260915-quote-large-v4/);
  assert.doesNotMatch(css,/data-variant=small/);
});
