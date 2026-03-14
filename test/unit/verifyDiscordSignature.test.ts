import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyDiscordSignature } from "../../src/platforms/discord/verifyDiscordSignature";

describe("verifyDiscordSignature", () => {
  it("accepts valid signature", () => {
    const pair = generateKeyPairSync("ed25519");
    const timestamp = "1710000000";
    const body = '{"type":1}';
    const message = Buffer.from(`${timestamp}${body}`, "utf8");
    const signature = sign(null, message, pair.privateKey);
    const publicKeyDer = pair.publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const publicKeyRaw = publicKeyDer.subarray(publicKeyDer.length - 32);

    const valid = verifyDiscordSignature({
      publicKeyHex: publicKeyRaw.toString("hex"),
      signatureHex: signature.toString("hex"),
      timestamp,
      rawBody: body
    });

    expect(valid).toBe(true);
  });

  it("rejects invalid signature", () => {
    const pair = generateKeyPairSync("ed25519");
    const publicKeyDer = pair.publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const publicKeyRaw = publicKeyDer.subarray(publicKeyDer.length - 32);
    const valid = verifyDiscordSignature({
      publicKeyHex: publicKeyRaw.toString("hex"),
      signatureHex: "00".repeat(64),
      timestamp: "1710000000",
      rawBody: '{"type":1}'
    });

    expect(valid).toBe(false);
  });
});
