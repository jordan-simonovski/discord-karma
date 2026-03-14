import type { KarmaRecord } from "../persistence/karmaRepository";
import type { LeaderboardScope } from "../platforms/types";

export function formatKarmaAppliedMessage(
  targetMention: string,
  delta: number,
  record: KarmaRecord,
  capped: boolean
): string {
  const verb = delta > 0 ? "gained" : "lost";
  const cappedMessage = capped
    ? " **Buzzkill mode enabled:** capped to 5 karma."
    : "";
  return `${cappedMessage}\n${targetMention} ${verb} ${delta} karma. Total: ${record.karmaTotal}. Max: ${record.karmaMax}.`;
}

export function formatBuzzkillMessage(targetMention: string): string {
  return `**Buzzkill mode enabled:** ${targetMention} can only receive between 1 and 5 karma.`;
}

const leaderboardTitles: Record<LeaderboardScope, string> = {
  week: "Weekly karma leaderboard",
  month: "Monthly karma leaderboard",
  all: "All-time karma leaderboard"
};

export function formatLeaderboardMessage(
  scope: LeaderboardScope,
  entries: KarmaRecord[]
): string {
  if (entries.length === 0) {
    return `${leaderboardTitles[scope]}\nNo karma activity yet.`;
  }

  const lines = entries.map(
    (entry, index) => `${index + 1}. <@${entry.userId}> — ${entry.karmaTotal}`
  );
  return `${leaderboardTitles[scope]}\n${lines.join("\n")}`;
}
