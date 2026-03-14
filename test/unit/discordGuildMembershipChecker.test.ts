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
});
