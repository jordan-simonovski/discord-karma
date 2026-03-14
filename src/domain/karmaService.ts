import type {
  KarmaActionEvent,
  KarmaActionResult,
  LeaderboardEvent
} from "../platforms/types";
import type { KarmaRepository } from "../persistence/karmaRepository";
import type { KarmaRecord } from "../persistence/karmaRepository";
import {
  formatKarmaAppliedMessage,
  formatLeaderboardMessage
} from "../presentation/messages";
import { evaluateKarmaAction, type RejectionReason } from "./karmaRules";
import type { SnarkCategory, SnarkPicker } from "../presentation/snark";

export interface GuildMembershipChecker {
  isUserInGuild(guildId: string, userId: string): Promise<boolean>;
}

const LEADERBOARD_SCAN_LIMIT = 25;
const LEADERBOARD_RESULT_LIMIT = 5;

export class KarmaService {
  public constructor(
    private readonly repository: KarmaRepository,
    private readonly pickSnark: SnarkPicker,
    private readonly guildMembershipChecker: GuildMembershipChecker = {
      isUserInGuild: async () => true
    }
  ) {}

  public async handleAction(event: KarmaActionEvent): Promise<KarmaActionResult> {
    if (event.targetIsBot) {
      return {
        shouldPersist: false,
        message: "Bots cannot receive karma."
      };
    }

    const outcome = evaluateKarmaAction({
      actorUserId: event.actorUserId,
      targetUserId: event.targetUserId,
      symbolRun: event.symbolRun
    });

    if (outcome.kind === "reject") {
      return this.handleRejection(outcome.reason, event.targetMention);
    }

    const record = await this.repository.applyDelta(
      event.guildId,
      event.targetUserId,
      outcome.delta
    );
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
    const entries = await this.repository.getLeaderboard(
      event.guildId,
      event.scope,
      LEADERBOARD_SCAN_LIMIT
    );
    const filteredEntries = await this.filterGuildMembers(event.guildId, entries);
    return {
      shouldPersist: false,
      message: formatLeaderboardMessage(
        event.scope,
        filteredEntries.slice(0, LEADERBOARD_RESULT_LIMIT)
      )
    };
  }

  private async filterGuildMembers(
    guildId: string,
    entries: KarmaRecord[]
  ): Promise<KarmaRecord[]> {
    const checks = await Promise.all(
      entries.map(async (entry) => ({
        entry,
        isMember: await this.guildMembershipChecker.isUserInGuild(guildId, entry.userId)
      }))
    );
    return checks.filter((item) => item.isMember).map((item) => item.entry);
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
