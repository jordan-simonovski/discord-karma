import type { GuildMembershipChecker } from "../../domain/karmaService";

const REQUEST_TIMEOUT_MS = 2000;
const MAX_ATTEMPTS = 2;

export class DiscordGuildMembershipChecker implements GuildMembershipChecker {
  public constructor(private readonly botToken: string | undefined) {}

  public async isUserInGuild(guildId: string, userId: string): Promise<boolean> {
    if (!this.botToken) {
      // Without a token we cannot verify membership; avoid wiping the leaderboard.
      return true;
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bot ${this.botToken}`
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }
      ).catch(() => null);

      if (response?.status === 200) {
        return true;
      }

      if (response?.status === 404) {
        return false;
      }

      if (
        response &&
        response.status !== 429 &&
        (response.status < 500 || response.status > 599)
      ) {
        // Non-retryable but non-authoritative statuses (403/401/etc) are treated
        // as unknown, so we keep leaderboard entries instead of hiding all users.
        return true;
      }
    }

    // Retries exhausted due to network/5xx/429: treat as unknown and keep entry.
    return true;
  }
}
