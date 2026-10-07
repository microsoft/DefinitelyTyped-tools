import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { createHmac } from "crypto";
import { execFileSync } from "child_process";
import path from "path";
import { verifyIsFromGitHub } from "../util/verify";

describe("verifyIsFromGitHub", () => {
  const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const secret = "webhook-test-secret";
  const body = { action: "opened" };

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.GITHUB_WEBHOOK_SECRET;
    } else {
      process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
    }
  });

  function headersFor(payload: unknown) {
    const signature = createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
    return new Headers({ "x-hub-signature-256": `sha256=${signature}` });
  }

  it("accepts a valid signature", async () => {
    assert.equal(await verifyIsFromGitHub(headersFor(body), body), true);
  });

  it("rejects a signature for a different payload", async () => {
    assert.equal(await verifyIsFromGitHub(headersFor(body), { action: "closed" }), false);
  });

  it("preserves the import-only dependency in compiled CommonJS output", () => {
    const modulePath = path.resolve(__dirname, "../../dist/util/verify.js");
    const headers = Object.fromEntries(headersFor(body));
    const output = execFileSync(
      process.execPath,
      [
        "-e",
        `require(${JSON.stringify(modulePath)}).verifyIsFromGitHub(new Headers(${JSON.stringify(headers)}), ${JSON.stringify(body)}).then(valid => console.log(valid));`,
      ],
      { encoding: "utf8", env: { ...process.env, GITHUB_WEBHOOK_SECRET: secret } },
    );
    assert.equal(output.trim(), "true");
  });
});
