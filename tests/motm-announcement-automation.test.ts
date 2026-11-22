import assert from "node:assert/strict";
import test from "node:test";
import { sendAnnouncement } from "../lib/motm-announcements";

test("Discord onderscheidt bekende fouten van onbekende ontvangst", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 400 });
    assert.deepEqual(await sendAnnouncement("https://example.invalid/test-webhook", "tekst", "https://ajaxpro.fans/stem/test"), { status: "failed", error: "Discord webhook mislukt (400)" });
    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.deepEqual(await sendAnnouncement("https://example.invalid/test-webhook", "tekst", "https://ajaxpro.fans/stem/test"), { status: "unknown", error: "Discord webhook mislukt (503)" });
    globalThis.fetch = async () => { throw new Error("timeout"); };
    assert.deepEqual(await sendAnnouncement("https://example.invalid/test-webhook", "tekst", "https://ajaxpro.fans/stem/test"), { status: "unknown", error: "timeout" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
