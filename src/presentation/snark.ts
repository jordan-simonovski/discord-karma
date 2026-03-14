export type SnarkCategory = "self_award" | "self_remove";

const SNARK_MESSAGES: Record<SnarkCategory, string[]> = {
  self_award: [
    "Nice try. Handing yourself karma is not a sport.",
    "Self-karma denied. The mirror is not an accomplice.",
    "Nope. You cannot promote yourself with plus signs."
  ],
  self_remove: [
    "Easy there, drama machine. You cannot remove your own karma.",
    "Self-penalties are disabled. Put the minus signs down.",
    "You are being too hard on yourself. Denied."
  ]
};

export type SnarkPicker = (category: SnarkCategory) => string;

export function randomSnarkPicker(category: SnarkCategory): string {
  const list = SNARK_MESSAGES[category];
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}
