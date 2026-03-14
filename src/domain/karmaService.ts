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
  isUserBot(guildId: string, userId: string): Promise<boolean | null>;
}

const LEADERBOARD_SCAN_LIMIT = 25;
const LEADERBOARD_RESULT_LIMIT = 5;
const MEMBERSHIP_CHECK_BATCH_SIZE = 5;

export class KarmaService {
  public constructor(
    private readonly repository: KarmaRepository,
    private readonly pickSnark: SnarkPicker,
    private readonly guildMembershipChecker: GuildMembershipChecker = {
      isUserInGuild: async () => true,
      isUserBot: async () => null
    }
  ) {}

  public async handleAction(event: KarmaActionEvent): Promise<KarmaActionResult> {
    const targetIsBot =
      event.targetIsBot ??
      (await this.guildMembershipChecker.isUserBot(event.guildId, event.targetUserId));
    if (targetIsBot) {
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
    console.info("leaderboard:repo_entries", {
      guildId: event.guildId,
      scope: event.scope,
      count: entries.length
    });
    const filteredEntries = await this.filterGuildMembers(event.guildId, entries);
    console.info("leaderboard:filtered_entries", {
      guildId: event.guildId,
      scope: event.scope,
      count: filteredEntries.length
    });
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
    const checks: Array<{ entry: KarmaRecord; isMember: boolean }> = [];
    for (let i = 0; i < entries.length; i += MEMBERSHIP_CHECK_BATCH_SIZE) {
      const batch = entries.slice(i, i + MEMBERSHIP_CHECK_BATCH_SIZE);
      const batchChecks = await Promise.all(
        batch.map(async (entry) => ({
          entry,
          isMember: await this.guildMembershipChecker.isUserInGuild(guildId, entry.userId)
        }))
      );
      console.info("leaderboard:membership_batch", {
        guildId,
        checked: batch.length,
        passed: batchChecks.filter((item) => item.isMember).length
      });
      checks.push(...batchChecks);
    }

    const filtered = checks.filter((item) => item.isMember).map((item) => item.entry);
    if (entries.length > 0 && filtered.length === 0) {
      console.warn("leaderboard:membership_filter_fallback", {
        guildId,
        reason: "all-membership-checks-failed",
        originalCount: entries.length
      });
      return entries;
    }

    return filtered;
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
