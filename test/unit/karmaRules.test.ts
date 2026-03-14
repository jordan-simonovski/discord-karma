import { describe, expect, it } from "vitest";
import { evaluateKarmaAction } from "../../src/domain/karmaRules";

describe("evaluateKarmaAction", () => {
  it("maps plus runs to positive points", () => {
    expect(
      evaluateKarmaAction({
        actorUserId: "giver",
        targetUserId: "target",
        symbolRun: "++"
      })
    ).toEqual({ kind: "apply", delta: 1, capped: false });

    expect(
      evaluateKarmaAction({
        actorUserId: "giver",
        targetUserId: "target",
        symbolRun: "++++++"
      })
    ).toEqual({ kind: "apply", delta: 5, capped: false });
  });

  it("maps minus runs to negative points", () => {
    expect(
      evaluateKarmaAction({
        actorUserId: "giver",
        targetUserId: "target",
        symbolRun: "--"
      })
    ).toEqual({ kind: "apply", delta: -1, capped: false });

    expect(
      evaluateKarmaAction({
        actorUserId: "giver",
        targetUserId: "target",
        symbolRun: "------"
      })
    ).toEqual({ kind: "apply", delta: -5, capped: false });
  });

  it("caps more than 6 symbols at 5 points for buzzkill mode", () => {
    expect(
      evaluateKarmaAction({
        actorUserId: "giver",
        targetUserId: "target",
        symbolRun: "+++++++"
      })
    ).toEqual({ kind: "apply", delta: 5, capped: true });

    expect(
      evaluateKarmaAction({
        actorUserId: "giver",
        targetUserId: "target",
        symbolRun: "-------"
      })
    ).toEqual({ kind: "apply", delta: -5, capped: true });
  });

  it("rejects mixed or too-short symbol runs", () => {
    expect(
      evaluateKarmaAction({
        actorUserId: "giver",
        targetUserId: "target",
        symbolRun: "+"
      })
    ).toEqual({ kind: "reject", reason: "invalid_format" });

    expect(
      evaluateKarmaAction({
        actorUserId: "giver",
        targetUserId: "target",
        symbolRun: "+-+"
      })
    ).toEqual({ kind: "reject", reason: "invalid_format" });
  });

  it("rejects self-award and self-remove", () => {
    expect(
      evaluateKarmaAction({
        actorUserId: "same",
        targetUserId: "same",
        symbolRun: "++"
      })
    ).toEqual({ kind: "reject", reason: "self_award" });

    expect(
      evaluateKarmaAction({
        actorUserId: "same",
        targetUserId: "same",
        symbolRun: "--"
      })
    ).toEqual({ kind: "reject", reason: "self_remove" });
  });
});
