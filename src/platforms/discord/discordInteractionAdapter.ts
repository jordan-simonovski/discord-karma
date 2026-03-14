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
}

interface DiscordInteractionMember {
  user?: {
    id?: string;
  };
}

export interface DiscordInteractionPayload {
  type?: number;
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
    const channelId = payload.channel_id;
    if (!actorUserId || !channelId) {
      return null;
    }

    if (commandName === "karma") {
      return this.parseKarmaCommand(payload, actorUserId, channelId);
    }

    if (commandName === "leaderboard") {
      return this.parseLeaderboardCommand(payload, actorUserId, channelId);
    }

    return null;
  }

  private parseKarmaCommand(
    payload: DiscordInteractionPayload,
    actorUserId: string,
    channelId: string
  ): KarmaActionEvent | null {
    const targetUserId = optionValue(payload.data?.options, "user");
    const symbolRun = optionValue(payload.data?.options, "action");
    if (!targetUserId || !symbolRun) {
      return null;
    }

    return {
      kind: "karma",
      actorUserId,
      actorMention: `<@${actorUserId}>`,
      targetUserId,
      targetMention: `<@${targetUserId}>`,
      symbolRun,
      channelId
    };
  }

  private parseLeaderboardCommand(
    payload: DiscordInteractionPayload,
    actorUserId: string,
    channelId: string
  ): LeaderboardEvent | null {
    const scope = leaderboardScope(optionValue(payload.data?.options, "scope"));
    if (!scope) {
      return null;
    }

    return {
      kind: "leaderboard",
      actorUserId,
      actorMention: `<@${actorUserId}>`,
      channelId,
      scope
    };
  }
}
