import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("MOTM-homekaart gebruikt een stabiele winnaarvisual zonder geforceerde woordbreuk",()=>{
  const club=read("../api/club.ts"),css=read("../motm.css");
  assert.match(club,/winner-visual-frame/);assert.match(club,/result-visual-spotlight/);
  const polish=css.slice(css.indexOf("Phase 2.1 responsive polish"));
  assert.match(polish,/overflow-wrap:normal;word-break:normal/);
  assert.doesNotMatch(polish,/overflow-wrap:anywhere|word-break:break-all/);
});

test("beheer gebruikt afzonderlijke datum- en tijdvelden en geen datetime-local",()=>{
  const manage=read("../api-impl/motm/manage.ts");
  for(const prefix of ["kickoff","scheduledOpen","scheduledClose"])assert.ok(manage.includes(`dateTimeFields(\"${prefix}\"`));
  assert.match(manage,/\$\{prefix\}Date/);assert.match(manage,/\$\{prefix\}Time/);
  assert.doesNotMatch(manage,/datetime-local/);
});

test("de Club-renderer gebruikt de actuele stylesheetversie",()=>{
  const source=read("../lib/motm-view.ts");assert.match(source,/motm\.css\?v=37/);assert.doesNotMatch(source,/motm\.css\?v=33/);
});

test("ledenresultaten tonen percentages en geen ruwe stemaantallen",()=>{
  const home=read("../api/club.ts"),result=read("../api-impl/motm/vote.ts"),stand=read("../api-impl/motm/stand.ts");
  assert.doesNotMatch(home,/winner\.votes/);
  assert.doesNotMatch(result,/voteLabel|row\.votes/);
  assert.doesNotMatch(stand,/Uitgebrachte stemmen|<span>Stemmen<\/span>|\(\$\{r\.votes\}\)/);
  assert.match(result,/row\.percentage/);
  assert.match(stand,/r\.percentage/);
});

