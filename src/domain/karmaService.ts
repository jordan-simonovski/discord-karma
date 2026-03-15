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
  getRoleMemberUserIds(guildId: string, roleId: string): Promise<string[]>;
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
      isUserBot: async () => null,
      getRoleMemberUserIds: async () => []
    }
  ) {}

  public async handleAction(event: KarmaActionEvent): Promise<KarmaActionResult> {
    if (event.targetRoleId && event.targetRoleMention) {
      return this.handleRoleAction(event);
    }

    if (!event.targetUserId || !event.targetMention) {
      return {
        shouldPersist: false,
        message: "Invalid karma command. Missing target user."
      };
    }

    return this.applyKarmaForUser(event, event.targetUserId, event.targetMention, event.targetIsBot);
  }

  public async handleLeaderboard(
    event: LeaderboardEvent
  ): Promise<KarmaActionResult> {
    const entries = await this.repository.getLeaderboard(event.guildId, LEADERBOARD_SCAN_LIMIT);
    console.info("leaderboard:repo_entries", {
      guildId: event.guildId,
      count: entries.length
    });
    const filteredEntries = await this.filterGuildMembers(event.guildId, entries);
    console.info("leaderboard:filtered_entries", {
      guildId: event.guildId,
      count: filteredEntries.length
    });
    return {
      shouldPersist: false,
      message: formatLeaderboardMessage(filteredEntries.slice(0, LEADERBOARD_RESULT_LIMIT))
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

  private async handleRoleAction(event: KarmaActionEvent): Promise<KarmaActionResult> {
    const roleId = event.targetRoleId as string;
    const roleMention = event.targetRoleMention as string;
    let roleMemberIds: string[];
    try {
      roleMemberIds = await this.guildMembershipChecker.getRoleMemberUserIds(
        event.guildId,
        roleId
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "unknown-role-member-lookup-error";
      console.warn("role_membership_lookup_failed", {
        guildId: event.guildId,
        roleId,
        error: errorMessage
      });
      return {
        shouldPersist: false,
        message:
          `Could not resolve members for ${roleMention}. ` +
          "Check DISCORD_BOT_TOKEN and enable Server Members Intent in Discord."
      };
    }
    if (roleMemberIds.length === 0) {
      return {
        shouldPersist: false,
        message: `No users found in ${roleMention}.`
      };
    }

    const lines: string[] = [];
    let hasPersistence = false;

    for (const userId of roleMemberIds) {
      const result = await this.applyKarmaForUser(event, userId, `<@${userId}>`);
      lines.push(result.message);
      hasPersistence = hasPersistence || result.shouldPersist;
    }

    return {
      shouldPersist: hasPersistence,
      message: lines.join("\n")
    };
  }

  private async applyKarmaForUser(
    event: KarmaActionEvent,
    targetUserId: string,
    targetMention: string,
    explicitTargetIsBot: boolean | null | undefined = undefined
  ): Promise<KarmaActionResult> {
    const targetIsBot =
      explicitTargetIsBot ??
      (await this.guildMembershipChecker.isUserBot(event.guildId, targetUserId));
    if (targetIsBot) {
      return {
        shouldPersist: false,
        message: `${targetMention}: Bots cannot receive karma.`
      };
    }

    const outcome = evaluateKarmaAction({
      actorUserId: event.actorUserId,
      targetUserId,
      symbolRun: event.symbolRun
    });

    if (outcome.kind === "reject") {
      return this.handleRejection(outcome.reason, targetMention);
    }

    const record = await this.repository.applyDelta(event.guildId, targetUserId, outcome.delta);
    return {
      shouldPersist: true,
      message: formatKarmaAppliedMessage(targetMention, outcome.delta, record, outcome.capped)
    };
  }
}
