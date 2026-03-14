export interface KarmaRecord {
  userId: string;
  karmaTotal: number;
  karmaMax: number;
}

export interface KarmaRepository {
  applyDelta(userId: string, delta: number): Promise<KarmaRecord>;
}
