import type { FotMobSocialsMatch } from "./fotmob-socials-parser";
import { db } from "./motm-db";
import { teamNamesMatch } from "./team-name-match";

export type SocialsMatchStatsSnapshot = FotMobSocialsMatch & {
  fixtureKey: string;
};

const asSnapshot=(fixtureKey:string,value:unknown):SocialsMatchStatsSnapshot|null=>{
  const snapshot=typeof value==="string"?JSON.parse(value):value;
  if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return null;
  return {fixtureKey,...snapshot as FotMobSocialsMatch};
};

export const loadSocialsStatsAvailability=async(fixtureKeys:readonly string[])=>{
  if(!fixtureKeys.length)return new Set<string>();
  const rows=await db()`SELECT s.fixture_key,s.snapshot,f.home_team,f.away_team,f.goals_home,f.goals_away,f.kickoff_at
    FROM socials_match_stats_snapshots s JOIN matchday_fixtures f ON f.fixture_key=s.fixture_key
    WHERE s.fixture_key = ANY(${[...fixtureKeys]})`;
  return new Set(rows.filter(row=>{try{const snapshot=typeof row.snapshot==="string"?JSON.parse(row.snapshot):row.snapshot;const match=snapshot?.match;if(!match)return false;const date=new Date(match.date??"").toISOString().slice(0,10),kickoff=new Date(row.kickoff_at).toISOString().slice(0,10);return teamNamesMatch(String(match.homeTeam??""),String(row.home_team??""))&&teamNamesMatch(String(match.awayTeam??""),String(row.away_team??""))&&date===kickoff&&Number(match.homeScore)===Number(row.goals_home)&&Number(match.awayScore)===Number(row.goals_away)}catch{return false}}).map(row=>String(row.fixture_key)));
};

export const loadSocialsStoredStatsKeys=async(fixtureKeys:readonly string[])=>{
  if(!fixtureKeys.length)return new Set<string>();
  const rows=await db()`SELECT fixture_key FROM socials_match_stats_snapshots WHERE fixture_key = ANY(${[...fixtureKeys]})`;
  return new Set(rows.map(row=>String(row.fixture_key)));
};

export const loadSocialsMatchStatsSnapshot=async(fixtureKey:string)=>{
  const [row]=await db()`SELECT snapshot FROM socials_match_stats_snapshots WHERE fixture_key=${fixtureKey} LIMIT 1`;
  if(!row)return null;
  const snapshot=asSnapshot(fixtureKey,row.snapshot);
  return snapshot;
};

export const saveSocialsMatchStatsSnapshot=async(snapshot:SocialsMatchStatsSnapshot)=>{
  if(snapshot.match.fotmobId===null)throw new Error("FotMob-wedstrijd-ID ontbreekt.");
  const {fixtureKey,...normalized}=snapshot,sql=db();
  await sql`INSERT INTO socials_match_stats_snapshots(fixture_key,fotmob_match_id,snapshot,imported_at,updated_at)
    VALUES(${fixtureKey},${snapshot.match.fotmobId},${sql.json(normalized)},now(),now())
    ON CONFLICT(fixture_key) DO UPDATE SET fotmob_match_id=excluded.fotmob_match_id,snapshot=excluded.snapshot,imported_at=now(),updated_at=now()`;
  return {fixtureKey,...normalized};
};
