import type { KarmaActionEvent, PlatformRequestParser } from "../types";

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

export class DiscordInteractionAdapter
  implements PlatformRequestParser<DiscordInteractionPayload>
{
  public parse(payload: DiscordInteractionPayload): KarmaActionEvent | null {
    const commandName = payload.data?.name;
    if (payload.type !== 2 || commandName !== "karma") {
      return null;
    }

    const actorUserId = payload.member?.user?.id ?? payload.user?.id;
    const channelId = payload.channel_id;
    const targetUserId = optionValue(payload.data?.options, "user");
    const symbolRun = optionValue(payload.data?.options, "action");

    if (!actorUserId || !channelId || !targetUserId || !symbolRun) {
      return null;
    }

    return {
      actorUserId,
      actorMention: `<@${actorUserId}>`,
      targetUserId,
      targetMention: `<@${targetUserId}>`,
      symbolRun,
      channelId
    };
  }
}
