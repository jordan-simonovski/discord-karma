# Discord Bot Setup (Proper Interactions)

This guide configures Discord Interactions with request signature verification.

## 1) Create Discord Application and Bot

In [Discord Developer Portal](https://discord.com/developers/applications):

1. Create **New Application**.
2. In **General Information**, copy:
   - `Application ID`
   - `Public Key`
3. In **Bot** tab, click **Add Bot**.
4. Copy the **Bot Token** (used for command registration and leaderboard membership checks).

## 2) Deploy Stack with Discord Public Key and Bot Token

Deploy the application stack and pass `Public Key` + `Bot Token` into CDK parameters:

```bash
npm run build
npx cdk deploy DiscordKarmaStack \
  --parameters DiscordPublicKey=YOUR_DISCORD_PUBLIC_KEY \
  --parameters DiscordBotToken=YOUR_BOT_TOKEN \
  --require-approval never
```

Copy output `DiscordKarmaWebhookUrl`.

## 3) Configure Interactions Endpoint URL

In Discord Developer Portal:

1. Open your application.
2. Go to **General Information**.
3. Set **Interactions Endpoint URL** = `DiscordKarmaWebhookUrl`.
4. Save.

Discord sends a `PING` request first. The endpoint must respond with `PONG` (implemented).

## 4) Register Commands

Register global slash commands for `/karma` and `/leaderboard`.

### `/karma`

Options:

- `user`: target user
- `action`: symbol run (`++`, `+++`, `--`, etc.)

```bash
curl -X POST "https://discord.com/api/v10/applications/YOUR_APPLICATION_ID/commands" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "karma",
    "description": "Give or remove karma",
    "options": [
      {
        "type": 6,
        "name": "user",
        "description": "Target user",
        "required": true
      },
      {
        "type": 3,
        "name": "action",
        "description": "Use ++..++++++ or --..------",
        "required": true
      }
    ]
  }'
```

Global commands can take a few minutes to propagate.

### `/leaderboard`

Options:

- none (always returns all-time top 5)

```bash
curl -X POST "https://discord.com/api/v10/applications/YOUR_APPLICATION_ID/commands" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "leaderboard",
    "description": "Show top 5 karma users"
  }'
```

## 5) Invite Bot to Your Server

In **OAuth2 -> URL Generator**:

- Scopes: `bot`, `applications.commands`
- Bot permissions (minimum): `Send Messages`, `View Channels`

Open generated URL and add the bot.

## 6) Validate Behavior in Discord

Use:

- `/karma user:@someone action:++` -> +1
- `/karma user:@someone action:------` -> -5
- `/karma user:@someone action:+++++++` -> buzzkill rejection
- `/karma user:@yourself action:++` -> snark self-award rejection
- `/karma user:@yourself action:--` -> snark self-remove rejection
- `/leaderboard` -> top 5 users by all-time current karma in this server

## Troubleshooting

- `401 bad signature`:
  - `DiscordPublicKey` is wrong or stale.
  - Re-deploy stack with current public key.
- `Unsupported command. Use /karma or /leaderboard.`:
  - Command name is not `karma` or `leaderboard`.
- Slash command not visible:
  - Wait for global propagation or re-register command.
- Endpoint validation fails in Discord portal:
  - Confirm API Gateway URL is reachable and Lambda is deployed.
