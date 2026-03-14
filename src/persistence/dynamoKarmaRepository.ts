import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import type { KarmaRecord, KarmaRepository } from "./karmaRepository";

function scopedUserId(guildId: string, userId: string): string {
  return `${guildId}#${userId}`;
}

const LEADERBOARD_QUERY_PAGE_SIZE = 25;

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
          "SET guildId = :guildId, discordUserId = :discordUserId, karmaTotal = if_not_exists(karmaTotal, :zero) + :delta, lastActivityAt = :now",
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
    limit: number
  ): Promise<KarmaRecord[]> {
    const queryRecords = await this.queryLeaderboardByIndex(guildId, limit);
    if (queryRecords.length > 0) {
      return queryRecords;
    }

    // Fallback keeps compatibility while the new GSI is deploying.
    return this.scanLeaderboardFallback(guildId, limit);
  }

  private async queryLeaderboardByIndex(
    guildId: string,
    limit: number
  ): Promise<KarmaRecord[]> {
    const results: KarmaRecord[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const queryResult = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "GuildKarmaTotalIndex",
          KeyConditionExpression: "guildId = :guildId",
          ExpressionAttributeValues: { ":guildId": guildId },
          ProjectionExpression: "discordUserId, karmaTotal, karmaMax, lastActivityAt",
          ScanIndexForward: false,
          Limit: LEADERBOARD_QUERY_PAGE_SIZE,
          ExclusiveStartKey: exclusiveStartKey
        })
      );

      const pageItems = (queryResult.Items ?? [])
        .map((item) => ({
          userId: this.readDiscordUserId(item),
          karmaTotal: Number(item.karmaTotal ?? 0),
          karmaMax: Number(item.karmaMax ?? 0),
          lastActivityAt:
            typeof item.lastActivityAt === "string" ? item.lastActivityAt : undefined
        }))
        .filter((item) => item.userId.length > 0);

      results.push(...pageItems);
      exclusiveStartKey = queryResult.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (results.length < limit && exclusiveStartKey);

    return results.slice(0, limit);
  }

  private async scanLeaderboardFallback(
    guildId: string,
    limit: number
  ): Promise<KarmaRecord[]> {
    const scanResult = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        ProjectionExpression:
          "discordUserId, guildId, karmaTotal, karmaMax, lastActivityAt",
        FilterExpression: "guildId = :guildId",
        ExpressionAttributeValues: { ":guildId": guildId }
      })
    );

    return (scanResult.Items ?? [])
      .map((item) => ({
        userId: this.readDiscordUserId(item),
        karmaTotal: Number(item.karmaTotal ?? 0),
        karmaMax: Number(item.karmaMax ?? 0),
        lastActivityAt:
          typeof item.lastActivityAt === "string" ? item.lastActivityAt : undefined
      }))
      .filter((item) => item.userId.length > 0)
      .sort((left, right) => right.karmaTotal - left.karmaTotal)
      .slice(0, limit);
  }

  private readDiscordUserId(item: Record<string, unknown>): string {
    if (typeof item.discordUserId === "string" && item.discordUserId.length > 0) {
      return item.discordUserId;
    }

    // Backward compatibility for rows written before discordUserId existed.
    if (typeof item.userId === "string") {
      const splitIndex = item.userId.lastIndexOf("#");
      if (splitIndex > -1 && splitIndex + 1 < item.userId.length) {
        return item.userId.slice(splitIndex + 1);
      }
    }

    return "";
  }
}
