import { describe, expect, it } from "vitest";
import { DiscordInteractionAdapter } from "../../src/platforms/discord/discordInteractionAdapter";

describe("DiscordInteractionAdapter", () => {
  it("parses a valid /karma interaction into a normalized event", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      guild_id: "g1",
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: {
        name: "karma",
        options: [
          { name: "user", type: 6, value: "222" },
          { name: "action", type: 3, value: "++++" }
        ],
        resolved: {
          users: {
            "222": { bot: false }
          }
        }
      }
    });

    expect(parsed).toEqual({
      kind: "karma",
      actorUserId: "111",
      actorMention: "<@111>",
      targetUserId: "222",
      targetMention: "<@222>",
      symbolRun: "++++",
      targetIsBot: false,
      guildId: "g1",
      channelId: "c1"
    });
  });

  it("returns null for non-karma command", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      guild_id: "g1",
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
      guild_id: "g1",
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: { name: "karma", options: [{ name: "user", type: 6, value: "222" }] }
    });

    expect(parsed).toBeNull();
  });

  it("parses /leaderboard command", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      guild_id: "g1",
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: {
        name: "leaderboard",
        options: []
      }
    });

    expect(parsed).toEqual({
      kind: "leaderboard",
      actorUserId: "111",
      actorMention: "<@111>",
      guildId: "g1",
      channelId: "c1"
    });
  });

  it("parses /leaderboard when options are omitted", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      guild_id: "g1",
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: { name: "leaderboard" }
    });

    expect(parsed).toEqual({
      kind: "leaderboard",
      actorUserId: "111",
      actorMention: "<@111>",
      guildId: "g1",
      channelId: "c1"
    });
  });

  it("parses /karma role target from mentionable option", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      guild_id: "g1",
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: {
        name: "karma",
        options: [
          { name: "target", type: 9, value: "r123" },
          { name: "action", type: 3, value: "++++" }
        ],
        resolved: {
          roles: {
            r123: { id: "r123" }
          }
        }
      }
    });

    expect(parsed).toEqual({
      kind: "karma",
      actorUserId: "111",
      actorMention: "<@111>",
      targetRoleId: "r123",
      targetRoleMention: "<@&r123>",
      symbolRun: "++++",
      guildId: "g1",
      channelId: "c1"
    });
  });

  it("returns null when guild id is missing", () => {
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

    expect(parsed).toBeNull();
  });

  it("parses /karma when resolved user metadata is missing", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      guild_id: "g1",
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
      kind: "karma",
      actorUserId: "111",
      actorMention: "<@111>",
      targetUserId: "222",
      targetMention: "<@222>",
      symbolRun: "++++",
      targetIsBot: null,
      guildId: "g1",
      channelId: "c1"
    });
  });

  it("marks karma target as bot when resolved user is a bot", () => {
    const adapter = new DiscordInteractionAdapter();
    const parsed = adapter.parse({
      type: 2,
      guild_id: "g1",
      channel_id: "c1",
      member: { user: { id: "111" } },
      data: {
        name: "karma",
        options: [
          { name: "user", type: 6, value: "222" },
          { name: "action", type: 3, value: "++++" }
        ],
        resolved: {
          users: {
            "222": { bot: true }
          }
        }
      }
    });

    expect(parsed).toEqual({
      kind: "karma",
      actorUserId: "111",
      actorMention: "<@111>",
      targetUserId: "222",
      targetMention: "<@222>",
      symbolRun: "++++",
      targetIsBot: true,
      guildId: "g1",
      channelId: "c1"
    });
  });
});
