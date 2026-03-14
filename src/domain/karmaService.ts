import type {
  KarmaActionEvent,
  KarmaActionResult,
  LeaderboardEvent
} from "../platforms/types";
import type { KarmaRepository } from "../persistence/karmaRepository";
import {
  formatKarmaAppliedMessage,
  formatLeaderboardMessage
} from "../presentation/messages";
import { evaluateKarmaAction, type RejectionReason } from "./karmaRules";
import type { SnarkCategory, SnarkPicker } from "../presentation/snark";

export class KarmaService {
  public constructor(
    private readonly repository: KarmaRepository,
    private readonly pickSnark: SnarkPicker
  ) {}

  public async handleAction(event: KarmaActionEvent): Promise<KarmaActionResult> {
    const outcome = evaluateKarmaAction({
      actorUserId: event.actorUserId,
      targetUserId: event.targetUserId,
      symbolRun: event.symbolRun
    });

    if (outcome.kind === "reject") {
      return this.handleRejection(outcome.reason, event.targetMention);
    }

    const record = await this.repository.applyDelta(event.targetUserId, outcome.delta);
    return {
      shouldPersist: true,
      message: formatKarmaAppliedMessage(
        event.targetMention,
        outcome.delta,
        record,
        outcome.capped
      )
    };
  }

  public async handleLeaderboard(
    event: LeaderboardEvent
  ): Promise<KarmaActionResult> {
    const entries = await this.repository.getLeaderboard(event.scope, 5);
    return {
      shouldPersist: false,
      message: formatLeaderboardMessage(event.scope, entries)
    };
  }

  private handleRejection(
    reason: RejectionReason,
    targetMention: string
  ): KarmaActionResult {
    if (reason === "self_award" || reason === "self_remove") {
      return {
        shouldPersist: false,
        message: this.pickSnark(reason)
      };
    }

    return {
      shouldPersist: false,
      message: "Invalid karma command. Use @user ++ to @user ++++++ or -- to ------."
    };
  }
}
