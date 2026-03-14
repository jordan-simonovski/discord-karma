import type { LeaderboardScope } from "../platforms/types";

export interface KarmaRecord {
  userId: string;
  karmaTotal: number;
  karmaMax: number;
  lastActivityAt?: string;
}

export interface KarmaRepository {
  applyDelta(guildId: string, userId: string, delta: number): Promise<KarmaRecord>;
  getLeaderboard(
    guildId: string,
    scope: LeaderboardScope,
    limit: number
  ): Promise<KarmaRecord[]>;
}
