import test from "node:test";
import assert from "node:assert/strict";
import { createRcpClient } from "../sdk/node/index.js";

test("node SDK assigns a user, runs the treatment callback, and reports metrics", async () => {
  const calls = [];
  const client = createRcpClient({
    controlPlaneUrl: "http://control-plane.local",
    experimentId: "ranking-v2",
    service: "target-search",
    releaseSha: "abc123",
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });

      if (url.endsWith("/api/assignments")) {
        return jsonResponse({
          experimentId: "ranking-v2",
          userId: "user-1",
          bucketNumber: 42,
          included: true,
          variant: "treatment"
        });
      }

      if (url.endsWith("/api/metrics/events")) {
        return jsonResponse({ ok: true });
      }

      throw new Error(`Unexpected URL ${url}`);
    }
  });

  const output = await client.runExperiment({
    userId: "user-1",
    route: "/search",
    control: () => ({ statusCode: 200, conversion: true }),
    treatment: () => ({ statusCode: 503, conversion: false, completion: false })
  });

  assert.equal(output.assignment.variant, "treatment");
  assert.equal(output.result.statusCode, 503);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { experimentId: "ranking-v2", userId: "user-1" });
  assert.equal(calls[1].body.experimentId, "ranking-v2");
  assert.equal(calls[1].body.bucket, "treatment");
  assert.equal(calls[1].body.service, "target-search");
  assert.equal(calls[1].body.releaseSha, "abc123");
  assert.equal(calls[1].body.statusCode, 503);
  assert.equal(calls[1].body.completion, false);
  assert.equal(typeof calls[1].body.durationMs, "number");
});

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  };
}
