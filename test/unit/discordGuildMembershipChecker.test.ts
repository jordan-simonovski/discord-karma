import { describe, expect, it, vi, afterEach } from "vitest";
import { DiscordGuildMembershipChecker } from "../../src/platforms/discord/discordGuildMembershipChecker";

describe("DiscordGuildMembershipChecker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when Discord confirms member is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 404
      } as Response)
    );

    const checker = new DiscordGuildMembershipChecker("token");
    const result = await checker.isUserInGuild("g1", "u1");

    expect(result).toBe(false);
  });

  it("returns true on non-authoritative errors to avoid hiding all entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 403
      } as Response)
    );

    const checker = new DiscordGuildMembershipChecker("token");
    const result = await checker.isUserInGuild("g1", "u1");

    expect(result).toBe(true);
  });

  it("returns true when token is missing (verification unavailable)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const checker = new DiscordGuildMembershipChecker(undefined);
    const result = await checker.isUserInGuild("g1", "u1");

    expect(result).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns bot status from guild member response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ user: { bot: true } })
      } as Response)
    );

    const checker = new DiscordGuildMembershipChecker("token");
    const result = await checker.isUserBot("g1", "u1");

    expect(result).toBe(true);
  });

  it("returns null for bot status when token is missing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const checker = new DiscordGuildMembershipChecker(undefined);
    const result = await checker.isUserBot("g1", "u1");

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("collects role members by paging guild members and filtering role ids", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: async () => [
          { user: { id: "100" }, roles: ["r1"] },
          { user: { id: "101" }, roles: ["r2"] },
          { user: { id: "102" }, roles: ["r1", "r3"] }
        ]
      } as Response)
      .mockResolvedValueOnce({
        status: 200,
        json: async () => []
      } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    const checker = new DiscordGuildMembershipChecker("token");
    const result = await checker.getRoleMemberUserIds("g1", "r1");

    expect(result).toEqual(["100", "102"]);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://discord.com/api/v10/guilds/g1/members?limit=1000",
      expect.any(Object)
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws when role lookup runs without bot token", async () => {
    const checker = new DiscordGuildMembershipChecker(undefined);

    await expect(checker.getRoleMemberUserIds("g1", "r1")).rejects.toThrow(
      "discord-bot-token-missing"
    );
  });

  it("throws when Discord rejects role member lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 403
      } as Response)
    );
    const checker = new DiscordGuildMembershipChecker("token");

    await expect(checker.getRoleMemberUserIds("g1", "r1")).rejects.toThrow(
      "discord-api-status-403"
    );
  });
});
