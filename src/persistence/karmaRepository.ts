export interface KarmaRecord {
  userId: string;
  karmaTotal: number;
  karmaMax: number;
  lastActivityAt?: string;
}

export interface KarmaRepository {
  applyDelta(guildId: string, userId: string, delta: number): Promise<KarmaRecord>;
  getLeaderboard(guildId: string, limit: number): Promise<KarmaRecord[]>;
}
