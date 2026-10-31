import assert from "node:assert/strict";
import test from "node:test";
import { systemStatusMarkup } from "../lib/system-status";

const cards = [
  { id: "motm", title: "MOTM", tone: "ok" as const, label: "In orde", summary: "Geen actuele problemen." },
  { id: "discord", title: "Discord", tone: "attention" as const, label: "Controle nodig", summary: "Een melding vraagt aandacht.", detail: "Controleer Discord.", href: "/club/motm/beheer", hrefLabel: "Open MOTM-beheer" },
  { id: "video", title: "Video Generator", tone: "ok" as const, label: "Actief", summary: "Een render wordt verwerkt." },
  { id: "football", title: "API-Football", tone: "unknown" as const, label: "Onbekend", summary: "Quota niet beschikbaar." },
  { id: "database", title: "Database", tone: "ok" as const, label: "Bereikbaar", summary: "Migraties geregistreerd." },
];

test("systeemstatus toont actuele aandacht, bestaande herstelroute en onzekere status", () => {
  const html = systemStatusMarkup(cards);
  assert.match(html, /1 aandachtspunt vraagt controle/);
  assert.match(html, /class="system-status-card system-status-card--attention"/);
  assert.match(html, /href="\/club\/motm\/beheer"/);
  assert.match(html, /system-status-card--unknown/);
  assert.match(html, /GitHub Actions ↗/);
});
