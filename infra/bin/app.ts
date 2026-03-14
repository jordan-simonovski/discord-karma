#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DiscordKarmaStack } from "../lib/discord-karma-stack";
import { GitHubOidcRoleStack } from "../lib/github-oidc-role-stack";

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-1";

new DiscordKarmaStack(app, "DiscordKarmaStack", {
  env: {
    account,
    region
  }
});

const githubRepo = app.node.tryGetContext("githubRepo");
if (typeof githubRepo === "string" && githubRepo.length > 0) {
  new GitHubOidcRoleStack(app, "DiscordKarmaGithubOidcRoleStack", {
    env: {
      account,
      region
    },
    githubRepo
  });
}
