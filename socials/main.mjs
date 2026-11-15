import { statsFormat } from "/socials/formats/stats.mjs";
import { shotsMapFormat } from "/socials/formats/shots-map.mjs";
import { notableStatFormat } from "/socials/formats/notable-stat.mjs?v=20261113-outline";
import { cardVideoFormat } from "/socials/formats/card-video.mjs?v=20261113-no-intro";
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
const formats=new Map(formatDefinitions.map(definition=>[definition.id,{definition,controller:definition.init(root,sharedState)}]));  
mountPngPreviews(root);  
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
const api=payload?.fotmobApi,shots=Array.isArray(api?.shots)?api.shots:Array.isArray(api?.raw?.content?.shotmap?.shots)?api.raw.content.shotmap.shots:[],lineups=api?.lineups;    
return {matchData:Boolean(fixture),matchStats:Boolean(payload),playerStats:Array.isArray(payload?.players)&&payload.players.some(hasUsableStats),      
shotData:shots.some(shot=>Number.isFinite(shot?.x)&&Number.isFinite(shot?.y)&&Number.isFinite(shot?.expectedGoals)),      
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
