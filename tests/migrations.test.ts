import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

test("migratiehistorie behoudt dubbele historische nummers maar kent geen dubbele toekomstnummers", () => {
  const files = readdirSync(new URL("../db/migrations/", import.meta.url));
  const numbers = files.map(file => file.match(/^(\d{3})_.*\.sql$/)?.[1]).filter(Boolean) as string[];
  assert.deepEqual([...new Set(numbers.filter(number => numbers.indexOf(number) !== numbers.lastIndexOf(number)))].sort(), ["016", "027", "031"]);
  const future = files.filter(file => Number(file.slice(0, 3)) >= 36);
  assert.equal(new Set(future.map(file => file.slice(0, 3))).size, future.length);
});

test("migratieregistratie registreert alleen de bevestigde 034-baseline", () => {
  const source = readFileSync(new URL("../db/migrations/035_migration_registry.sql", import.meta.url), "utf8");
  assert.match(source, /CREATE TABLE IF NOT EXISTS schema_migrations/);
  assert.match(source, /034_motm_announcement_delivery\.sql/);
  assert.doesNotMatch(source, /'00[1-9]_|'01[0-9]_|'02[0-9]_|'031_/);
});

test("toekomstige migratierunner vereist expliciete ongebundelde database en host", () => {
  const source = readFileSync(new URL("../scripts/migrate.ts", import.meta.url), "utf8");
  assert.match(source, /DATABASE_URL_UNPOOLED/);
  assert.match(source, /MIGRATION_TARGET_DATABASE/);
  assert.match(source, /MIGRATION_TARGET_HOST/);
  assert.match(source, /checksum_sha256/);
  assert.match(source, /Number\(match\[1\]\) >= 36/);
});
