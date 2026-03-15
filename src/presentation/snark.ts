export type SnarkCategory = "self_award" | "self_remove";

const SNARK_MESSAGES: Record<SnarkCategory, string[]> = {
  self_award: [
    "Nice fucking try. You cannot farm karma off your own face.",
    "Self-award denied. This is a karma bot, not your PR department.",
    "No. The mirror is not eligible for bonus points.",
    "Put the plus signs down, champ. Nobody is buying it.",
    "You cannot upvote yourself here. Go gaslight a spreadsheet.",
    "Denied. We are not running a one-person circlejerk.",
    "That is some grade-A self-hype bullshit. Rejected.",
    "You tried to pay yourself in fake internet points. Cute.",
    "Nope. Earn karma from other humans like the rest of us.",
    "Self-karma blocked. Audacity noted."
  ],
  self_remove: [
    "Stop trying to self-destruct in public. Self-minus is disabled.",
    "Nope. You cannot punish yourself for content.",
    "Put the minus signs down, drama goblin.",
    "Denied. This bot is not your guilt vending machine.",
    "You do not get to nerf yourself for attention.",
    "Self-penalty blocked. Keep your tragic arc offline.",
    "Nice meltdown, but no, you cannot dock your own karma.",
    "Rejected. This is karma tracking, not emotional damage control.",
    "Not happening. You cannot audit yourself into the ground.",
    "Self-remove denied. Touch grass and try again."
  ]
};

export type SnarkPicker = (category: SnarkCategory) => string;

export function randomSnarkPicker(category: SnarkCategory): string {
  const list = SNARK_MESSAGES[category];
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}
