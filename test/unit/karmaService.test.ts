import { describe, expect, it, vi } from "vitest";
import { KarmaService } from "../../src/domain/karmaService";
import type { KarmaRepository } from "../../src/persistence/karmaRepository";

describe("KarmaService", () => {
  it("persists positive karma and returns a channel message", async () => {
    const repo: KarmaRepository = {
      getLeaderboard: vi.fn(),
      applyDelta: vi.fn().mockResolvedValue({
        userId: "target",
        karmaTotal: 12,
        karmaMax: 12
      })
    };

    const service = new KarmaService(repo, () => "snark");
    const result = await service.handleAction({
      kind: "karma",
      actorUserId: "giver",
      actorMention: "<@giver>",
      guildId: "g1",
      targetUserId: "target",
      targetMention: "<@target>",
      targetIsBot: false,
      symbolRun: "+++",
      channelId: "c1"
    });

    expect(repo.applyDelta).toHaveBeenCalledWith("g1", "target", 2);
    expect(result.shouldPersist).toBe(true);
    expect(result.message).toContain("<@target>");
    expect(result.message).toContain("2");
    expect(result.message).toContain("12");
  });

  it("persists negative karma for minus runs", async () => {
    const repo: KarmaRepository = {
      getLeaderboard: vi.fn(),
      applyDelta: vi.fn().mockResolvedValue({
        userId: "target",
        karmaTotal: 5,
        karmaMax: 12
      })
    };

    const service = new KarmaService(repo, () => "snark");
    const result = await service.handleAction({
      kind: "karma",
      actorUserId: "giver",
      actorMention: "<@giver>",
      guildId: "g1",
      targetUserId: "target",
      targetMention: "<@target>",
      targetIsBot: false,
      symbolRun: "----",
      channelId: "c1"
    });

    expect(repo.applyDelta).toHaveBeenCalledWith("g1", "target", -3);
    expect(result.shouldPersist).toBe(true);
    expect(result.message).toContain("-3");
  });

  it("caps oversized transfer to 5 points and persists with buzzkill note", async () => {
    const repo: KarmaRepository = {
      getLeaderboard: vi.fn(),
      applyDelta: vi.fn().mockResolvedValue({
        userId: "target",
        karmaTotal: 20,
        karmaMax: 22
      })
    };

    const service = new KarmaService(repo, () => "snark");
    const result = await service.handleAction({
      kind: "karma",
      actorUserId: "giver",
      actorMention: "<@giver>",
      guildId: "g1",
      targetUserId: "target",
      targetMention: "<@target>",
      targetIsBot: false,
      symbolRun: "+++++++",
      channelId: "c1"
    });

    expect(repo.applyDelta).toHaveBeenCalledWith("g1", "target", 5);
    expect(result.shouldPersist).toBe(true);
    expect(result.message.toLowerCase()).toContain("buzzkill");
  });

  it("returns snark and skips persistence for self-award", async () => {
    const repo: KarmaRepository = {
      getLeaderboard: vi.fn(),
      applyDelta: vi.fn()
    };

    const service = new KarmaService(repo, () => "nope, narcissist");
    const result = await service.handleAction({
      kind: "karma",
      actorUserId: "same",
      actorMention: "<@same>",
      guildId: "g1",
      targetUserId: "same",
      targetMention: "<@same>",
      targetIsBot: false,
      symbolRun: "++",
      channelId: "c1"
    });

    expect(repo.applyDelta).not.toHaveBeenCalled();
    expect(result.shouldPersist).toBe(false);
    expect(result.message).toContain("narcissist");
  });

  it("rejects karma for bot targets and does not persist", async () => {
    const repo: KarmaRepository = {
      getLeaderboard: vi.fn(),
      applyDelta: vi.fn()
    };

    const service = new KarmaService(repo, () => "snark");
    const result = await service.handleAction({
      kind: "karma",
      actorUserId: "giver",
      actorMention: "<@giver>",
      guildId: "g1",
      targetUserId: "bot-user",
      targetMention: "<@bot-user>",
      targetIsBot: true,
      symbolRun: "+++",
      channelId: "c1"
    });

    expect(repo.applyDelta).not.toHaveBeenCalled();
    expect(result.shouldPersist).toBe(false);
    expect(result.message).toContain("Bots cannot receive karma");
  });

  it("rejects karma when bot status is unknown in payload but confirmed by checker", async () => {
    const repo: KarmaRepository = {
      getLeaderboard: vi.fn(),
      applyDelta: vi.fn()
    };
    const checker = {
      isUserInGuild: vi.fn().mockResolvedValue(true),
      isUserBot: vi.fn().mockResolvedValue(true)
    };

    const service = new KarmaService(repo, () => "snark", checker);
    const result = await service.handleAction({
      kind: "karma",
      actorUserId: "giver",
      actorMention: "<@giver>",
      guildId: "g1",
      targetUserId: "target",
      targetMention: "<@target>",
      targetIsBot: null,
      symbolRun: "+++",
      channelId: "c1"
    });

    expect(checker.isUserBot).toHaveBeenCalledWith("g1", "target");
    expect(repo.applyDelta).not.toHaveBeenCalled();
    expect(result.shouldPersist).toBe(false);
  });

  it("returns top 5 leaderboard entries for the selected scope", async () => {
    const repo: KarmaRepository = {
      applyDelta: vi.fn(),
      getLeaderboard: vi.fn().mockResolvedValue([
        { userId: "u1", karmaTotal: 32, karmaMax: 50 },
        { userId: "u2", karmaTotal: 27, karmaMax: 40 },
        { userId: "u3", karmaTotal: 21, karmaMax: 35 },
        { userId: "u4", karmaTotal: 18, karmaMax: 25 },
        { userId: "u5", karmaTotal: 15, karmaMax: 20 }
      ])
    };

    const service = new KarmaService(repo, () => "snark");
    const result = await service.handleLeaderboard({
      kind: "leaderboard",
      actorUserId: "viewer",
      actorMention: "<@viewer>",
      guildId: "g1",
      channelId: "c1",
      scope: "week"
    });

    expect(repo.getLeaderboard).toHaveBeenCalledWith("g1", "week", 25);
    expect(result.shouldPersist).toBe(false);
    expect(result.message).toContain("Weekly karma leaderboard");
    expect(result.message).toContain("1. <@u1> — 32");
    expect(result.message).toContain("5. <@u5> — 15");
  });

  it("filters out leaderboard users not found in the guild", async () => {
    const repo: KarmaRepository = {
      applyDelta: vi.fn(),
      getLeaderboard: vi.fn().mockResolvedValue([
        { userId: "u1", karmaTotal: 32, karmaMax: 50 },
        { userId: "u2", karmaTotal: 27, karmaMax: 40 }
      ])
    };
    const checker = {
      isUserInGuild: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      isUserBot: vi.fn().mockResolvedValue(false)
    };

    const service = new KarmaService(repo, () => "snark", checker);
    const result = await service.handleLeaderboard({
      kind: "leaderboard",
      actorUserId: "viewer",
      actorMention: "<@viewer>",
      guildId: "g1",
      channelId: "c1",
      scope: "week"
    });

    expect(checker.isUserInGuild).toHaveBeenCalledWith("g1", "u1");
    expect(checker.isUserInGuild).toHaveBeenCalledWith("g1", "u2");
    expect(result.message).toContain("1. <@u1> — 32");
    expect(result.message).not.toContain("<@u2>");
  });

  it("returns empty leaderboard when none of the users are found in the guild", async () => {
    const repo: KarmaRepository = {
      applyDelta: vi.fn(),
      getLeaderboard: vi.fn().mockResolvedValue([
        { userId: "u1", karmaTotal: 32, karmaMax: 50 },
        { userId: "u2", karmaTotal: 27, karmaMax: 40 }
      ])
    };
    const checker = {
      isUserInGuild: vi.fn().mockResolvedValue(false),
      isUserBot: vi.fn().mockResolvedValue(false)
    };

    const service = new KarmaService(repo, () => "snark", checker);
    const result = await service.handleLeaderboard({
      kind: "leaderboard",
      actorUserId: "viewer",
      actorMention: "<@viewer>",
      guildId: "g1",
      channelId: "c1",
      scope: "week"
    });

    expect(result.message).toContain("No karma activity yet.");
  });
});
