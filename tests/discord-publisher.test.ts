import assert from "node:assert/strict";
import test from "node:test";
import { sendDiscordWebhook } from "../lib/discord-publisher";

test("Discord publisher stuurt tekst en bestand als multipart webhook-payload", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let request: Request | undefined;
    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ id: "message-1" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const result = await sendDiscordWebhook("https://discord.com/api/webhooks/1/token", {
      text: "Hallo AjaxPro",
      attachment: { data: new TextEncoder().encode("file"), filename: "test.png", mimeType: "image/png" },
    });
    assert.deepEqual(result, { status: "sent", messageId: "message-1" });
    assert.equal(request?.method, "POST");
    assert.match(request?.url ?? "", /wait=true/);
    assert.equal(request?.headers.get("content-type")?.startsWith("multipart/form-data"), true);
    const form = await request?.formData();
    assert.equal(form?.get("files[0]") instanceof File, true);
    assert.match(String(form?.get("payload_json")), /Hallo AjaxPro/);
  } finally { globalThis.fetch = originalFetch; }
});

test("Discord publisher onderscheidt permanente en onzekere fouten", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 400 });
    assert.deepEqual(await sendDiscordWebhook("https://discord.com/api/webhooks/1/token", { text: "tekst" }), { status: "failed", error: "Discord-publicatie mislukt (400)" });
    globalThis.fetch = async () => new Response(null, { status: 429 });
    assert.deepEqual(await sendDiscordWebhook("https://discord.com/api/webhooks/1/token", { text: "tekst" }), { status: "unknown", error: "Discord-publicatie mislukt (429)" });
    globalThis.fetch = async () => { throw new Error("timeout"); };
    assert.deepEqual(await sendDiscordWebhook("https://discord.com/api/webhooks/1/token", { text: "tekst" }), { status: "unknown", error: "timeout" });
  } finally { globalThis.fetch = originalFetch; }
});

test("Discord 429 bewaart de servergestuurde wachttijd", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 429, headers: { "retry-after": "12.5" } });
    assert.deepEqual(await sendDiscordWebhook("https://discord.com/api/webhooks/1/token", { text: "tekst" }), { status: "unknown", error: "Discord-publicatie mislukt (429)", retryAfterSeconds: 12.5 });
  } finally { globalThis.fetch = originalFetch; }
});
