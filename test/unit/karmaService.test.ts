import { describe, expect, it, vi } from "vitest";
import { KarmaService } from "../../src/domain/karmaService";
import type { KarmaRepository } from "../../src/persistence/karmaRepository";

describe("KarmaService", () => {
  it("persists positive karma and returns a channel message", async () => {
    const repo: KarmaRepository = {
      applyDelta: vi.fn().mockResolvedValue({
        userId: "target",
        karmaTotal: 12,
        karmaMax: 12
      })
    };

    const service = new KarmaService(repo, () => "snark");
    const result = await service.handleAction({
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
      applyDelta: vi.fn().mockResolvedValue({
        userId: "target",
        karmaTotal: 5,
        karmaMax: 12
      })
    };

    const service = new KarmaService(repo, () => "snark");
    const result = await service.handleAction({
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
      applyDelta: vi.fn().mockResolvedValue({
        userId: "target",
        karmaTotal: 20,
        karmaMax: 22
      })
    };

    const service = new KarmaService(repo, () => "snark");
    const result = await service.handleAction({
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
      applyDelta: vi.fn()
    };

    const service = new KarmaService(repo, () => "nope, narcissist");
    const result = await service.handleAction({
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
});
