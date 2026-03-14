import type {
  BotCommandEvent,
  KarmaActionEvent,
  LeaderboardEvent,
  LeaderboardScope,
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
  };
}

interface DiscordInteractionMember {
  user?: {
    id?: string;
  };
}

export interface DiscordInteractionPayload {
  type?: number;
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

function leaderboardScope(value: string | null): LeaderboardScope | null {
  if (value === "week" || value === "month" || value === "all") {
    return value;
  }
  return null;
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
      return this.parseLeaderboardCommand(payload, guildId, actorUserId, channelId);
    }

    return null;
  }

  private parseKarmaCommand(
    payload: DiscordInteractionPayload,
    guildId: string,
    actorUserId: string,
    channelId: string
  ): KarmaActionEvent | null {
    const targetUserId = optionValue(payload.data?.options, "user");
    const symbolRun = optionValue(payload.data?.options, "action");
    if (!targetUserId || !symbolRun) {
      return null;
    }
    const resolvedUser = payload.data?.resolved?.users?.[targetUserId];
    if (!resolvedUser || typeof resolvedUser.bot !== "boolean") {
      return null;
    }
    const targetIsBot = resolvedUser.bot;

    return {
      kind: "karma",
      guildId,
      actorUserId,
      actorMention: `<@${actorUserId}>`,
      targetUserId,
      targetMention: `<@${targetUserId}>`,
      targetIsBot,
      symbolRun,
      channelId
    };
  }

  private parseLeaderboardCommand(
    payload: DiscordInteractionPayload,
    guildId: string,
    actorUserId: string,
    channelId: string
  ): LeaderboardEvent | null {
    const scope = leaderboardScope(optionValue(payload.data?.options, "scope"));
    if (!scope) {
      return null;
    }

    return {
      kind: "leaderboard",
      guildId,
      actorUserId,
      actorMention: `<@${actorUserId}>`,
      channelId,
      scope
    };
  }
}
