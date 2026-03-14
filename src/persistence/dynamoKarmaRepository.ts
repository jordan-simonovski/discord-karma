import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import type { KarmaRecord, KarmaRepository } from "./karmaRepository";

export class DynamoKarmaRepository implements KarmaRepository {
  public constructor(
    private readonly tableName: string,
    private readonly client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({})
    )
  ) {}

  public async applyDelta(userId: string, delta: number): Promise<KarmaRecord> {
    const totalResult = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          "SET karmaTotal = if_not_exists(karmaTotal, :zero) + :delta",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":delta": delta
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
      karmaMax
    };
  }
}
