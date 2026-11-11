import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadChunk, uploadTicket } from "../lib/content-hub-drive";

test("uploadchunks are signed, user-bound and forwarded in bounded ranges", async () => {
  const previousSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const originalFetch = globalThis.fetch;
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "test-only-signing-key";
  const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test";
  const ticket = uploadTicket(url, 4, "staff-user");
  const requests: string[] = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(String((init?.headers as Record<string, string>)["Content-Range"]));
    return requests.length === 1
      ? new Response(null, { status: 308, headers: { Range: "bytes=0-1" } })
      : new Response(JSON.stringify({ id: "file-id", size: "4" }), { status: 200 });
  };
  try {
    await assert.rejects(uploadChunk(ticket, "another-user", 0, new Uint8Array(2)));
    await assert.rejects(uploadChunk(`${ticket}x`, "staff-user", 0, new Uint8Array(2)));
    await assert.rejects(uploadChunk(ticket, "staff-user", 3, new Uint8Array(2)));
    assert.deepEqual(await uploadChunk(ticket, "staff-user", 0, new Uint8Array(2)), { complete: false, next: 2 });
    assert.deepEqual(await uploadChunk(ticket, "staff-user", 2, new Uint8Array(2)), { complete: true, file: { id: "file-id", size: "4" } });
    assert.deepEqual(requests, ["bytes 0-1/4", "bytes 2-3/4"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousSecret === undefined) delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    else process.env.GOOGLE_DRIVE_CLIENT_SECRET = previousSecret;
  }
});
