import { randomUUID } from "node:crypto";
import { db } from "./motm-db";
import { VideoError,VIDEO_TEMPLATE_VERSION,type VideoData } from "./socials-video-data";
import type { SocialMatchdayFixture } from "./socials-match-context";
import type { SocialsMatchStatsSnapshot } from "./socials-stats-snapshots";
export type JobStatus="submitting"|"queued"|"fetching"|"rendering"|"done"|"failed"|"uncertain"|"expired";
export type VideoJob={id:string;fixture_key:string;requested_by:string;request_key:string;data_hash:string;template_version:string;render_data:VideoData;source_snapshot:SocialsMatchStatsSnapshot;source_fixture:SocialMatchdayFixture;render_id:string|null;status:JobStatus;output_url:string|null;available_until:string|Date|null;error:string|null;created_at:string|Date;updated_at:string|Date;checked_at:string|Date|null};
export type ReserveInput={fixture:SocialMatchdayFixture;snapshot:SocialsMatchStatsSnapshot;data:VideoData;hash:string;actor:string;requestKey:string;regenerateOf?:string};
export const activeStatuses:readonly JobStatus[]=["submitting","queued","fetching","rendering","uncertain"];
export const isActive=(job:VideoJob)=>activeStatuses.includes(job.status);
export interface VideoStore{
 list(fixture:string):Promise<VideoJob[]>;
 get(id:string):Promise<VideoJob|null>;
 reserve(input:ReserveInput):Promise<{job:VideoJob;created:boolean}>;
 patch(id:string,patch:Partial<VideoJob>):Promise<VideoJob>;
 claimCheck(id:string):Promise<boolean>;
}
export function postgresVideoStore():VideoStore{
 const get=async(id:string)=>{const [r]=await db()`SELECT * FROM socials_video_jobs WHERE id=${id}`;return r as VideoJob??null};
 return {
  get,
  async list(fixture){return await db()`SELECT * FROM socials_video_jobs WHERE fixture_key=${fixture} ORDER BY created_at DESC,id DESC LIMIT 10` as unknown as VideoJob[]},
  async reserve(i){return db().begin(async raw=>{
   const sql=raw as unknown as ReturnType<typeof db>;
   // Cross-user and cross-instance cost guard. No network call inside the transaction.
   await sql`SELECT pg_advisory_xact_lock(817420261022)`;
   const [replay]=await sql`SELECT * FROM socials_video_jobs WHERE requested_by=${i.actor} AND request_key=${i.requestKey}`;
   if(replay){if(replay.fixture_key!==i.fixture.fixture_key)throw new VideoError("Deze aanvraag hoort bij een andere wedstrijd.");return {job:replay as VideoJob,created:false}}
   const [active]=await sql`SELECT * FROM socials_video_jobs WHERE status IN ('submitting','queued','fetching','rendering','uncertain') LIMIT 1`;
   if(active){if(active.fixture_key===i.fixture.fixture_key)return {job:active as VideoJob,created:false};throw new VideoError("Er wordt al een video verwerkt. Wacht tot die opdracht is afgerond.")}
   // A completed render remains the single allowed video even when its temporary download expired.
   const [successful]=await sql`SELECT * FROM socials_video_jobs WHERE fixture_key=${i.fixture.fixture_key} AND status IN ('done','expired') ORDER BY created_at DESC,id DESC LIMIT 1`;
   if(successful)throw new VideoError("Voor deze wedstrijd is al één video gegenereerd. De bestaande video blijft beschikbaar zolang de download beschikbaar is.");
   const [latest]=await sql`SELECT * FROM socials_video_jobs WHERE fixture_key=${i.fixture.fixture_key} ORDER BY created_at DESC,id DESC LIMIT 1`;
   if(i.regenerateOf&&latest?.id!==i.regenerateOf)throw new VideoError("De renderlijst is gewijzigd. Controleer de laatste opdracht opnieuw.");
   if(latest&&!i.regenerateOf&&latest.data_hash===i.hash)return {job:latest as VideoJob,created:false};
   const [job]=await sql`INSERT INTO socials_video_jobs(id,fixture_key,requested_by,request_key,data_hash,template_version,render_data,source_snapshot,source_fixture,status)
    VALUES(${randomUUID()},${i.fixture.fixture_key},${i.actor},${i.requestKey},${i.hash},${VIDEO_TEMPLATE_VERSION},${sql.json(i.data)},${sql.json(i.snapshot)},${sql.json(i.fixture)},'submitting') RETURNING *`;
   return {job:job as VideoJob,created:true};
  })},
  async patch(id,p){const allowed=["status","render_id","output_url","available_until","error","checked_at"] as const;const values:Record<string,unknown>={updated_at:new Date()};for(const key of allowed)if(key in p)values[key]=p[key];const [r]=await db()`UPDATE socials_video_jobs SET ${db()(values)} WHERE id=${id} RETURNING *`;return r as VideoJob},
  async claimCheck(id){const rows=await db()`UPDATE socials_video_jobs SET checked_at=now() WHERE id=${id} AND (checked_at IS NULL OR checked_at<now()-interval '4 seconds') RETURNING id`;return rows.length>0},
 };
}
