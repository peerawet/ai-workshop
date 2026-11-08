/**
 * Which problem → solution pair the "why" section is showing. The cards (problem-cards.tsx)
 * set it on hover, focus, tap or auto-advance; the phone scene (three/problem.ts) reads it to
 * pick its screen. A tiny external store, so both sides share one value without React context
 * (the scene lives outside React).
 */
export const PROBLEM_COUNT = 3;

type Listener = (index: number) => void;

let active = 0;
const listeners = new Set<Listener>();

export function getActiveProblem() {
  return active;
}

export function setActiveProblem(index: number) {
  const next = ((index % PROBLEM_COUNT) + PROBLEM_COUNT) % PROBLEM_COUNT;
  if (next === active) return;
  active = next;
  for (const listener of listeners) listener(next);
}

export function subscribeActiveProblem(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