test("stemmen bevestigt de gekozen speler bovenaan en houdt mobiel ruimte vrij",()=>{
  const vote=read("../api-impl/motm/vote.ts"),css=read("../motm.css");
  assert.match(vote,/>Jouw stem</);
  assert.match(vote,/>Stem opgeslagen</);
  assert.match(vote,/ownVote\.image_url_snapshot/);
  assert.doesNotMatch(vote,/Jouw huidige stem:/);
  assert.match(css,/\.vote-page\{--vote-action-height:calc\(70px \+ env\(safe-area-inset-bottom\)\);padding-bottom:calc\(var\(--vote-action-height\) \+ var\(--space-md\)\)\}/);
  assert.match(css,/\.vote-page \.sticky-action\{bottom:0;min-height:var\(--vote-action-height\)/);
});

test("seizoenstand onderscheidt koplopers van de volledige seizoenstand",()=>{
  const stand=read("../api-impl/motm/stand.ts");
  assert.match(stand,/Koplopers seizoen/);
  assert.match(stand,/Volledige seizoenstand/);
  assert.doesNotMatch(stand,/>Tussenstand</);
  assert.match(stand,/Hoe werkt de puntentelling\?/);
  assert.match(stand,/season-picker/);
  assert.match(stand,/season-current/);
  assert.doesNotMatch(stand,/class="season-selector"/);
  assert.match(stand,/season-match__podium/);
  assert.match(stand,/Volledige uitslag/);
  assert.doesNotMatch(stand,/\.join\(" · "\)/);
});

test("recente uitslagen tonen de eigen stem met spelersfoto als apart blok",()=>{
  const overview=read("../api-impl/motm/index.ts"),css=read("../motm.css");
  assert.match(overview,/own_vote_image/);
  assert.match(overview,/match-row__vote/);
  assert.match(overview,/<small>Jouw stem<\/small>/);
  assert.doesNotMatch(overview,/· Jouw stem:/);
  assert.match(css,/\.match-row__vote img/);
});

test("gesloten beheer toont automatisch de beheer-only resultaatvisual",()=>{
  const manage=read("../api-impl/motm/manage.ts");
  assert.match(manage,/createMotmVisualData/);
  assert.match(manage,/data-winner-visual/);
  assert.match(manage,/Download PNG/);
  assert.doesNotMatch(manage,/motm-winner-placeholder\.svg/);
});

test("beheer zet de openbare stemlink direct boven de bewerkstappen",()=>{
  const manage=read("../api-impl/motm/manage.ts");
  assert.match(manage,/share-primary/);
  assert.match(manage,/Kopieer stemlink/);
  assert.match(manage,/\$\{share\}\$\{announcement\}\$\{!match\.deleted_at\?liveVotePanel/);
  assert.match(manage,/1\. Wedstrijdgegevens.*2\. Planning en status.*3\. Spelers.*4\. Stemming verwijderen.*5\. Wijzigingslog/s);
  assert.doesNotMatch(manage,/Verplichte verwijderreden|Typ de tegenstander/);
});

test("Club-home houdt de visual tot een nieuwe stemming opent en gebruikt apparaateigen delen",()=>{
  const home=read("../api/club.ts"),script=read("../club.js"),css=read("../motm.css");
  assert.match(home,/if\(last\).*else if\(planned\)/s);
  assert.match(home,/data-native-share/);
  assert.doesNotMatch(home,/wa\.me|twitter\.com\/intent\/tweet|facebook\.com\/sharer|Instagram staat in het deelmenu/);
  assert.match(home,/desktop-visual-download/);
  assert.match(home,/Bekijk volledige uitslag/);
  assert.match(home,/createMotmVisualData/);
  assert.match(home,/data-winner-visual/);
  assert.match(home,/data-download-visual/);
  assert.doesNotMatch(home,/motm-winner-placeholder\.svg/);
  assert.match(home,/Vorige uitslag/);
  assert.match(home,/Laatste Man of the Match/);
  assert.match(script,/visualScript\.src = "\/motm-admin\.js\?v=2"/);
  assert.match(script,/navigator\.share/);
  assert.match(script,/navigator\.canShare\(\{ files: \[file\] \}\)/);
  assert.match(css,/\.home-winner-visual canvas\{[^}]*aspect-ratio:5\/4/);
  assert.match(css,/desktop-visual-download\{display:none\}/);
  assert.match(css,/@media\(min-width:700px\).*mobile-visual-share\{display:none\}/s);
});

test("Club-polish gebruikt gedeelde spacing, complete states en minder zware kaarten",()=>{
  const css=read("../motm.css");
  assert.match(css,/--space-2xl:48px/);
  assert.match(css,/--ease-out:cubic-bezier/);
  assert.match(css,/\.button:active/);
  assert.match(css,/input:user-invalid/);
  assert.match(css,/\.player-card:focus-within/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.club-spotlight:before,\.result-winner:before\{display:none\}/);
  assert.match(css,/@media\(max-width:699px\).*input,select,textarea\{font-size:16px\}/s);
});

test("Home groepeert introductie en verificatie en de stand gebruikt één scheidingslijn",()=>{
  const home=read("../api/club.ts"),css=read("../motm.css");
  assert.match(home,/class="club-intro"/);
  assert.match(home,/class="page-intro"/);
  assert.doesNotMatch(home,/class="club-welcome-meta"/);
  assert.match(css,/\.standings-main>\.standings-intro\{margin-top:0;padding-top:0;border-top:0\}/);
});

test("na stemmen staat de gekozen speler bovenaan zonder herhaalde wedstrijdkaart",()=>{
  const vote=read("../api-impl/motm/vote.ts"),css=read("../motm.css");
  assert.match(vote,/vote-page--voted/);
  assert.match(vote,/class="vote-receipt"/);
  assert.match(vote,/<h1>\$\{esc\(ownVote\.name_snapshot\)\}<\/h1>/);
  assert.match(vote,/const openContext=ownVote\?confirmation/);
  assert.match(css,/\.vote-page--voted form>section\{padding-top:0\}/);
});

test("mobiele stemlijst houdt ruimte vrij onder de vaste bevestigingsknop",()=>{
  const css=read("../motm.css");
  assert.match(css,/\.vote-page\{padding-bottom:calc\(var\(--nav-h\) \+ 190px \+ env\(safe-area-inset-bottom\)\)\}/);
});
