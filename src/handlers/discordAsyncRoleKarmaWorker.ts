import type { SQSEvent } from "aws-lambda";
import { KarmaService } from "../domain/karmaService";
import { DynamoKarmaRepository } from "../persistence/dynamoKarmaRepository";
import { randomSnarkPicker } from "../presentation/snark";
import type { KarmaActionEvent } from "../platforms/types";
import { DiscordGuildMembershipChecker } from "../platforms/discord/discordGuildMembershipChecker";

interface AsyncRoleKarmaJob {
  action: KarmaActionEvent;
  interactionToken: string;
  applicationId: string;
}

const DISCORD_MESSAGE_LIMIT = 1900;

function splitDiscordMessage(content: string): string[] {
  if (content.length <= DISCORD_MESSAGE_LIMIT) {
    return [content];
  }

  const chunks: string[] = [];
  let current = "";
  const lines = content.split("\n");
  for (const line of lines) {
    const candidate = current.length === 0 ? line : `${current}\n${line}`;
    if (candidate.length <= DISCORD_MESSAGE_LIMIT) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      chunks.push(current);
      current = "";
    }
    if (line.length <= DISCORD_MESSAGE_LIMIT) {
      current = line;
      continue;
    }
    let offset = 0;
    while (offset < line.length) {
      chunks.push(line.slice(offset, offset + DISCORD_MESSAGE_LIMIT));
      offset += DISCORD_MESSAGE_LIMIT;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

async function updateOriginalResponse(
  applicationId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content })
    }
  );
  if (!response.ok) {
    throw new Error(`discord-followup-patch-failed-${response.status}`);
  }
}

async function postFollowupMessage(
  applicationId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content })
    }
  );
  if (!response.ok) {
    throw new Error(`discord-followup-post-failed-${response.status}`);
  }
}

async function publishInteractionResponse(
  applicationId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  const chunks = splitDiscordMessage(content);
  await updateOriginalResponse(applicationId, interactionToken, chunks[0] ?? "");
  for (let i = 1; i < chunks.length; i += 1) {
    await postFollowupMessage(applicationId, interactionToken, chunks[i] as string);
  }
}

function parseRecordBody(recordBody: string): AsyncRoleKarmaJob {
  const parsed = JSON.parse(recordBody) as Partial<AsyncRoleKarmaJob>;
  if (
    !parsed ||
    typeof parsed.applicationId !== "string" ||
    typeof parsed.interactionToken !== "string" ||
    !parsed.action
  ) {
    throw new Error("invalid-async-role-karma-job-payload");
  }
  return parsed as AsyncRoleKarmaJob;
}

export async function handler(event: SQSEvent): Promise<void> {
  const tableName = process.env.KARMA_TABLE_NAME;
  const discordBotToken = process.env.DISCORD_BOT_TOKEN;
  if (!tableName) {
    throw new Error("missing-karma-table-name");
  }

  const service = new KarmaService(
    new DynamoKarmaRepository(tableName),
    randomSnarkPicker,
    new DiscordGuildMembershipChecker(discordBotToken)
  );

  for (const record of event.Records) {
    const job = parseRecordBody(record.body);
    const result = await service.handleAction(job.action);
    await publishInteractionResponse(job.applicationId, job.interactionToken, result.message);
  }
}

