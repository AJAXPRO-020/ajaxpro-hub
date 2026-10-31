import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED?.trim();
const targetDatabase = process.env.MIGRATION_TARGET_DATABASE?.trim();
const targetHost = process.env.MIGRATION_TARGET_HOST?.trim();
if (!url || !targetDatabase || !targetHost) {
  throw new Error("Gebruik DATABASE_URL_UNPOOLED, MIGRATION_TARGET_DATABASE en MIGRATION_TARGET_HOST expliciet.");
}

const parsed = new URL(url);
if (parsed.hostname !== targetHost) throw new Error("DATABASE_URL_UNPOOLED hoort niet bij MIGRATION_TARGET_HOST.");

const migrationDirectory = new URL("../db/migrations/", import.meta.url);
const futureMigration = /^([0-9]{3})_[a-z0-9_-]+\.sql$/;

const main = async () => {
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const [identity] = await sql`SELECT current_database() AS database_name`;
    if (identity?.database_name !== targetDatabase) throw new Error("De verbonden database is niet MIGRATION_TARGET_DATABASE.");
    const files = (await readdir(migrationDirectory)).sort();
    const future = files.filter(file => {
      const match = file.match(futureMigration);
      return match && Number(match[1]) >= 36;
    });
    const numbers = new Set<number>();
    for (const file of future) {
      const number = Number(file.slice(0, 3));
      if (numbers.has(number)) throw new Error(`Dubbel toekomstig migratienummer: ${number}`);
      numbers.add(number);
    }
    for (const file of future) {
      const contents = await readFile(join(migrationDirectory.pathname, file), "utf8");
      const checksum = createHash("sha256").update(contents).digest("hex");
      await sql.begin(async tx => {
        await tx`SELECT pg_advisory_xact_lock(817420261023)`;
        const [existing] = await tx`SELECT checksum_sha256 FROM schema_migrations WHERE migration_name=${file}`;
        if (existing) {
          if (existing.checksum_sha256 !== checksum) throw new Error(`Checksum gewijzigd voor ${file}`);
          return;
        }
        await tx.unsafe(contents);
        await tx`INSERT INTO schema_migrations(migration_name,checksum_sha256,applied_by) VALUES(${file},${checksum},current_user)`;
      });
      console.log(`${basename(file)} voltooid.`);
    }
    if (!future.length) console.log("Geen nieuwe migraties.");
  } finally {
    await sql.end();
  }
};

main().catch(error => { console.error(error instanceof Error ? error.message : "Migraties mislukt."); process.exitCode = 1; });
