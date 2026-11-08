"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/utils/cx";
import type { MountOptions, Stage } from "./three/stage";

type SceneModule = { mount: (container: HTMLElement, options: MountOptions) => Stage | null };
type Loader = () => Promise<SceneModule>;

/**
 * Mounts a three.js scene into an empty, decorative box. three.js is large, so its chunk is
 * imported only when needed: the hero waits for the page to go idle (the headline stays the
 * LCP element and search works first), the others wait until they are about to scroll into
 * view. Without WebGL or JavaScript the box simply shows what is behind it.
 */
function LazyScene({ load, eager = false, className }: { load: Loader; eager?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    let disposed = false;
    let stage: Stage | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = () => {
      load()
        .then(({ mount }) => {
          if (!disposed) stage = mount(container, { reducedMotion });
        })
        .catch(() => {
          // A failed chunk only costs the decoration.
        });
    };

    let cancel: () => void;
    if (eager) {
      if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(start, { timeout: 1500 });
        cancel = () => window.cancelIdleCallback(handle);
      } else {
        const handle = window.setTimeout(start, 300);
        cancel = () => window.clearTimeout(handle);
      }
    } else {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          start();
        },
        { rootMargin: "300px 0px" },
      );
      observer.observe(container);
      cancel = () => observer.disconnect();
    }

    return () => {
      disposed = true;
      cancel();
      stage?.dispose();
    };
  }, [load, eager]);

  return <div ref={ref} aria-hidden className={cx("landing-scene", className)} />;
}

const loadCity: Loader = () => import("./three/city");
const loadDorm: Loader = () => import("./three/dorm-building");
const loadRoom: Loader = () => import("./three/cozy-room");
const loadProblem: Loader = () => import("./three/problem");
const loadFeatures: Loader = () => import("./three/features");
const loadSteps: Loader = () => import("./three/steps");

/** "หาหอเองเหนื่อยตรงไหน" (problem-solution.tsx). */
export function ProblemScene({ className }: { className?: string }) {
  return <LazyScene load={loadProblem} className={className} />;
}

/** "ทุกอย่างที่ต้องรู้ ก่อนตัดสินใจเช่า" (tenant-features.tsx). */
export function FeaturesScene({ className }: { className?: string }) {
  return <LazyScene load={loadFeatures} className={className} />;
}

/** "ใช้งานยังไง" (how-it-works.tsx). */
export function StepsScene({ className }: { className?: string }) {
  return <LazyScene load={loadSteps} className={className} />;
}

/** Hero: a city where every window is a room; night in the dark theme, day in the light one. */
export function CityScene({ className }: { className?: string }) {
  return <LazyScene load={loadCity} eager className={className} />;
}

/** Owner section: a model dorm whose rooms change status, floor by floor. */
export function DormBuildingScene({ className }: { className?: string }) {
  return <LazyScene load={loadDorm} className={className} />;
}

/** Closing call to action: the room you are about to find, lamp-lit at night and sunlit by day. */
export function CozyRoomScene({ className }: { className?: string }) {
  return <LazyScene load={loadRoom} className={className} />;
}
