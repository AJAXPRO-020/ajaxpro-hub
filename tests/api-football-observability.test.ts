import assert from "node:assert/strict";
import test from "node:test";
import { apiFootballErrorDetails } from "../lib/api-football-observability";

test("API-Football logging classificeert timeout, HTTP en providerfouten zonder key", () => {
  const headers = new Headers({
    "x-ratelimit-requests-limit": "100",
    "x-ratelimit-requests-remaining": "97",
    "X-RateLimit-Limit": "30",
    "X-RateLimit-Remaining": "29",
  });
  const response = new Response(null, { status: 429, headers });
  assert.deepEqual(apiFootballErrorDetails(new Error("HTTP 429"), response), {
    kind: "http", status: 429, errorName: "Error", message: "HTTP 429",
    dayLimit: "100", dayRemaining: "97", minuteLimit: "30", minuteRemaining: "29",
  });
  assert.equal(apiFootballErrorDetails(Object.assign(new Error("operation timed out"), { name: "TimeoutError" })).kind, "timeout");
  assert.deepEqual(apiFootballErrorDetails(new Error("API-Football returned provider errors"), new Response("{}", { headers }), { limit: "Requests limit reached" }).providerErrors, ["Requests limit reached"]);
});
