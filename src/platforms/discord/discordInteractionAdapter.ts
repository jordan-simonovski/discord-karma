import type {
  BotCommandEvent,
  KarmaActionEvent,
  LeaderboardEvent,
  PlatformRequestParser
} from "../types";

interface DiscordOption {
  name: string;
  type: number;
  value?: string;
}

interface DiscordApplicationCommandData {
  name?: string;
  options?: DiscordOption[];
  resolved?: {
    users?: Record<string, { bot?: boolean }>;
    roles?: Record<string, { id?: string }>;
  };
}

interface DiscordInteractionMember {
  user?: {
    id?: string;
  };
}

export interface DiscordInteractionPayload {
  type?: number;
  token?: string;
  application_id?: string;
  guild_id?: string;
  channel_id?: string;
  member?: DiscordInteractionMember;
  user?: {
    id?: string;
  };
  data?: DiscordApplicationCommandData;
}

function optionValue(options: DiscordOption[] | undefined, name: string): string | null {
  const option = options?.find((entry) => entry.name === name);
  return typeof option?.value === "string" ? option.value : null;
}

export class DiscordInteractionAdapter
  implements PlatformRequestParser<DiscordInteractionPayload>
{
  public parse(payload: DiscordInteractionPayload): BotCommandEvent | null {
    const commandName = payload.data?.name;
    if (payload.type !== 2 || !commandName) {
      return null;
    }

    const actorUserId = payload.member?.user?.id ?? payload.user?.id;
    const guildId = payload.guild_id;
    const channelId = payload.channel_id;
    if (!actorUserId || !guildId || !channelId) {
      return null;
    }

    if (commandName === "karma") {
      return this.parseKarmaCommand(payload, guildId, actorUserId, channelId);
    }

    if (commandName === "leaderboard") {
      return this.parseLeaderboardCommand(guildId, actorUserId, channelId);
    }

    return null;
  }

  private parseKarmaCommand(
    payload: DiscordInteractionPayload,
    guildId: string,
    actorUserId: string,
    channelId: string
  ): KarmaActionEvent | null {
    const targetId =
      optionValue(payload.data?.options, "target") ?? optionValue(payload.data?.options, "user");
    const symbolRun = optionValue(payload.data?.options, "action");
    if (!targetId || !symbolRun) {
      return null;
    }
    const resolvedUser = payload.data?.resolved?.users?.[targetId];
    const resolvedRole = payload.data?.resolved?.roles?.[targetId];

    if (resolvedRole) {
      return {
        kind: "karma",
        guildId,
        actorUserId,
        actorMention: `<@${actorUserId}>`,
        targetRoleId: targetId,
        targetRoleMention: `<@&${targetId}>`,
        symbolRun,
        channelId
      };
    }

    const targetIsBot = typeof resolvedUser?.bot === "boolean" ? resolvedUser.bot : null;

    return {
      kind: "karma",
      guildId,
      actorUserId,
      actorMention: `<@${actorUserId}>`,
      targetUserId: targetId,
      targetMention: `<@${targetId}>`,
      targetIsBot,
      symbolRun,
      channelId
    };
  }

  private parseLeaderboardCommand(
    guildId: string,
    actorUserId: string,
    channelId: string
  ): LeaderboardEvent | null {
    return {
      kind: "leaderboard",
      guildId,
      actorUserId,
      actorMention: `<@${actorUserId}>`,
      channelId
    };
  }
}
