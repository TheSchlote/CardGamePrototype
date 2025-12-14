export interface Rng {
  next: () => number;
  int: (max: number) => number;
  shuffle: <T>(items: T[]) => T[];
}

const mulberry32 = (seed: number): Rng => {
  let t = seed >>> 0;
  const next = () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  const int = (max: number) => Math.floor(next() * max);
  const shuffle = <T>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return { next, int, shuffle };
};

export const seedNumber = (seed: string | number): number => {
  if (typeof seed === "number") return seed >>> 0;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
  }
  return h >>> 0;
};

export const createRng = (seed: string | number): Rng => mulberry32(seedNumber(seed));
