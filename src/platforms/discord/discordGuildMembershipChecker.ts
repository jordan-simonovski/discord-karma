import type { GuildMembershipChecker } from "../../domain/karmaService";

export class DiscordGuildMembershipChecker implements GuildMembershipChecker {
  public constructor(private readonly botToken: string | undefined) {}

  public async isUserInGuild(guildId: string, userId: string): Promise<boolean> {
    if (!this.botToken) {
      return false;
    }

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bot ${this.botToken}`
        }
      }
    ).catch(() => null);

    return response?.status === 200;
  }
}
