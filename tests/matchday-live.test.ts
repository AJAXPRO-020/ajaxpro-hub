import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  amsterdamDateKey,
  amsterdamLocalToUtc,
  countdownParts,
} from "../lib/matchday-live";
import { parseAjaxFixtures, parseAjaxResults } from "../api/next-match";
import { NEXT_MATCH_RATE_LIMIT_MAX, NEXT_MATCH_RATE_LIMIT_WINDOW_SECONDS, nextMatchSourceHash } from "../lib/next-match-rate-limit";

test("Amsterdamse aftraptijd volgt zomer- en wintertijd", () => {
  assert.equal(amsterdamLocalToUtc(2026, 1, 15, 20, 0).toISOString(), "2026-01-15T19:00:00.000Z");
  assert.equal(amsterdamLocalToUtc(2026, 8, 15, 20, 0).toISOString(), "2026-08-15T18:00:00.000Z");
  assert.equal(amsterdamDateKey(new Date("2026-08-05T22:30:00Z")), "2026-08-06");
});

test("countdown ondersteunt meerdere dagen, minder dan een uur en wordt nooit negatief", () => {
  const now = new Date("2026-08-05T10:00:00Z");
  assert.deepEqual(countdownParts("2026-08-07T12:43:00Z", now), { days: 2, hours: 2, minutes: 43, totalMilliseconds: 182_580_000 });
  assert.equal(countdownParts("2026-08-05T10:43:00Z", now).minutes, 43);
  assert.equal(countdownParts("2026-08-05T09:00:00Z", now).totalMilliseconds, 0);
});

test("officiële Ajax-uitslagen worden als noodfallback uitgelezen", () => {
  const html = `<table><tbody><tr>
    <td class="table-cell match-page__result-cell">06.08.26</td>
    <td class="table-cell match-page__result-cell">Ajax</td>
    <td class="table-cell match-page__result-cell">3 - 1</td>
    <td class="table-cell match-page__result-cell">Shelbourne FC</td>
    <td class="table-cell match-page__result-cell"></td>
  </tr></tbody></table>`;
  assert.deepEqual(parseAjaxResults(html), [{ date: "2026-08-06", home: "Ajax", away: "Shelbourne FC", goalsHome: 3, goalsAway: 1 }]);
});

test("officieel programma leest teams uit wedstrijdtekst wanneer een clublogo ontbreekt", () => {
  const fixture = (date: string, home: string, away: string, ajaxLogoSide: "home" | "away") => `<li class="matches-block__match">
    <span class="matches-block__club-logo">${ajaxLogoSide === "home" ? '<img alt="Ajax">' : ""}</span>
    <div class="matches-block__match-info">
      <span class="matches-block__league">UEFA Conference League</span>
      <span class="matches-block__date">${date}</span>
      <span class="matches-block__participants matches-block__participants--present">
        ${home}<span class="matches-block__versus"> - </span>${away}
      </span>
    </div>
    <span class="matches-block__club-logo">${ajaxLogoSide === "away" ? '<img alt="Ajax">' : ""}</span>
  </li>`;
  const html = [
    fixture("do. 15 oktober 2026 18:45", "Hajduk", "Ajax", "away"),
    fixture("do. 22 oktober 2026 21:00", "Ajax", "Atalanta", "home"),
    fixture("do. 26 november 2026 18:45", "Ajax", "Thun", "home"),
    fixture("do. 17 december 2026 21:00", "Ajax", "Getafe", "home"),
  ].join("");

  assert.deepEqual(parseAjaxFixtures(html).map(({ home, away }) => ({ home, away })), [
    { home: "Hajduk", away: "Ajax" },
    { home: "Ajax", away: "Atalanta" },
    { home: "Ajax", away: "Thun" },
    { home: "Ajax", away: "Getafe" },
  ]);
});

test("matchday gebruikt alleen eigen bronnen en toont geen live providerdata", () => {
  const endpoint = readFileSync(new URL("../api/next-match.ts", import.meta.url), "utf8");
  const frontend = readFileSync(new URL("../script.js", import.meta.url), "utf8");
  assert.match(endpoint, /stale-if-error=86400/);
  assert.match(endpoint, /Vercel-CDN-Cache-Control/);
  assert.match(endpoint, /consumeNextMatchRateLimit\(request\)/);
  assert.doesNotMatch(endpoint, /api-sports|API_FOOTBALL|x-apisports|refreshProviderState|matchday_api_budget/);
  assert.doesNotMatch(frontend, /api-sports|API_FOOTBALL_KEY|is-live|match\.minute|match\.score/);
  assert.match(frontend, /fetch\("\/api\/next-match"/);
});

test("publieke matchday-route begrenst cache-bypass per gehashte bron", () => {
  const endpoint = readFileSync(new URL("../api/next-match.ts", import.meta.url), "utf8");
  const limiter = readFileSync(new URL("../lib/next-match-rate-limit.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../db/migrations/011_next_match_rate_limits.sql", import.meta.url), "utf8");
  const first = new Request("https://ajaxpro.fans/api/next-match", { headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" } });
  const same = new Request("https://ajaxpro.fans/api/next-match?bypass=1", { headers: { "x-forwarded-for": "203.0.113.8" } });
  const other = new Request("https://ajaxpro.fans/api/next-match", { headers: { "x-forwarded-for": "203.0.113.9" } });

  assert.equal(NEXT_MATCH_RATE_LIMIT_MAX, 60);
  assert.equal(NEXT_MATCH_RATE_LIMIT_WINDOW_SECONDS, 60);
  assert.equal(nextMatchSourceHash(first, "test-secret"), nextMatchSourceHash(same, "test-secret"));
  assert.notEqual(nextMatchSourceHash(first, "test-secret"), nextMatchSourceHash(other, "test-secret"));
  assert.doesNotMatch(nextMatchSourceHash(first, "test-secret"), /203\.0\.113\.8/);
  assert.match(limiter, /ON CONFLICT\(source_hash\) DO UPDATE/);
  assert.match(limiter, /clock_timestamp\(\)/);
  assert.match(migration, /source_hash TEXT PRIMARY KEY/);
  assert.match(endpoint, /429/);
  assert.match(endpoint, /Retry-After/);
  assert.match(endpoint, /private, no-store/);
});
