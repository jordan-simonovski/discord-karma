import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { KarmaService } from "../domain/karmaService";
import { randomSnarkPicker } from "../presentation/snark";
import { DynamoKarmaRepository } from "../persistence/dynamoKarmaRepository";
import {
  DiscordInteractionAdapter,
  type DiscordInteractionPayload
} from "../platforms/discord/discordInteractionAdapter";
import { verifyDiscordSignature } from "../platforms/discord/verifyDiscordSignature";

function readPayload(rawBody: string): DiscordInteractionPayload | null {
  try {
    return JSON.parse(rawBody) as DiscordInteractionPayload;
  } catch {
    return null;
  }
}

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function headerValue(
  headers: Record<string, string | undefined>,
  key: string
): string | null {
  const target = key.toLowerCase();
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === target && typeof value === "string") {
      return value;
    }
  }
  return null;
}

function rawBodyFromEvent(event: APIGatewayProxyEventV2): string | null {
  if (!event.body) {
    return null;
  }

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }

  return event.body;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const tableName = process.env.KARMA_TABLE_NAME;
  const discordPublicKey = process.env.DISCORD_PUBLIC_KEY;
  const signature = headerValue(event.headers, "x-signature-ed25519");
  const timestamp = headerValue(event.headers, "x-signature-timestamp");
  const rawBody = rawBodyFromEvent(event);

  if (!tableName) {
    return response(500, {
      type: 4,
      data: { content: "Server misconfigured: missing KARMA_TABLE_NAME.", flags: 64 }
    });
  }

  if (!discordPublicKey) {
    return response(500, {
      type: 4,
      data: { content: "Server misconfigured: missing DISCORD_PUBLIC_KEY.", flags: 64 }
    });
  }

  if (!signature || !timestamp || !rawBody) {
    return response(401, { error: "invalid request signature" });
  }

  const isValid = verifyDiscordSignature({
    publicKeyHex: discordPublicKey,
    signatureHex: signature,
    timestamp,
    rawBody
  });
  if (!isValid) {
    return response(401, { error: "bad signature" });
  }

  const payload = readPayload(rawBody);
  if (!payload || typeof payload.type !== "number") {
    return response(400, { error: "invalid interaction payload" });
  }

  if (payload.type === 1) {
    return response(200, { type: 1 });
  }

  const adapter = new DiscordInteractionAdapter();
  const action = adapter.parse(payload);
  if (!action) {
    return response(200, {
      type: 4,
      data: { content: "Unsupported command. Use /karma.", flags: 64 }
    });
  }

  const service = new KarmaService(
    new DynamoKarmaRepository(tableName),
    randomSnarkPicker
  );
  const result = await service.handleAction(action);

  return response(200, {
    type: 4,
    data: { content: result.message }
  });
}
