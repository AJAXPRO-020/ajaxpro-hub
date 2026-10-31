import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSystemStatusReport, footballStatusCard, systemStatusMarkup } from "../lib/system-status";

const cards = [
  { id: "motm", title: "MOTM", tone: "ok" as const, label: "In orde", summary: "Geen actuele problemen.", diagnostics: [{ label: "Actuele stemmingen", value: "0" }], manualAction: "Nee" as const },
  { id: "discord", title: "Discord", tone: "attention" as const, label: "Controle nodig", summary: "Een melding vraagt aandacht.", detail: "Controleer Discord.", href: "/club/motm/beheer", hrefLabel: "Open MOTM-beheer", diagnostics: [{ label: "Foutcategorie", value: "Status niet bevestigd" }], manualAction: "Ja" as const },
  { id: "video", title: "Video Generator", tone: "ok" as const, label: "Actief", summary: "Een render wordt verwerkt.", diagnostics: [], manualAction: "Nee" as const },
  { id: "football", title: "API-Football", tone: "unknown" as const, label: "Onbekend", summary: "Quota niet beschikbaar.", diagnostics: [{ label: "Quota", value: "Niet betrouwbaar beschikbaar" }], manualAction: "Nee" as const },
  { id: "database", title: "Database", tone: "ok" as const, label: "Bereikbaar", summary: "Migraties geregistreerd.", diagnostics: [], manualAction: "Nee" as const },
];

test("systeemstatus toont actuele aandacht, bestaande herstelroute en onzekere status", () => {
  const html = systemStatusMarkup(cards);
  assert.match(html, /class="system-status-overall system-status-overall--attention" role="status">1 aandachtspunt<\/span>/);
  assert.match(html, /class="system-status-card system-status-card--attention"/);
  assert.match(html, /href="\/club\/motm\/beheer"/);
  assert.match(html, /system-status-card--unknown/);
  assert.equal((html.match(/<details class="system-status-card__diagnostics">/g) ?? []).length, 5);
  assert.match(html, /data-copy-system-report>Kopieer systeemrapport/);
  assert.doesNotMatch(html, /system-status-summary|system-status-attention/);
  assert.match(html, />GitHub Actions<\/a>/);
});

test("productiebouw publiceert de systeemstatus-assets", () => {
  const buildScript = readFileSync(new URL("../scripts/build-public.mjs", import.meta.url), "utf8");
  assert.match(buildScript, /"system-status\.css"/);
  assert.match(buildScript, /"system-status\.js"/);
});

test("rapport bevat vijf systemen, technische context en de analyseopdracht", () => {
  const report = buildSystemStatusReport(cards, new Date("2026-10-31T12:00:00Z"));
  for (const title of ["MOTM", "Discord", "Video Generator", "API-Football", "Database"]) assert.match(report, new RegExp(`\\[${title.replace("-", "\\-")}\\]`));
  assert.match(report, /Tijdzone: Europe\/Amsterdam/);
  assert.match(report, /Actuele aandachtspunten: Discord/);
  assert.match(report, /Handmatige actie noodzakelijk: Ja/);
  assert.match(report, /Geef maximaal drie prioriteiten/);
});

test("rapport schermt geheimen, connectionstrings en stackregels af", () => {
  const unsafe = [{ ...cards[0], detail: "API_KEY=super-secret", diagnostics: [{ label: "Database", value: "postgres://user:password@host/db" }, { label: "Trace", value: "    at handler (/app/api.js:2:3)" }] }];
  const report = buildSystemStatusReport(unsafe);
  assert.doesNotMatch(report, /super-secret|postgres:\/\/user|handler \(/);
  assert.match(report, /\[afgeschermd\]/);
});

test("een beschikbare refresh is zonder providerfout geen waarschuwing", () => {
  const value = footballStatusCard({ provider_status: "NS", last_success_at: null, next_refresh_at: "2026-10-31T10:00:00Z", finished_at: null }, new Date("2026-10-31T12:00:00Z").getTime());
  assert.equal(value.tone, "unknown");
  assert.equal(value.manualAction, "Nee");
});

test("systeemstatus blijft achter bestaande staffautorisatie", () => {
  const route = readFileSync(new URL("../api/club-tools.ts", import.meta.url), "utf8");
  assert.match(route, /getSessionWithPermission\(request,permissions\.staffAccess\)/);
  assert.match(route, /view==="system-status"/);
});

test("systeemstatus vat een gezonde kaartenset compact samen", () => {
  const healthyCards = cards.map(card => ({ ...card, tone: "ok" as const }));
  const html = systemStatusMarkup(healthyCards);
  assert.match(html, /system-status-overall--ok" role="status">Alles in orde<\/span>/);
});
