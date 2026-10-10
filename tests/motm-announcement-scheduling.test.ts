import assert from "node:assert/strict";
import test from "node:test";

test("automatische aankondiging opent een geplande stemming zonder bezoek en verstuurt maar eenmaal", async () => {
  const dbPath = require.resolve("../lib/motm-db");
  const originalDb = require(dbPath);
  const originalFetch = globalThis.fetch;
  const originalWebhook = process.env.DISCORD_MOTM_ANNOUNCEMENT_WEBHOOK;
  const kickoff = new Date(Date.now() - 100 * 60_000);
  let match = {
    id: "test-match", slug: "test-match", status: "draft", deleted_at: null,
    opponent: "NEC", home_or_away: "home", kickoff_at: kickoff,
    scheduled_open_at: kickoff, scheduled_close_at: new Date(Date.now() + 60 * 60_000),
    announcement_sent_at: null as Date | null,
  };
  let sends = 0;
  const sql: any = async (parts: TemplateStringsArray, ...values: any[]) => {
    const query = parts.join("?");
    if (query.includes("INSERT INTO motm_audit_log")) return [];
    if (query.includes("UPDATE motm_matches SET announcement_sent_at")) {
      match = { ...match, announcement_sent_at: new Date() };
      return [{ id: match.id }];
    }
    if (query.includes("UPDATE motm_matches SET status")) {
      match = { ...match, status: values[0] };
      return [{ ...match }];
    }
    if (query.includes("SELECT * FROM motm_matches WHERE id=")) return [{ ...match }];
    if (query.includes("status <> 'closed'")) return match.status === "draft" ? [{ ...match }] : [];
    if (query.includes("status='open'")) return match.status === "open" ? [{ ...match }] : [];
    throw new Error(`Unexpected query: ${query}`);
  };
  sql.begin = async (callback: any) => callback(sql);
  sql.json = (value: unknown) => value;
  require.cache[dbPath]!.exports = { ...originalDb, db: () => sql };
  process.env.DISCORD_MOTM_ANNOUNCEMENT_WEBHOOK = "https://example.invalid/test-webhook";
  globalThis.fetch = async () => { sends++; return new Response(null, { status: 204 }); };
  try {
    const { sendAutomaticAnnouncement } = require("../lib/motm-announcements");
    const fixture = { kickoff_at: kickoff, home_team: "Ajax", away_team: "NEC", elapsed: 80, provider_status: "2H" };
    assert.equal((await sendAutomaticAnnouncement(fixture, "https://ajaxpro.fans/api/next-match")).status, "sent");
    assert.equal(match.status, "open");
    assert.equal((await sendAutomaticAnnouncement(fixture, "https://ajaxpro.fans/api/next-match")).status, "already_sent");
    assert.equal(sends, 1);
  } finally {
    require.cache[dbPath]!.exports = originalDb;
    globalThis.fetch = originalFetch;
    if (originalWebhook === undefined) delete process.env.DISCORD_MOTM_ANNOUNCEMENT_WEBHOOK;
    else process.env.DISCORD_MOTM_ANNOUNCEMENT_WEBHOOK = originalWebhook;
  }
});
