/**
 * Carries the move-in cost demo's total to its three.js money scene (three/features.ts).
 * The scene is mounted outside React (see scenes.tsx), so it subscribes here instead of taking
 * props. The calculator and the scene import this one module and share its instance.
 */

/** The spec's defaults: 4,500 baht, 1 month in advance, 2 months deposit → 13,500. */
export const DEFAULT_MOVE_IN_COST = { rent: 4500, advance: 1, deposit: 2 } as const;

export type Denomination = 1000 | 500 | 100 | 20 | 10 | 5 | 1;

/** Largest first, so a greedy split uses the fewest pieces. Notes, then coins. */
export const DENOMINATIONS: readonly Denomination[] = [1000, 500, 100, 20, 10, 5, 1];
export const NOTES: readonly Denomination[] = [1000, 500, 100, 20];
export const COINS: readonly Denomination[] = [10, 5, 1];

/** How many of each note and coin make up `total` baht, splitting greedily. */
export function breakdown(total: number): Record<Denomination, number> {
  let rest = Math.max(0, Math.round(Number.isFinite(total) ? total : 0));
  const counts = {} as Record<Denomination, number>;
  for (const value of DENOMINATIONS) {
    counts[value] = Math.floor(rest / value);
    rest -= counts[value] * value;
  }
  return counts;
}

let current = DEFAULT_MOVE_IN_COST.rent * (DEFAULT_MOVE_IN_COST.advance + DEFAULT_MOVE_IN_COST.deposit);
const listeners = new Set<(total: number) => void>();

export function getMoveInTotal() {
  return current;
}

export function setMoveInTotal(total: number) {
  if (total === current) return;
  current = total;
  for (const listener of listeners) listener(total);
}

export function subscribeMoveInTotal(listener: (total: number) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
