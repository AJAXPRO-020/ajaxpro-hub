import { statsFormat } from "/socials/formats/stats.mjs";
import { outblinkerFormat,hasUsableStats } from "/socials/formats/outblinker.mjs?v=20261023-ui-tidy";
import { topThreeFormat } from "/socials/formats/top-three.mjs?v=20261023-ui-tidy";
import { quoteFormat } from "/socials/formats/quote.mjs?v=20261023-ui-tidy";
import { videoFormat } from "/socials/formats/video.mjs?v=20261023-socials-polish";
import { initMatchStats } from "/socials/match-stats.mjs?v=20261023-socials-polish";
import { mountPngPreviews } from "/socials/png.mjs?v=20261023-png-final";

const formatDefinitions=[statsFormat,outblinkerFormat,topThreeFormat,quoteFormat,videoFormat];
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
  const formats=new Map(formatDefinitions.map(definition=>[definition.id,{definition,controller:definition.init(root,sharedState)}]));
  mountPngPreviews(root);
  const formatStatus=root.querySelector("[data-socials-format-status]"),statsStatus=root.querySelector("[data-socials-stats-status]"),resetFormat=root.querySelector("[data-socials-format-reset]"),previewControls=root.querySelector("[data-socials-preview-controls]");
  const requestedFormat=new URL(location.href).searchParams.get("format");
  let activeId=root.querySelector('[data-format-id][aria-pressed="true"]')?.dataset.formatId;
  const globalDataStatus=()=>{
    const fixture=fixtures.find(item=>item.fixture_key===sharedState.selectedFixtureKey)??fixtures[0]??null;
    const payload=fixture?sharedState.getMatchStats?.(fixture.fixture_key):null;
    return {matchData:Boolean(fixture),matchStats:Boolean(payload),playerStats:Array.isArray(payload?.players)&&payload.players.some(hasUsableStats)};
  };
  const renderGlobalDataStatus=()=>{
    if(!formatStatus)return;
    const states=globalDataStatus();
    const statsState=statsStatus?.dataset.state??"missing";
    const sources=[
      ["Wedstrijddata",states.matchData?"available":"missing",states.matchData?"beschikbaar":"ontbreekt"],
      ["Teamstatistieken",states.matchStats?"available":["loading","upcoming"].includes(statsState)?"pending":statsState==="mismatch"?"mismatch":"missing",states.matchStats?"beschikbaar":statsState==="loading"?"worden geladen":statsState==="upcoming"?"nog niet beschikbaar":statsState==="mismatch"?"komen niet overeen":"ontbreken"],
      ["Spelerstatistieken",states.playerStats?"available":states.matchStats?"missing":"pending",states.playerStats?"beschikbaar":states.matchStats?"ontbreken":statsState==="loading"?"worden geladen":"nog niet gecontroleerd"],
    ];
    formatStatus.replaceChildren(...sources.map(([label,state,detail])=>{const item=document.createElement("span");item.dataset.state=state;item.textContent=state==="available"?`✓ ${label}`:`${label} ${detail}`;return item}));
  };
  const refreshFormatStatus=()=>{
    const format=formats.get(activeId),states=format?.controller.getRequirementStatus?.()??{};
    renderGlobalDataStatus();
    const ready=Boolean(format)&&format.definition.requirements.every(requirement=>Boolean(states[requirement]));
    const workspace=root.querySelector(`[data-format-workspace="${activeId}"]`);if(workspace){workspace.dataset.formatReady=String(ready);workspace.dataset.formatDataReady=String(Boolean(states.matchData)&&(!format.definition.requirements.includes("matchStats")||Boolean(states.matchStats)))}
    if(resetFormat)resetFormat.disabled=!format;
  };
  const activate=id=>{
    const button=root.querySelector(`[data-format-id="${id}"]`);
    const next=formats.get(id);if(!button||button.disabled||!next)return;
    if(activeId&&activeId!==id)formats.get(activeId)?.controller.deactivate?.();
    activeId=id;
    root.dataset.activeFormat=id;
    const currentUrl=new URL(location.href);currentUrl.searchParams.set("format",id);history.replaceState(null,"",currentUrl);
    root.querySelectorAll("[data-format-id]").forEach(option=>{const active=option===button;option.classList.toggle("is-active",active);option.setAttribute("aria-pressed",String(active))});
    root.querySelectorAll("[data-format-workspace]").forEach(workspace=>{workspace.hidden=workspace.dataset.formatWorkspace!==id});
    const preview=next.controller&&root.querySelector(`[data-format-workspace="${id}"] .socials-preview-panel`);if(preview&&previewControls){preview.querySelector(".socials-preview-heading")?.after(previewControls);previewControls.hidden=next.definition.fixedOutput===true}
    if(next.definition.requirements.includes("matchData"))matchStats.activate(id);
    next.controller.activate?.();
    refreshFormatStatus();
  };
  root.querySelectorAll("[data-format-id]").forEach(button=>button.addEventListener("click",()=>activate(button.dataset.formatId)));
  resetFormat?.addEventListener("click",()=>{formats.get(activeId)?.controller.reset?.();refreshFormatStatus()});
  root.addEventListener("socials:match-stats",refreshFormatStatus);
  root.addEventListener("socials:stats-status-change",refreshFormatStatus);
  root.addEventListener("socials:match-selection",refreshFormatStatus);
  root.addEventListener("socials:format-status-change",event=>{if(event.detail?.formatId===activeId)refreshFormatStatus()});
  if(requestedFormat&&formats.has(requestedFormat)&&!root.querySelector(`[data-format-id="${requestedFormat}"]`)?.disabled)activeId=requestedFormat;
  if(activeId)activate(activeId);
}
