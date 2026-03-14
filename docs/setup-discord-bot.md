# Discord Bot Setup (Proper Interactions)

This guide configures Discord Interactions with request signature verification.

## 1) Create Discord Application and Bot

In [Discord Developer Portal](https://discord.com/developers/applications):

1. Create **New Application**.
2. In **General Information**, copy:
   - `Application ID`
   - `Public Key`
3. In **Bot** tab, click **Add Bot**.
4. Copy the **Bot Token** (used only for command registration).

## 2) Deploy Stack with Discord Public Key

Deploy the application stack and pass `Public Key` into the CDK parameter:

```bash
npm run build
npx cdk deploy DiscordKarmaStack \
  --parameters DiscordPublicKey=YOUR_DISCORD_PUBLIC_KEY \
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

- `scope`: leaderboard window (`week`, `month`, `all`)

```bash
curl -X POST "https://discord.com/api/v10/applications/YOUR_APPLICATION_ID/commands" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "leaderboard",
    "description": "Show top 5 karma users",
    "options": [
      {
        "type": 3,
        "name": "scope",
        "description": "Choose leaderboard period",
        "required": true,
        "choices": [
          { "name": "week", "value": "week" },
          { "name": "month", "value": "month" },
          { "name": "all time", "value": "all" }
        ]
      }
    ]
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
- `/leaderboard scope:week` -> top 5 users by current karma, active in last 7 days
- `/leaderboard scope:month` -> top 5 users by current karma, active in last 30 days
- `/leaderboard scope:all time` -> top 5 users by current karma

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
