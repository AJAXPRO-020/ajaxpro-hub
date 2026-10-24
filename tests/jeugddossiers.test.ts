import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { esc } from "../lib/motm-view";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../api-impl/jeugddossiers.ts");

test("Jeugddossiers vereist portal.access en gebruikt geen publiek data-endpoint", () => {
  assert.match(source, /getSessionWithCurrentRoles\(request\)/);
  assert.match(source, /permissions\.membersAccess/);
  assert.match(source, /permissions\.jeugddossiersManage/);
  assert.match(source, /redirect\(`\/api\/auth\/discord-login/);
});

test("zoeken gebruikt naam en aliases en zonder zoekterm featured eerst", () => {
  assert.match(source, /name ILIKE/);
  assert.match(source, /unnest\(aliases\)/);
  assert.match(source, /ORDER BY featured DESC,featured_order NULLS LAST,name/);
});

test("dossierroute haalt op id op en behandelt ontbrekende speler", () => {
  assert.match(source, /SELECT \* FROM youth_dossiers WHERE id=\$\{id\}/);
  assert.match(source, /Speler niet gevonden/);
});

test("gebruikersdata wordt escaped voordat deze in HTML komt", () => {
  assert.equal(esc(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("routes en migratie zijn aanwezig", () => {
  const config = JSON.parse(read("../vercel.json"));
  assert.equal(config.rewrites.find((route: any) => route.source === "/club/jeugddossiers")?.destination, "/api/jeugddossiers");
  assert.equal(config.rewrites.find((route: any) => route.source === "/club/jeugddossiers/speler/:id")?.destination, "/api/jeugddossiers?id=:id");
  assert.match(read("../db/migrations/029_jeugddossiers.sql"), /CREATE TABLE IF NOT EXISTS youth_dossiers/);
});

test("beheercontract staat uitsluitend beperkte foto-updates toe", () => {
  const manage = read("../api-impl/jeugddossiers-manage.ts");
  assert.match(manage, /editorialPhotoUpdate/);
  assert.match(manage, /editorial\.photo/);
  assert.match(manage, /validPhoto/);
  assert.match(manage, /foto bijgewerkt/);
});

test("beheerimport bewaart de bestaande editorial-foto wanneer geen update is meegestuurd", () => {
  const manage = read("../api-impl/jeugddossiers-manage.ts");
  assert.match(manage, /photo=\$\{u\.editorialPhotoUpdate\?tx\.json\(u\.editorialPhotoUpdate\):old\.photo\}/);
});
