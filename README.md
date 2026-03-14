# Discord Karma

Serverless Discord karma bot on AWS Lambda + API Gateway + DynamoDB.

## Karma Rules

- Give karma: `@user ++` through `@user ++++++` maps to `+1` through `+5`.
- Remove karma: `@user --` through `@user ------` maps to `-1` through `-5`.
- More than 6 symbols in one run triggers buzzkill mode (rejected, no write).
- Users cannot give themselves karma.
- Users cannot remove karma from themselves.
- Self-actions return randomized snark replies.

## Architecture

- Core rules and service are platform-agnostic.
- Discord interaction parsing lives in `src/platforms/discord/discordInteractionAdapter.ts`.
- Persistence is behind `KarmaRepository`.
- DynamoDB implementation is `DynamoKarmaRepository`.

## Local Development

```bash
npm ci
npm test
npm run build
```

## Deploy with CDK (manual)

1. Build Lambda assets:

```bash
npm run build
```

2. Bootstrap account/region once:

```bash
npm run cdk:bootstrap
```

3. Deploy application stack:

```bash
npm run cdk:deploy -- DiscordKarmaStack --parameters DiscordPublicKey=YOUR_DISCORD_PUBLIC_KEY --parameters DiscordBotToken=YOUR_BOT_TOKEN
```

## Setup Guides

- [GitHub OIDC deployment setup](docs/setup-github-oidc.md)
- [Discord bot setup](docs/setup-discord-bot.md)

## GitHub Actions OIDC Deploy

The workflow is `.github/workflows/deploy.yml` and deploys on `main`.

Required GitHub repository settings:

- Variables:
  - `AWS_REGION` (example: `us-east-1`)
  - `AWS_ACCOUNT_ID`
- Secret:
  - `AWS_DEPLOY_ROLE_ARN`
  - `DISCORD_PUBLIC_KEY`
  - `DISCORD_BOT_TOKEN`

Create the OIDC role stack (once), replacing `owner/repo`:

```bash
npm run build
npx cdk deploy DiscordKarmaGithubOidcRoleStack -c githubRepo=owner/repo --require-approval never
```

Use the output `GitHubActionsDeployRoleArn` for `AWS_DEPLOY_ROLE_ARN`.

## Discord Webhook Endpoint

After deploying `DiscordKarmaStack`, use output `DiscordKarmaWebhookUrl` as your Discord Interactions endpoint URL.
