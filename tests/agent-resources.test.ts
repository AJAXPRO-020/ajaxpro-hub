import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { GET as playersGET } from "../api/motm-public";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const spec = JSON.parse(read("openapi.json"));

// Validate the schema features used in our published response contracts.
function matches(value: unknown, schema: any): boolean {
  if (schema.$ref) return matches(value, spec.components.schemas[schema.$ref.split("/").pop()]);
  if (schema.anyOf) return schema.anyOf.some((item: any) => matches(value, item));
  if (schema.oneOf) return schema.oneOf.filter((item: any) => matches(value, item)).length === 1;
  if (schema.enum && !schema.enum.includes(value)) return false;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (!types.includes(type) && !(types.includes("integer") && Number.isInteger(value))) return false;
  if (type === "array") return (value as unknown[]).every(item => matches(item, schema.items));
  if (type === "object") {
    const row = value as Record<string, unknown>;
    return (schema.required ?? []).every((key: string) => key in row)
      && Object.entries(schema.properties ?? {}).every(([key, property]) => !(key in row) || matches(row[key], property));
  }
  return true;
}

test("OpenAPI describes only existing public read routes with unique operation IDs", () => {
  assert.equal(spec.openapi, "3.1.1");
  assert.deepEqual(spec.security, []);
  assert.deepEqual(Object.keys(spec.paths).sort(), ["/api/next-match", "/api/players"]);
  const ids = new Set();
  for (const path of Object.values(spec.paths) as any[]) {
    assert.deepEqual(Object.keys(path), ["get"]);
    const operation = path.get;
    assert.ok(operation.description);
    assert.ok(operation.operationId);
    assert.ok(!ids.has(operation.operationId));
    ids.add(operation.operationId);
    assert.ok(operation.responses["200"].content["application/json"].schema);
    for (const parameter of operation.parameters) assert.ok(parameter.schema.type && parameter.description);
  }
  for (const match of JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)) {
    assert.ok(spec.components.schemas[match[1]], `Unresolved reference: ${match[1]}`);
  }
  const config = JSON.parse(read("vercel.json"));
  assert.ok(config.rewrites.some((route: any) => route.source === "/api/players" && route.destination === "/api/motm-public?action=players"));
  assert.ok(existsSync(new URL("../api/next-match.ts", import.meta.url)));
});

test("documented public player response omits Members-only contract data", async () => {
  const savedDatabase = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await playersGET(new Request("https://www.ajaxpro.fans/api/motm-public?action=players"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    const body = await response.json();
    assert.ok(matches(body, spec.components.schemas.PlayersResponse));
    assert.ok(body.players.length > 0);
    assert.ok(body.players.every((player: any) => player.active));
    assert.ok(body.players.every((player: any) => !Object.keys(player).some((key) => /^(contract|loan|arrival)/i.test(key))));
    assert.equal(matches({ players: [{ id: 123 }], updatedAt: "" }, spec.components.schemas.PlayersResponse), false);
    const denied = await playersGET(new Request("https://www.ajaxpro.fans/api/motm-public?action=players&include=contracts"));
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get("Cache-Control"), "private, no-store");
  } finally {
    if (savedDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedDatabase;
  }
});

test("match documentation supports empty program, null-match fallback and rate-limit errors", () => {
  const responses = spec.paths["/api/next-match"].get.responses;
  const schema = responses["200"].content["application/json"].schema;
  const updatedAt = new Date(0).toISOString();
  assert.ok(matches({ fixtures: [], updatedAt }, schema));
  assert.ok(matches({ match: null, message: "Geen wedstrijd beschikbaar", updatedAt }, schema));
  assert.equal(matches({ fixtures: null, updatedAt }, schema), false);
  assert.ok(matches({ error: "Te veel verzoeken" }, responses["429"].content["application/json"].schema));
  assert.ok(responses["429"].headers["Retry-After"]);
});

test("agent discovery and 404 recovery links resolve to public local resources", () => {
  const llms = read("llms.txt");
  assert.match(llms, /^# AjaxPro\n\n> /);
  assert.match(llms, /## Wanneer gebruiken/);
  for (const section of llms.split(/^## /m).slice(1)) {
    for (const line of section.split("\n").slice(1).filter(line => line.trim())) {
      assert.match(line, /^- \[[^\]]+\]\(https:\/\/[^)]+\)/);
    }
  }
  for (const path of ["llms.txt", "openapi.json", "sitemap.xml"]) {
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)));
    assert.ok(read("404.html").includes(`href="/${path}"`));
  }
  assert.match(llms, /https:\/\/www\.ajaxpro\.fans\/openapi\.json/);
  assert.match(read("index.html"), /rel="describedby" href="\/llms.txt"/);
  assert.match(read("index.html"), /rel="service-desc" href="\/openapi.json"/);
  assert.match(read("index.html"), /class="header-login" href="https:\/\/ajaxpro\.fans\/club">Inloggen<\/a>/);
  assert.match(read("404.html"), /href="\/styles.css"/);
});
