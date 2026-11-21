import { db } from "./motm-db";
import { players as bootstrapPlayers } from "../data/players";

/** Productregel: deze registry-entry mag nooit door een externe selectielijst verdwijnen. */
export const ALWAYS_RETAINED_PLAYER_IDS = ["ouazane"] as const;

export type PlayerRegistryRow = {
  id: string;
  name: string;
  shirtNumber: number | null;
  position: string;
  imageUrl: string;
  active: boolean;
  contractEnd: string | null;
  contractPosition: string | null;
  contractNote: string | null;
  loanClub: string | null;
  loanEnd: string | null;
  loanNote: string | null;
  loanDeal: LoanDeal | null;
  arrivalDeal: ArrivalDeal | null;
  selectionGroup: "first_team" | "youth" | "outside" | null;
  contractForm: "owned" | "loaned_in" | "no_contract" | "unknown" | null;
  loanedOut: boolean;
  updatedAt: string;
};

/** Alleen de centrale selectiestatus bepaalt de standaardbeschikbaarheid in de Opstellingmaker. */
export const lineupDefaultAvailable = (player: PlayerRegistryRow) => player.selectionGroup === "first_team" && !player.loanedOut && player.contractForm !== "no_contract";
export const lineupAvailabilityCategory = (player: PlayerRegistryRow) => {
  if (lineupDefaultAvailable(player)) return "default" as const;
  if (player.selectionGroup === "youth") return "optional" as const;
  return "unavailable" as const;
};

export type LoanDealSource = {
  label: string;
  url: string;
};

export type LoanDeal = {
  status: "confirmed" | "reported";
  updatedAt: string;
  terms: string[];
  note: string | null;
  sources: LoanDealSource[];
};

export type ArrivalDeal = {
  status: "confirmed" | "partly_reported";
  updatedAt: string;
  fromClub: string;
  transferType: string;
  fee: string;
  terms: string[];
  note: string | null;
  sources: LoanDealSource[];
};

const mapDate=(value:unknown)=>{
  if(!value)return null;
  if(value instanceof Date)return value.toISOString().slice(0,10);
  const text=String(value);
  const iso=text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return iso??null;
};

const mapLoanDeal=(value:unknown):LoanDeal|null=>{
  if(!value||typeof value!=="object")return null;
  const deal=value as Record<string,unknown>;
  const status=deal.status==="confirmed"||deal.status==="reported"?deal.status:null;
  const terms=Array.isArray(deal.terms)?deal.terms.filter((term):term is string=>typeof term==="string"&&Boolean(term.trim())):[];
  const sources=Array.isArray(deal.sources)?deal.sources.flatMap((source)=>{
    if(!source||typeof source!=="object")return [];
    const item=source as Record<string,unknown>;
    return typeof item.label==="string"&&typeof item.url==="string"&&item.url.startsWith("https://")?[{label:item.label,url:item.url}]:[];
  }):[];
  if(!status||!terms.length||!sources.length)return null;
  return {status,updatedAt:mapDate(deal.updatedAt)??"",terms,note:typeof deal.note==="string"?deal.note:null,sources};
};

const mapArrivalDeal=(value:unknown):ArrivalDeal|null=>{
  if(!value||typeof value!=="object")return null;
  const deal=value as Record<string,unknown>;
  const status=deal.status==="confirmed"||deal.status==="partly_reported"?deal.status:null;
  const fromClub=typeof deal.fromClub==="string"?deal.fromClub.trim():"";
  const transferType=typeof deal.transferType==="string"?deal.transferType.trim():"";
  const fee=typeof deal.fee==="string"?deal.fee.trim():"";
  const terms=Array.isArray(deal.terms)?deal.terms.filter((term):term is string=>typeof term==="string"&&Boolean(term.trim())):[];
  const sources=Array.isArray(deal.sources)?deal.sources.flatMap((source)=>{
    if(!source||typeof source!=="object")return [];
    const item=source as Record<string,unknown>;
    return typeof item.label==="string"&&typeof item.url==="string"&&item.url.startsWith("https://")?[{label:item.label,url:item.url}]:[];
  }):[];
  if(!status||!fromClub||!transferType||!fee||!sources.length)return null;
  return {status,updatedAt:mapDate(deal.updatedAt)??"",fromClub,transferType,fee,terms,note:typeof deal.note==="string"?deal.note:null,sources};
};

