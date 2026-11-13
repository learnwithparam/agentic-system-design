// A small seeded random generator, so the world is the same on every machine.
// It is the "mulberry32" generator: a few bit operations turn one number into the next.

export type SeededRandom = {
  next: () => number;
  wholeNumber: (lowest: number, highest: number) => number;
  pick: <Item>(items: Item[]) => Item;
  chance: (probability: number) => boolean;
  shuffle: <Item>(items: Item[]) => Item[];
};

export function seededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;

  // A number from 0 up to (but not including) 1.
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  // A whole number from lowest to highest, both included.
  const wholeNumber = (lowest: number, highest: number) =>
    lowest + Math.floor(next() * (highest - lowest + 1));

  const pick = <Item>(items: Item[]): Item => items[Math.floor(next() * items.length)];

  const chance = (probability: number) => next() < probability;

  const shuffle = <Item>(items: Item[]): Item[] => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  return { next, wholeNumber, pick, chance, shuffle };
}

// A stable number from 0 up to 1 for a piece of text. The same text always gives the same number,
// so the planted model mistakes land on the same reports on every machine.
export function stableFraction(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) / 4294967296;
}
