import { describe, expect, it } from "vitest";
import { DiscordInteractionAdapter } from "../../src/platforms/discord/discordInteractionAdapter";

describe("DiscordInteractionAdapter", () => {
  it("parses a valid /karma interaction into a normalized event", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: {
        name: "karma",
        options: [
          { name: "user", type: 6, value: "222" },
          { name: "action", type: 3, value: "++++" }
        ]
      }
    });

    expect(parsed).toEqual({
      actorUserId: "111",
      actorMention: "<@111>",
      targetUserId: "222",
      targetMention: "<@222>",
      symbolRun: "++++",
      channelId: "c1"
    });
  });

  it("returns null for non-karma command", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: { name: "ping", options: [] }
    });

    expect(parsed).toBeNull();
  });

  it("returns null when required options are missing", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: { name: "karma", options: [{ name: "user", type: 6, value: "222" }] }
    });

    expect(parsed).toBeNull();
  });
});
