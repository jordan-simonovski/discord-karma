export type RejectionReason =
  | "invalid_format"
  | "buzzkill"
  | "self_award"
  | "self_remove";

export type KarmaRuleOutcome =
  | { kind: "apply"; delta: number; capped: boolean }
  | { kind: "reject"; reason: RejectionReason };

export interface EvaluateInput {
  actorUserId: string;
  targetUserId: string;
  symbolRun: string;
}

const MIN_SYMBOL_COUNT = 2;
const MAX_SYMBOL_COUNT = 6;

export function evaluateKarmaAction(input: EvaluateInput): KarmaRuleOutcome {
  const trimmed = input.symbolRun.trim();
  const plusMatch = /^\++$/.test(trimmed);
  const minusMatch = /^\-+$/.test(trimmed);

  if (!plusMatch && !minusMatch) {
    return { kind: "reject", reason: "invalid_format" };
  }

  const symbolCount = trimmed.length;
  if (symbolCount < MIN_SYMBOL_COUNT) {
    return { kind: "reject", reason: "invalid_format" };
  }

  if (input.actorUserId === input.targetUserId) {
    return {
      kind: "reject",
      reason: plusMatch ? "self_award" : "self_remove"
    };
  }

  const cappedSymbolCount = Math.min(symbolCount, MAX_SYMBOL_COUNT);
  const points = cappedSymbolCount - 1;
  return {
    kind: "apply",
    delta: plusMatch ? points : points * -1,
    capped: symbolCount > MAX_SYMBOL_COUNT
  };
}
