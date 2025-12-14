import { AFFINITIES } from "./constants";
import type { Affinity } from "./constants";
import type { PlayerId } from "./types";

export const opponentOf = (id: PlayerId): PlayerId => (id === "A" ? "B" : "A");

export const sum = (values: number[]) => values.reduce((acc, val) => acc + val, 0);

export const payEnergyCost = (
  pool: Record<Affinity, number>,
  affinity: Affinity,
  cost: number
): boolean => {
  if (cost === 0) return true;
  if (affinity !== "Neutral") {
    if (pool[affinity] < cost) return false;
    pool[affinity] -= cost;
    return true;
  }

  const total = AFFINITIES.reduce((acc, key) => acc + (key === "Neutral" ? 0 : pool[key]), 0);
  if (total < cost) return false;

  let remaining = cost;
  const sortedAffinities = AFFINITIES.filter((a) => a !== "Neutral").sort(
    (a, b) => pool[b] - pool[a]
  );
  for (const key of sortedAffinities) {
    if (remaining === 0) break;
    const pay = Math.min(pool[key], remaining);
    pool[key] -= pay;
    remaining -= pay;
  }
  return true;
};
