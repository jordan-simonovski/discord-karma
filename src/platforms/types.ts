export type LeaderboardScope = "week" | "month" | "all";

export interface KarmaActionEvent {
  kind: "karma";
  guildId: string;
  actorUserId: string;
  actorMention: string;
  targetUserId: string;
  targetMention: string;
  targetIsBot: boolean | null;
  symbolRun: string;
  channelId: string;
}

export interface LeaderboardEvent {
  kind: "leaderboard";
  guildId: string;
  actorUserId: string;
  actorMention: string;
  channelId: string;
  scope: LeaderboardScope;
}

export type BotCommandEvent = KarmaActionEvent | LeaderboardEvent;

export interface KarmaActionResult {
  shouldPersist: boolean;
  message: string;
}

export interface PlatformResponse {
  content: string;
}

export interface PlatformRequestParser<TPayload> {
  parse(payload: TPayload): BotCommandEvent | null;
}
