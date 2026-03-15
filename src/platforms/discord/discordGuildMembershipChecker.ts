import type { GuildMembershipChecker } from "../../domain/karmaService";

const REQUEST_TIMEOUT_MS = 2000;
const MAX_ATTEMPTS = 2;
const GUILD_MEMBER_PAGE_SIZE = 1000;
const ROLE_MEMBER_SCAN_LIMIT = 10000;

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

  public async isUserBot(guildId: string, userId: string): Promise<boolean | null> {
    if (!this.botToken) {
      return null;
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

      if (response?.status === 404) {
        return false;
      }
      if (response?.status === 200) {
        const payload = (await response.json().catch(() => null)) as
          | { user?: { bot?: boolean } }
          | null;
        return typeof payload?.user?.bot === "boolean" ? payload.user.bot : null;
      }

      if (
        response &&
        response.status !== 429 &&
        (response.status < 500 || response.status > 599)
      ) {
        return null;
      }
    }

    return null;
  }

  public async getRoleMemberUserIds(guildId: string, roleId: string): Promise<string[]> {
    if (!this.botToken) {
      return [];
    }

    const matches = new Set<string>();
    let after: string | null = null;
    let scanned = 0;

    while (scanned < ROLE_MEMBER_SCAN_LIMIT) {
      const query = after
        ? `?limit=${GUILD_MEMBER_PAGE_SIZE}&after=${encodeURIComponent(after)}`
        : `?limit=${GUILD_MEMBER_PAGE_SIZE}`;
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members${query}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bot ${this.botToken}`
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }
      ).catch(() => null);

      if (!response || response.status !== 200) {
        return [];
      }

      const payload = (await response.json().catch(() => null)) as
        | Array<{ user?: { id?: string }; roles?: string[] }>
        | null;
      if (!Array.isArray(payload) || payload.length === 0) {
        break;
      }

      for (const member of payload) {
        const userId = member.user?.id;
        if (typeof userId !== "string" || userId.length === 0) {
          continue;
        }
        if (Array.isArray(member.roles) && member.roles.includes(roleId)) {
          matches.add(userId);
        }
      }

      scanned += payload.length;
      const lastUserId = payload[payload.length - 1]?.user?.id;
      if (typeof lastUserId !== "string" || lastUserId.length === 0) {
        break;
      }
      after = lastUserId;
      if (payload.length < GUILD_MEMBER_PAGE_SIZE) {
        break;
      }
    }

    return Array.from(matches);
  }
}
