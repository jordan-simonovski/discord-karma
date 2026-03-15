import { generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    public send = sendMock;
  },
  SendMessageCommand: class {
    public constructor(public readonly input: unknown) {}
  }
}));

import { handler } from "../../src/handlers/discordWebhook";

describe("discord webhook deferred role handling", () => {
  beforeEach(() => {
    sendMock.mockReset().mockResolvedValue({ MessageId: "m1" });
  });

  it("defers role karma interactions and enqueues async work", async () => {
    const pair = generateKeyPairSync("ed25519");
    const body = JSON.stringify({
      type: 2,
      token: "interaction-token",
      application_id: "app-1",
      guild_id: "g1",
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: {
        name: "karma",
        options: [
          { name: "target", type: 9, value: "r123" },
          { name: "action", type: 3, value: "++++" }
        ],
        resolved: {
          roles: {
            r123: { id: "r123" }
          }
        }
      }
    });
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const message = Buffer.from(`${timestamp}${body}`, "utf8");
    const signature = sign(null, message, pair.privateKey);
    const publicKeyDer = pair.publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const publicKeyRaw = publicKeyDer.subarray(publicKeyDer.length - 32);

    process.env.KARMA_TABLE_NAME = "table";
    process.env.DISCORD_PUBLIC_KEY = publicKeyRaw.toString("hex");
    process.env.ASYNC_KARMA_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/1/q";

    const response = (await handler({
      headers: {
        "x-signature-ed25519": signature.toString("hex"),
        "x-signature-timestamp": timestamp
      },
      body,
      isBase64Encoded: false
    } as never)) as { statusCode: number; body: string };

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(JSON.stringify({ type: 5 }));
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
