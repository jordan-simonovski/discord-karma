export interface KarmaActionEvent {
  actorUserId: string;
  actorMention: string;
  targetUserId: string;
  targetMention: string;
  symbolRun: string;
  channelId: string;
}

export interface KarmaActionResult {
  shouldPersist: boolean;
  message: string;
}

export interface PlatformResponse {
  content: string;
}

export interface PlatformRequestParser<TPayload> {
  parse(payload: TPayload): KarmaActionEvent | null;
}
