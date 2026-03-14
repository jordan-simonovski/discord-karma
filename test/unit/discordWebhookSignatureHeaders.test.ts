import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { handler } from "../../src/handlers/discordWebhook";

describe("discord webhook signature handling", () => {
  it("accepts Discord signature headers regardless of header casing", async () => {
    const pair = generateKeyPairSync("ed25519");
    const body = JSON.stringify({ type: 1 });
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const message = Buffer.from(`${timestamp}${body}`, "utf8");
    const signature = sign(null, message, pair.privateKey);
    const publicKeyDer = pair.publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const publicKeyRaw = publicKeyDer.subarray(publicKeyDer.length - 32);

    process.env.KARMA_TABLE_NAME = "table";
    process.env.DISCORD_PUBLIC_KEY = publicKeyRaw.toString("hex");

    const response = (await handler({
      headers: {
        "X-Signature-Ed25519": signature.toString("hex"),
        "X-Signature-Timestamp": timestamp
      },
      body,
      isBase64Encoded: false
    } as never)) as { statusCode: number; body: string };

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(JSON.stringify({ type: 1 }));
  });

  it("rejects requests with stale timestamps even when signature is valid", async () => {
    const pair = generateKeyPairSync("ed25519");
    const body = JSON.stringify({ type: 1 });
    const timestamp = "1710000000";
    const message = Buffer.from(`${timestamp}${body}`, "utf8");
    const signature = sign(null, message, pair.privateKey);
    const publicKeyDer = pair.publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const publicKeyRaw = publicKeyDer.subarray(publicKeyDer.length - 32);

    process.env.KARMA_TABLE_NAME = "table";
    process.env.DISCORD_PUBLIC_KEY = publicKeyRaw.toString("hex");

    const response = (await handler({
      headers: {
        "X-Signature-Ed25519": signature.toString("hex"),
        "X-Signature-Timestamp": timestamp
      },
      body,
      isBase64Encoded: false
    } as never)) as { statusCode: number; body: string };

    expect(response.statusCode).toBe(401);
    expect(response.body).toContain("stale request timestamp");
  });
});
