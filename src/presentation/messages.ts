import type { KarmaRecord } from "../persistence/karmaRepository";

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
  return `${targetMention} ${verb} ${delta} karma. Total: ${record.karmaTotal}. Max: ${record.karmaMax}.${cappedMessage}`;
}

export function formatBuzzkillMessage(targetMention: string): string {
  return `**Buzzkill mode enabled:** ${targetMention} can only receive between 1 and 5 karma.`;
}
