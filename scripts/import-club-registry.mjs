import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.HISTORY_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!url) throw new Error("HISTORY_DATABASE_URL of DATABASE_URL ontbreekt");

const registry = JSON.parse(await readFile(new URL("../assets/clubs/registry.json", import.meta.url), "utf8"));
const sql = postgres(url, { max: 1, prepare: false });
const season = "2026/27";

const variants = (name) => {
  const values = new Set([name]);
  for (const prefix of ["FC ", "SC "]) if (name.startsWith(prefix)) values.add(name.slice(prefix.length));
  if (name === "Sparta Rotterdam") values.add("Sparta");
  if (name === "ADO Den Haag") values.add("ADO");
  if (name === "NEC") values.add("N.E.C.");
  return [...values];
};

try {
  await sql.begin(async (tx) => {
    await tx`CREATE TABLE IF NOT EXISTS club_logo_registry (
      club_id text PRIMARY KEY, canonical_name text NOT NULL,
      competition text NOT NULL CHECK (competition IN ('eredivisie','eerste-divisie')),
      season text NOT NULL, logo_path text NOT NULL, source_url text,
      license_info text, external_team_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
      alias_of_club_id text REFERENCES club_logo_registry(club_id),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (club_id, season, competition)
    )`;
    await tx`CREATE TABLE IF NOT EXISTS club_logo_aliases (
      alias_key text PRIMARY KEY, alias text NOT NULL,
      club_id text NOT NULL REFERENCES club_logo_registry(club_id) ON DELETE CASCADE,
      season text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await tx`CREATE INDEX IF NOT EXISTS club_logo_aliases_club_idx ON club_logo_aliases(club_id)`;
    await tx`CREATE OR REPLACE FUNCTION club_name_key(input text) RETURNS text LANGUAGE sql IMMUTABLE AS ${sql`SELECT lower(regexp_replace(trim(coalesce(input, '')), '[^[:alnum:]]+', ' ', 'g'))`}`;
    await tx`CREATE OR REPLACE FUNCTION resolve_club_logo(input_name text, input_team_id text DEFAULT NULL) RETURNS TABLE (club_id text, canonical_name text, logo_path text, competition text, season text) LANGUAGE sql STABLE AS ${sql`SELECT c.club_id, c.canonical_name, c.logo_path, c.competition, c.season FROM club_logo_registry c LEFT JOIN club_logo_aliases a ON a.club_id = c.club_id WHERE (input_team_id IS NOT NULL AND c.external_team_ids ? input_team_id) OR a.alias_key = club_name_key(input_name) ORDER BY c.season DESC, c.competition, c.club_id LIMIT 1`}`;

    for (const club of registry.clubs) {
      const competition = club.competitions[0];
      await tx`INSERT INTO club_logo_registry (club_id, canonical_name, competition, season, logo_path, source_url, license_info, alias_of_club_id)
        VALUES (${club.slug}, ${club.name}, ${competition}, ${season}, ${club.asset}, ${club.sourceUrl ?? ""}, ${club.license ?? ""}, ${club.aliasOf ?? null})
        ON CONFLICT (club_id) DO UPDATE SET canonical_name=excluded.canonical_name, competition=excluded.competition, season=excluded.season, logo_path=excluded.logo_path, source_url=excluded.source_url, license_info=excluded.license_info, alias_of_club_id=excluded.alias_of_club_id, updated_at=now()`;
      for (const alias of variants(club.name)) {
        await tx`INSERT INTO club_logo_aliases (alias_key, alias, club_id, season) VALUES (club_name_key(${alias}), ${alias}, ${club.slug}, ${season}) ON CONFLICT (alias_key) DO UPDATE SET alias=excluded.alias, club_id=excluded.club_id, season=excluded.season`;
      }
    }
  });
} finally {
  await sql.end({ timeout: 5 });
}

console.log(`Imported ${registry.clubs.length} club registrations from registry.json`);
