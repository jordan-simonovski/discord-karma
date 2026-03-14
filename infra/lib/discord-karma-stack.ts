import * as path from "node:path";
import { Stack, type StackProps, CfnOutput, Duration, CfnParameter } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import {
  Runtime,
  Architecture,
  Code,
  Function as LambdaFunction
} from "aws-cdk-lib/aws-lambda";
import {
  Cors,
  LambdaIntegration,
  RestApi
} from "aws-cdk-lib/aws-apigateway";
import type { Construct } from "constructs";

export class DiscordKarmaStack extends Stack {
  public constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const discordPublicKey = new CfnParameter(this, "DiscordPublicKey", {
      type: "String",
      description: "Discord application public key used to verify interactions"
    });
    const discordBotToken = new CfnParameter(this, "DiscordBotToken", {
      type: "String",
      description: "Discord bot token used for guild membership checks"
    });

    const table = new Table(this, "KarmaTable", {
      partitionKey: { name: "userId", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST
    });

    const handler = new LambdaFunction(this, "DiscordKarmaHandler", {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: "src/handlers/discordWebhook.handler",
      code: Code.fromAsset(path.join(process.cwd(), "dist")),
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        KARMA_TABLE_NAME: table.tableName,
        DISCORD_PUBLIC_KEY: discordPublicKey.valueAsString,
        DISCORD_BOT_TOKEN: discordBotToken.valueAsString
      }
    });

    table.grantReadWriteData(handler);

    const api = new RestApi(this, "DiscordKarmaApi", {
      restApiName: "discord-karma-api",
      deployOptions: {
        stageName: "prod"
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: ["POST", "OPTIONS"]
      }
    });

    const discordResource = api.root.addResource("discord");
    discordResource.addMethod("POST", new LambdaIntegration(handler));

    new CfnOutput(this, "DiscordKarmaWebhookUrl", {
      value: `${api.url}discord`
    });

    new CfnOutput(this, "KarmaTableName", {
      value: table.tableName
    });
  }
}