const mapPlayer=(row:any):PlayerRegistryRow=>({
  id:String(row.id),
  name:String(row.name),
  shirtNumber:row.shirt_number===null?null:Number(row.shirt_number),
  position:String(row.position),
  imageUrl:String(row.image_url),
  active:Boolean(row.active),
  contractEnd:mapDate(row.contract_end),
  contractPosition:row.contract_position?String(row.contract_position):null,
  contractNote:row.contract_note?String(row.contract_note):null,
  loanClub:row.loan_club?String(row.loan_club):null,
  loanEnd:mapDate(row.loan_end),
  loanNote:row.loan_note?String(row.loan_note):null,
  loanDeal:mapLoanDeal(row.loan_deal),
  arrivalDeal:mapArrivalDeal(row.arrival_deal),
  selectionGroup:row.selection_group === "first_team" || row.selection_group === "youth" || row.selection_group === "outside" ? row.selection_group : null,
  contractForm:row.contract_form === "owned" || row.contract_form === "loaned_in" || row.contract_form === "no_contract" || row.contract_form === "unknown" ? row.contract_form : null,
  loanedOut:Boolean(row.loaned_out),
  updatedAt:new Date(row.updated_at).toISOString(),
});

export const loadPlayers=async({includeInactive=false}:{includeInactive?:boolean}={})=>{
  if(!process.env.DATABASE_URL){
    return bootstrapPlayers.filter(player=>includeInactive||player.active).map(player=>({
      ...player,contractEnd:null,contractPosition:null,contractNote:null,loanClub:null,loanEnd:null,loanNote:null,loanDeal:null,arrivalDeal:null,selectionGroup:null,contractForm:null,loanedOut:false,updatedAt:new Date(0).toISOString(),
    }));
  }
  const query=()=>db()`SELECT id,name,shirt_number,position,image_url,active,contract_end,contract_position,contract_note,loan_club,loan_end,loan_note,loan_deal,arrival_deal,selection_group,contract_form,loaned_out,updated_at
    FROM ajax_players WHERE (${includeInactive} OR active=true)
    ORDER BY active DESC,shirt_number NULLS LAST,name`;
  const fallbackQuery=()=>db()`SELECT id,name,shirt_number,position,image_url,active,contract_end,contract_position,contract_note,loan_club,loan_end,loan_note,updated_at
    FROM ajax_players WHERE (${includeInactive} OR active=true)
    ORDER BY active DESC,shirt_number NULLS LAST,name`;
  try{
    return (await query()).map(mapPlayer);
  }catch(error){
    const code=error&&typeof error==="object"&&"code" in error?(error as {code?:unknown}).code:null;
    if(code!=="42703")throw error;
    const message=error instanceof Error?error.message:"";
    const missingColumn=message.match(/column [\"']?([^\"']+)[\"']? does not exist/i)?.[1]??"loan_deal or arrival_deal";
    console.warn("Player registry optional schema missing; using fallback query",{missingColumn,impact:"/api/players blijft beschikbaar, maar optionele huur- en transferdata kan ontbreken."});
    return (await fallbackQuery()).map((row)=>mapPlayer({...row,loan_deal:null,arrival_deal:null,selection_group:null,contract_form:null,loaned_out:Boolean(row.loan_club)}));
  }
};

export const toToolPlayer=(player:PlayerRegistryRow)=>({
  id:player.id,
  name:player.name,
  shirtNumber:player.shirtNumber,
  position:player.position,
  imageUrl:player.imageUrl,
  active:player.active,
  selectionGroup:player.selectionGroup,
  contractForm:player.contractForm,
  loanedOut:player.loanedOut,
});
