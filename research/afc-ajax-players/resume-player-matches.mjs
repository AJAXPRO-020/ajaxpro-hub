import postgres from 'postgres';
const source=postgres(process.env.SOURCE_DATABASE_URL,{max:4,prepare:false});
const target=postgres(process.env.TARGET_DATABASE_URL,{max:4,prepare:false});
const rows=await source`SELECT player_local_id,match_id,player_data,source_record_count FROM player_matches`;
for(let i=0;i<rows.length;i+=5000){const b=rows.slice(i,i+5000);await target`INSERT INTO player_matches ${target(b)} ON CONFLICT DO NOTHING`;console.log(i+b.length)}
await source.end(); await target.end();
