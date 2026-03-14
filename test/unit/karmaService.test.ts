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
      targetUserId: "target",
      targetMention: "<@target>",
      symbolRun: "+++",
      channelId: "c1"
    });

    expect(repo.applyDelta).toHaveBeenCalledWith("target", 2);
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
      targetUserId: "target",
      targetMention: "<@target>",
      symbolRun: "----",
      channelId: "c1"
    });

    expect(repo.applyDelta).toHaveBeenCalledWith("target", -3);
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
      targetUserId: "target",
      targetMention: "<@target>",
      symbolRun: "+++++++",
      channelId: "c1"
    });

    expect(repo.applyDelta).toHaveBeenCalledWith("target", 5);
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
      targetUserId: "same",
      targetMention: "<@same>",
      symbolRun: "++",
      channelId: "c1"
    });

    expect(repo.applyDelta).not.toHaveBeenCalled();
    expect(result.shouldPersist).toBe(false);
    expect(result.message).toContain("narcissist");
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
      channelId: "c1",
      scope: "week"
    });

    expect(repo.getLeaderboard).toHaveBeenCalledWith("week", 5);
    expect(result.shouldPersist).toBe(false);
    expect(result.message).toContain("Weekly karma leaderboard");
    expect(result.message).toContain("1. <@u1> — 32");
    expect(result.message).toContain("5. <@u5> — 15");
  });
});
