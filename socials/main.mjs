import { statsFormat } from "/socials/formats/stats.mjs";
import { selectedMatchContext } from "/socials/match-context.mjs";
import { shotsMapFormat, ajaxShots } from "/socials/formats/shots-map.mjs?v=20261115-raw-shots";
import { notableStatFormat } from "/socials/formats/notable-stat.mjs?v=20261113-outline";
import { cardVideoFormat } from "/socials/formats/card-video.mjs?v=20261115-preview";
import { outblinkerFormat,hasUsableStats } from "/socials/formats/outblinker.mjs?v=20261023-ui-tidy";
import { topThreeFormat } from "/socials/formats/top-three.mjs?v=20261023-ui-tidy";
import { quoteFormat } from "/socials/formats/quote.mjs?v=20261023-ui-tidy";
import { videoFormat } from "/socials/formats/video.mjs?v=20261023-socials-polish";
import { initMatchStats } from "/socials/match-stats.mjs?v=20261113-format-grid";
import { mountPngPreviews } from "/socials/png.mjs?v=20261114-outblinker-depth";
import { ajaxVandaagFormat } from "/socials/formats/ajax-vandaag.mjs?v=20261113-typography";

const formatDefinitions=[statsFormat,shotsMapFormat,notableStatFormat,cardVideoFormat,outblinkerFormat,topThreeFormat,quoteFormat,videoFormat,ajaxVandaagFormat];
const readFixtures=root=>{
  const template=root.querySelector("template[data-socials-match-context]");
  if(!template)return [];
  try{const fixtures=JSON.parse(template.content.textContent||"[]");return Array.isArray(fixtures)?fixtures:[]}catch{return []}
};

