import {readFileSync} from 'node:fs';
import postgres from 'postgres';
const url=process.env.DATABASE_URL_UNPOOLED?.trim();
if(!url)throw new Error('DATABASE_URL_UNPOOLED ontbreekt. Kies expliciet de bedoelde database.');
const main=async()=>{const sql=postgres(url,{max:1,prepare:false});try{await sql.unsafe(readFileSync('db/migrations/033_socials_video_jobs.sql','utf8'));console.log('033_socials_video_jobs.sql voltooid.')}finally{await sql.end()}};
main().catch(()=>{console.error('Video-migratie mislukt. Controleer de bedoelde database en voorafgaande migraties.');process.exitCode=1});
