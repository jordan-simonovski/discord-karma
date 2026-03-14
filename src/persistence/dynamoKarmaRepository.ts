import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import type { KarmaRecord, KarmaRepository } from "./karmaRepository";
import type { LeaderboardScope } from "../platforms/types";

function scopedUserId(guildId: string, userId: string): string {
  return `${guildId}#${userId}`;
}

export class DynamoKarmaRepository implements KarmaRepository {
  public constructor(
    private readonly tableName: string,
    private readonly client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({})
    )
  ) {}

  public async applyDelta(
    guildId: string,
    userId: string,
    delta: number
  ): Promise<KarmaRecord> {
    const nowIso = new Date().toISOString();
    const scopedId = scopedUserId(guildId, userId);
    const totalResult = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId: scopedId },
        UpdateExpression:
          "SET guildId = if_not_exists(guildId, :guildId), discordUserId = if_not_exists(discordUserId, :discordUserId), karmaTotal = if_not_exists(karmaTotal, :zero) + :delta, lastActivityAt = :now",
        ExpressionAttributeValues: {
          ":guildId": guildId,
          ":discordUserId": userId,
          ":zero": 0,
          ":delta": delta,
          ":now": nowIso
        },
        ReturnValues: "ALL_NEW"
      })
    );

    const karmaTotal = Number(totalResult.Attributes?.karmaTotal ?? 0);

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId: scopedId },
        UpdateExpression: "SET karmaMax = :newMax",
        ConditionExpression:
          "attribute_not_exists(karmaMax) OR karmaMax < :newMax",
        ExpressionAttributeValues: {
          ":newMax": karmaTotal
        }
      })
    ).catch((error: unknown) => {
      const err = error as { name?: string };
      if (err.name !== "ConditionalCheckFailedException") {
        throw error;
      }
    });

    const karmaMax = Math.max(
      Number(totalResult.Attributes?.karmaMax ?? karmaTotal),
      karmaTotal
    );

    return {
      userId,
      karmaTotal,
      karmaMax,
      lastActivityAt: nowIso
    };
  }

  public async getLeaderboard(
    guildId: string,
    scope: LeaderboardScope,
    limit: number
  ): Promise<KarmaRecord[]> {
    const cutoff = this.cutoffIso(scope);
    const filterExpression = cutoff
      ? "guildId = :guildId AND attribute_exists(lastActivityAt) AND lastActivityAt >= :cutoff"
      : "guildId = :guildId";
    const scanResult = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        ProjectionExpression:
          "userId, discordUserId, guildId, karmaTotal, karmaMax, lastActivityAt",
        FilterExpression: filterExpression,
        ExpressionAttributeValues: cutoff
          ? { ":guildId": guildId, ":cutoff": cutoff }
          : { ":guildId": guildId }
      })
    );

    const records = (scanResult.Items ?? [])
      .map((item) => ({
        userId:
          typeof item.discordUserId === "string"
            ? item.discordUserId
            : typeof item.userId === "string" && item.userId.includes("#")
              ? item.userId.slice(item.userId.indexOf("#") + 1)
              : "",
        karmaTotal: Number(item.karmaTotal ?? 0),
        karmaMax: Number(item.karmaMax ?? 0),
        lastActivityAt:
          typeof item.lastActivityAt === "string" ? item.lastActivityAt : undefined
      }))
      .filter((item) => item.userId.length > 0)
      .sort((left, right) => right.karmaTotal - left.karmaTotal);

    return records.slice(0, limit);
  }

  private cutoffIso(scope: LeaderboardScope): string | null {
    if (scope === "all") {
      return null;
    }

    const now = Date.now();
    const periodDays = scope === "week" ? 7 : 30;
    return new Date(now - periodDays * 24 * 60 * 60 * 1000).toISOString();
  }
}
