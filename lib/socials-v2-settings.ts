import { db } from './motm-db';

export const SOCIALS_V2_GENERATORS = new Set(['stats','shots-map','notable-stat','outblinker','top-three','card-video','quote','ajax-vandaag']);
export type SocialsV2Setting = {fixtureKey:string;generatorId:string;settings:Record<string,unknown>;version:number;updatedAt:string;updatedBy:string|null};

const validKey=(value:string)=>value.length>0&&value.length<=240&&!/[\u0000-\u001f]/.test(value);
const parseRow=(row:any):SocialsV2Setting=>({fixtureKey:String(row.fixture_key),generatorId:String(row.generator_id),settings:row.settings??{},version:Number(row.version),updatedAt:new Date(row.updated_at).toISOString(),updatedBy:row.updated_by_discord_user_id??null});

export const loadSocialsV2Settings=async(fixtureKey:string)=>{
  if(!validKey(fixtureKey))throw new RangeError('Ongeldige wedstrijd.');
  const rows=await db()`SELECT fixture_key,generator_id,settings,version,updated_at,updated_by_discord_user_id FROM socials_v2_editor_settings WHERE fixture_key=${fixtureKey} ORDER BY generator_id`;
  return rows.map(parseRow);
};

export const saveSocialsV2Settings=async(input:{fixtureKey:string;generatorId:string;settings:Record<string,unknown>;baseVersion:number;actorDiscordUserId:string})=>{
  if(!validKey(input.fixtureKey)||!SOCIALS_V2_GENERATORS.has(input.generatorId))throw new RangeError('Ongeldige editorinstellingen.');
  const encoded=JSON.stringify(input.settings);
  if(encoded.length>50_000)throw new RangeError('De editorinstellingen zijn te groot.');
  const jsonSettings=JSON.parse(encoded);
  const sql=db();
  if(input.baseVersion===0){
    const [created]=await sql`INSERT INTO socials_v2_editor_settings(fixture_key,generator_id,settings,updated_by_discord_user_id) VALUES(${input.fixtureKey},${input.generatorId},${sql.json(jsonSettings)},${input.actorDiscordUserId}) ON CONFLICT (fixture_key,generator_id) DO NOTHING RETURNING *`;
    if(created)return parseRow(created);
  }else{
    const [updated]=await sql`UPDATE socials_v2_editor_settings SET settings=${sql.json(jsonSettings)},version=version+1,updated_by_discord_user_id=${input.actorDiscordUserId},updated_at=now() WHERE fixture_key=${input.fixtureKey} AND generator_id=${input.generatorId} AND version=${input.baseVersion} RETURNING *`;
    if(updated)return parseRow(updated);
  }
  const [current]=await sql`SELECT * FROM socials_v2_editor_settings WHERE fixture_key=${input.fixtureKey} AND generator_id=${input.generatorId}`;
  return current?{conflict:true as const,current:parseRow(current)}:{conflict:true as const,current:null};
};
