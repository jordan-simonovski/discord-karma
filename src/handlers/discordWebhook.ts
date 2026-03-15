import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { KarmaService } from "../domain/karmaService";
import { randomSnarkPicker } from "../presentation/snark";
import { DynamoKarmaRepository } from "../persistence/dynamoKarmaRepository";
import {
  DiscordInteractionAdapter,
  type DiscordInteractionPayload
} from "../platforms/discord/discordInteractionAdapter";
import { DiscordGuildMembershipChecker } from "../platforms/discord/discordGuildMembershipChecker";
import type { KarmaActionEvent } from "../platforms/types";
import { verifyDiscordSignature } from "../platforms/discord/verifyDiscordSignature";

const MAX_SIGNATURE_AGE_SECONDS = 300;
const sqsClient = new SQSClient({});

interface AsyncRoleKarmaJob {
  action: KarmaActionEvent;
  interactionToken: string;
  applicationId: string;
}

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

function isFreshTimestamp(timestamp: string, nowSeconds: number = Date.now() / 1000): boolean {
  if (!/^\d{1,20}$/.test(timestamp)) {
    return false;
  }

  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) {
    return false;
  }

  return Math.abs(nowSeconds - parsed) <= MAX_SIGNATURE_AGE_SECONDS;
}

function isRoleKarmaAction(action: unknown): action is KarmaActionEvent {
  return (
    typeof action === "object" &&
    action !== null &&
    (action as { kind?: string }).kind === "karma" &&
    typeof (action as { targetRoleId?: unknown }).targetRoleId === "string"
  );
}

async function enqueueRoleKarmaJob(queueUrl: string, job: AsyncRoleKarmaJob): Promise<void> {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(job)
    })
  );
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const tableName = process.env.KARMA_TABLE_NAME;
  const discordPublicKey = process.env.DISCORD_PUBLIC_KEY;
  const discordBotToken = process.env.DISCORD_BOT_TOKEN;
  const asyncQueueUrl = process.env.ASYNC_KARMA_QUEUE_URL;
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
  if (!isFreshTimestamp(timestamp)) {
    return response(401, { error: "stale request timestamp" });
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
      data: {
        content: "Unsupported command. Use /karma or /leaderboard.",
        flags: 64
      }
    });
  }

  if (
    asyncQueueUrl &&
    isRoleKarmaAction(action) &&
    typeof payload.token === "string" &&
    typeof payload.application_id === "string"
  ) {
    try {
      await enqueueRoleKarmaJob(asyncQueueUrl, {
        action,
        interactionToken: payload.token,
        applicationId: payload.application_id
      });
      return response(200, { type: 5 });
    } catch (error) {
      console.error("role_karma_enqueue_failed", {
        error: error instanceof Error ? error.message : "unknown-enqueue-error"
      });
      return response(200, {
        type: 4,
        data: {
          content: "I could not queue that role karma job. Try again in a moment."
        }
      });
    }
  }

  const service = new KarmaService(
    new DynamoKarmaRepository(tableName),
    randomSnarkPicker,
    new DiscordGuildMembershipChecker(discordBotToken)
  );
  const result =
    action.kind === "leaderboard"
      ? await service.handleLeaderboard(action)
      : await service.handleAction(action);

  return response(200, {
    type: 4,
    data: { content: result.message }
  });
}
