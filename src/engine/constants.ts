export type Affinity =
  | "Nature"
  | "Fire"
  | "Water"
  | "Earth"
  | "Energy"
  | "Dark"
  | "Light"
  | "Neutral";

export const AFFINITIES: Affinity[] = [
  "Nature",
  "Fire",
  "Water",
  "Earth",
  "Energy",
  "Dark",
  "Light",
  "Neutral"
];

export enum Stage {
  Common = 0,
  Uncommon = 1,
  Rare = 2,
  Epic = 3,
  Mythic = 4
}

export type Phase =
  | "Start"
  | "Draw"
  | "Prepare"
  | "Summon"
  | "Action"
  | "Battle"
  | "End";

export const FIELD_SLOTS = 6;
