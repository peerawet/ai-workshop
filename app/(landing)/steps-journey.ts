/**
 * The one piece of state the "ใช้งานยังไง" steps share with their 3D scene: which journey is
 * shown and which step is active. The section writes it; three/steps.ts reads it every frame
 * (or subscribes, when it only draws still frames for reduced motion).
 */
export type Audience = "tenant" | "owner";

export interface Journey {
  audience: Audience;
  /** Index of the active step, 0–2. */
  active: number;
}

let journey: Journey = { audience: "tenant", active: 0 };
const listeners = new Set<() => void>();

export function getJourney(): Journey {
  return journey;
}

export function setJourney(next: Journey) {
  if (next.audience === journey.audience && next.active === journey.active) return;
  journey = next;
  for (const listener of listeners) listener();
}

export function subscribeJourney(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
