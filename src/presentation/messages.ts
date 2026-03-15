import type { KarmaRecord } from "../persistence/karmaRepository";

export function formatKarmaAppliedMessage(
  targetMention: string,
  delta: number,
  record: KarmaRecord,
  capped: boolean
): string {
  const verb = delta > 0 ? "gained" : "lost";
  const line = `${targetMention} ${verb} ${delta} karma. Total: ${record.karmaTotal}. Max: ${record.karmaMax}.`;
  if (!capped) {
    return line;
  }
  return `**Buzzkill mode enabled:** capped to 5 karma.\n${line}`;
}

export function formatBuzzkillMessage(targetMention: string): string {
  return `**Buzzkill mode enabled:** ${targetMention} can only receive between 1 and 5 karma.`;
}

export function formatLeaderboardMessage(entries: KarmaRecord[]): string {
  if (entries.length === 0) {
    return "All-time karma leaderboard\nNo karma activity yet.";
  }

  const lines = entries.map(
    (entry, index) => `${index + 1}. <@${entry.userId}> — ${entry.karmaTotal}`
  );
  return `All-time karma leaderboard\n${lines.join("\n")}`;
}