const root=document.querySelector("[data-socials-root]");
if(root){
  const sharedState={};
  const matchStats=initMatchStats(root,sharedState);
  const fixtures=readFixtures(root);
  sharedState.getMatchContext=()=>selectedMatchContext(fixtures,sharedState.selectedFixtureKey);
  const formats=new Map(formatDefinitions.map(definition=>[definition.id,{definition,controller:definition.init(root,sharedState)}]));
  mountPngPreviews(root,sharedState);
  const formatStatus=root.querySelector("[data-socials-format-status]"),statsStatus=root.querySelector("[data-socials-stats-status]"),resetFormat=root.querySelector("[data-socials-format-reset]"),previewControls=root.querySelector("[data-socials-preview-controls]");
  const publishDialog=root.querySelector("[data-socials-publish-dialog]"),publishForm=root.querySelector("[data-socials-publish-form]"),publishStatus=root.querySelector("[data-socials-publish-status]"),publishFile=root.querySelector("[data-socials-publish-file]"),publishText=root.querySelector("#socials-publish-text"),publishCancel=root.querySelector("[data-socials-publish-cancel]"),publishSubmit=root.querySelector("[data-socials-publish-submit]");
  let pendingPublication=null;
  const openPublishDialog=detail=>{if(!publishDialog||!publishForm)return;pendingPublication=detail;publishForm.reset();publishStatus.textContent="";publishStatus.dataset.state="";publishFile.textContent=detail.filename?`Bestand: ${detail.filename}`:"Video klaar om te plaatsen.";publishDialog.showModal()};
  root.addEventListener("socials:publish-request",event=>openPublishDialog(event.detail));
  publishCancel?.addEventListener("click",()=>publishDialog?.close());
  publishForm?.addEventListener("submit",async event=>{event.preventDefault();if(!pendingPublication)return;publishSubmit.disabled=true;publishStatus.textContent="Publicatie wordt gecontroleerd…";const data=new FormData();data.set("kind",pendingPublication.kind);data.set("text",publishText?.value.trim()||"");if(pendingPublication.kind==="video")data.set("jobId",pendingPublication.jobId);else{data.set("sourceId",pendingPublication.sourceId);data.set("idempotencyKey",pendingPublication.idempotencyKey);data.set("file",pendingPublication.file,pendingPublication.filename)}try{const response=await fetch(publishForm.action,{method:"POST",body:data,credentials:"same-origin",headers:{Accept:"application/json"}}),payload=await response.json();if(!response.ok)throw new Error(payload.error||"Publiceren naar Discord mislukt.");publishStatus.textContent=payload.status==="already_sent"?"Deze publicatie was al geplaatst.":"Geplaatst in #socials-organisatie.";publishStatus.dataset.state="success";if(payload.status==="sent"||payload.status==="already_sent")pendingPublication=null}catch(error){publishStatus.textContent=error instanceof Error?error.message:"Publiceren naar Discord mislukt.";publishStatus.dataset.state="error"}finally{publishSubmit.disabled=false}});
  const requestedFormat=new URL(location.href).searchParams.get("format");
  let activeId=root.querySelector('[data-format-id][aria-pressed="true"]')?.dataset.formatId;
  const globalDataStatus=()=>{
    const fixture=fixtures.find(item=>item.fixture_key===sharedState.selectedFixtureKey)??fixtures[0]??null;
    const payload=fixture?sharedState.getMatchStats?.(fixture.fixture_key):null;
    const api=payload?.fotmobApi,lineups=api?.lineups;
    return {matchData:Boolean(fixture),matchStats:Boolean(payload),playerStats:Array.isArray(payload?.players)&&payload.players.some(hasUsableStats),
      shotData:ajaxShots(payload).length>0,
      lineups:Boolean(lineups?.homeTeam||lineups?.awayTeam),events:Array.isArray(api?.events)&&api.events.length>0};
  };
  const renderProviderStatus=payload=>{
    const statuses=payload?.providerStatuses??{},warnings=Array.isArray(payload?.providerWarnings)?payload.providerWarnings:[];
    root.querySelectorAll("[data-socials-provider-status] [data-provider]").forEach(item=>{
      const provider=item.dataset.provider,state=statuses[provider]??"missing",label=state==="success"?"Actueel opgehaald":state==="stored"?"Eerder opgeslagen data beschikbaar":state==="partial"?"Gedeeltelijk beschikbaar":state==="unavailable"?"Niet beschikbaar":"Nog niet opgehaald";
      item.dataset.state=state;item.querySelector("b").textContent=state==="success"||state==="stored"||state==="partial"?"✓":"—";item.querySelector("small").textContent=provider==="sofascore"&&warnings.length&&state==="unavailable"?"Niet beschikbaar na ophalen":label;
    });
  };
  const renderGlobalDataStatus=()=>{
    if(!formatStatus)return;
    const states=globalDataStatus();
    const fixture=fixtures.find(item=>item.fixture_key===sharedState.selectedFixtureKey)??fixtures[0]??null;
    const statsState=statsStatus?.dataset.state??"missing";
    const payload=fixture?sharedState.getMatchStats?.(fixture.fixture_key):null;
    const source=payload?"FotMob":"bron wordt gecontroleerd";
    const played=Boolean(fixture&&new Date(fixture.kickoff_at).getTime()<=Date.now());
    const sources=[
      ["Wedstrijddata",states.matchData?"available":"missing",states.matchData?(played?"centrale fixturebron":"nog niet gespeeld"):"ontbreekt"],
      ["Teamstatistieken",states.matchStats?"available":["loading","upcoming"].includes(statsState)?"pending":statsState==="mismatch"?"mismatch":"missing",states.matchStats?source:played?(statsState==="loading"?"worden geladen":statsState==="mismatch"?"komen niet overeen":"API nog niet binnen"):"API nog niet binnen"],
      ["Spelerstatistieken",states.playerStats?"available":states.matchStats?"missing":"pending",states.playerStats?source:played?(statsState==="loading"?"worden geladen":statsState==="mismatch"?"komen niet overeen":"API nog niet binnen"):"API nog niet binnen"],
      ["Schotdata",states.shotData?"available":states.matchStats?"missing":"pending",states.shotData?"FotMob API":played?"API nog niet binnen":"nog niet gespeeld"],
      ["Opstellingen",states.lineups?"available":states.matchStats?"missing":"pending",states.lineups?"FotMob API":played?"API nog niet binnen":"nog niet gespeeld"],
      ["Wedstrijdgebeurtenissen",states.events?"available":states.matchStats?"missing":"pending",states.events?"FotMob API":played?"Geen gebeurtenissen opgeslagen":"nog niet gespeeld"],
    ];
    formatStatus.replaceChildren(...sources.map(([label,state,detail])=>{const item=document.createElement("span");item.dataset.state=state;item.innerHTML=`<b aria-hidden="true">${state==="available"?"✓":"—"}</b><span>${label}</span><small>${detail}</small>`;return item}));
    const fetchButton=root.querySelector("[data-socials-stats-fetch]"),fixturePlayed=Boolean(fixture&&new Date(fixture.kickoff_at).getTime()<=Date.now()),providerItems=[...root.querySelectorAll("[data-socials-provider-status] [data-provider]")],providersReady=providerItems.length===2&&providerItems.every(item=>["success","stored","partial"].includes(item.dataset.state)),allAvailable=sources.every(([,state])=>state==="available")&&providersReady;
    if(fetchButton){const loading=statsState==="loading";fetchButton.hidden=!fixturePlayed;fetchButton.disabled=!fixturePlayed||loading||allAvailable;fetchButton.setAttribute("aria-disabled",String(fetchButton.disabled));fetchButton.textContent=loading?"Statistieken verversen…":allAvailable?"Alle statistieken beschikbaar":"Statistieken verversen"}
    formats.forEach(({definition,controller})=>{const button=root.querySelector(`[data-format-id="${definition.id}"]`),note=button?.querySelector("[data-format-availability]"),states=controller.getRequirementStatus?.()??{};if(!note||definition.availability==="planned")return;const ready=definition.requirements.every(requirement=>Boolean(states[requirement]));note.hidden=ready;note.textContent=ready?"":"Nog niet beschikbaar · gegevens ontbreken";button.dataset.dataReady=String(ready)});
  };
  const refreshFormatStatus=()=>{
    const format=formats.get(activeId),states=format?.controller.getRequirementStatus?.()??{};
    renderGlobalDataStatus();
    const ready=Boolean(format)&&format.definition.requirements.every(requirement=>Boolean(states[requirement]));
    const workspace=root.querySelector(`[data-format-workspace="${activeId}"]`);if(workspace){workspace.dataset.formatReady=String(ready);workspace.dataset.formatDataReady=String(Boolean(states.matchData)&&(!format.definition.requirements.includes("matchStats")||Boolean(states.matchStats)))}
    if(resetFormat)resetFormat.disabled=!format;
  };
  const syncActionToolbar=workspace=>{
    if(!workspace)return;
    let toolbar=workspace.querySelector(':scope > .socials-format-toolbar');
    if(!toolbar){toolbar=document.createElement('div');toolbar.className='socials-format-toolbar';toolbar.innerHTML='<h2 class="socials-format-toolbar__title"></h2><div class="socials-format-toolbar__actions"></div>';workspace.prepend(toolbar)}
    toolbar.querySelector('.socials-format-toolbar__title').textContent=formats.get(workspace.dataset.formatWorkspace)?.definition.label??'';
    const actions=toolbar.querySelector('.socials-format-toolbar__actions');
    workspace.querySelectorAll('.socials-download,.socials-publish-action').forEach(button=>{if(button.parentElement!==actions)actions.append(button)});
  };
  const syncAllActionToolbars=()=>root.querySelectorAll('[data-format-workspace]').forEach(syncActionToolbar);
  const activate=id=>{
    const button=root.querySelector(`[data-format-id="${id}"]`);
    const next=formats.get(id);if(!button||button.disabled||!next)return;
    if(activeId&&activeId!==id)formats.get(activeId)?.controller.deactivate?.();
    activeId=id;
    root.dataset.activeFormat=id;
    const currentUrl=new URL(location.href);currentUrl.searchParams.set("format",id);history.replaceState(null,"",currentUrl);
    root.querySelectorAll("[data-format-id]").forEach(option=>{const active=option===button;option.classList.toggle("is-active",active);option.setAttribute("aria-pressed",String(active))});
    root.querySelectorAll("[data-format-workspace]").forEach(workspace=>{workspace.hidden=workspace.dataset.formatWorkspace!==id});
    syncAllActionToolbars();
    const preview=next.controller&&root.querySelector(`[data-format-workspace="${id}"] .socials-preview-panel`);if(preview&&previewControls){preview.querySelector(".socials-preview-heading")?.after(previewControls);previewControls.hidden=next.definition.fixedOutput===true}
    if(next.definition.requirements.includes("matchData"))matchStats.activate(id);
    next.controller.activate?.();
    refreshFormatStatus();
    root.dispatchEvent(new CustomEvent('socials:format-activated',{detail:{formatId:id}}));
  };
  root.querySelectorAll("[data-format-id]").forEach(button=>button.addEventListener("click",()=>activate(button.dataset.formatId)));
  resetFormat?.addEventListener("click",()=>{formats.get(activeId)?.controller.reset?.();refreshFormatStatus()});
  root.addEventListener("socials:match-stats",event=>{renderProviderStatus(event.detail?.payload);refreshFormatStatus()});
  root.addEventListener("socials:stats-status-change",refreshFormatStatus);
  root.addEventListener("socials:match-selection",refreshFormatStatus);
  root.addEventListener("socials:format-status-change",event=>{if(event.detail?.formatId===activeId)refreshFormatStatus()});
  if(requestedFormat&&formats.has(requestedFormat)&&!root.querySelector(`[data-format-id="${requestedFormat}"]`)?.disabled)activeId=requestedFormat;
  if(activeId)activate(activeId);
}
