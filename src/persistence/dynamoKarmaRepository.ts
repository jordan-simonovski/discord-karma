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

export class DynamoKarmaRepository implements KarmaRepository {
  public constructor(
    private readonly tableName: string,
    private readonly client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({})
    )
  ) {}

  public async applyDelta(userId: string, delta: number): Promise<KarmaRecord> {
    const nowIso = new Date().toISOString();
    const totalResult = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          "SET karmaTotal = if_not_exists(karmaTotal, :zero) + :delta, lastActivityAt = :now",
        ExpressionAttributeValues: {
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
        Key: { userId },
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
    scope: LeaderboardScope,
    limit: number
  ): Promise<KarmaRecord[]> {
    const cutoff = this.cutoffIso(scope);
    const scanResult = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        ProjectionExpression: "userId, karmaTotal, karmaMax, lastActivityAt",
        FilterExpression: cutoff
          ? "attribute_exists(lastActivityAt) AND lastActivityAt >= :cutoff"
          : undefined,
        ExpressionAttributeValues: cutoff ? { ":cutoff": cutoff } : undefined
      })
    );

    const records = (scanResult.Items ?? [])
      .map((item) => ({
        userId: typeof item.userId === "string" ? item.userId : "",
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
