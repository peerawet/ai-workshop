"use client";

import { use, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import {
  RiBuilding2Line,
  RiChat3Line,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiHome4Line,
  RiLayoutGridLine,
  RiSearchLine,
  RiUserSearchLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";
import { StepsScene } from "./scenes";
import { setJourney, type Audience } from "./steps-journey";

type Icon = RemixiconComponentType;

const STEPS: Record<Audience, { title: string; description: string; icon: Icon }[]> = {
  tenant: [
    { title: "ค้นหาหอ", description: "ค้นหาหอใกล้ที่เรียนหรือที่ทำงาน กรองตามราคาและประเภทหอ", icon: RiSearchLine },
    { title: "ดูห้องว่างจริง", description: "ดูผังห้องที่ว่างจริง และค่าใช้จ่ายทั้งหมดก่อนตัดสินใจ", icon: RiLayoutGridLine },
    { title: "แชทเพื่อจอง", description: "ส่งคำขอจองในแชท แล้วรอเจ้าของหอยืนยัน", icon: RiChat3Line },
  ],
  owner: [
    { title: "สร้างหอ", description: "สมัครแล้วสร้างหอ ใส่รูป ที่ตั้ง และสิ่งอำนวยความสะดวก", icon: RiHome4Line },
    { title: "เพิ่มห้อง", description: "เพิ่มประเภทห้องและเลขห้อง ระบบสร้างผังห้องให้อัตโนมัติ", icon: RiLayoutGridLine },
    { title: "รับจองในแชท", description: "ตอบแชทและกดยืนยันการจอง สถานะห้องอัปเดตเอง", icon: RiCheckboxCircleLine },
  ],
};

const JOURNEY_LABEL: Record<Audience, string> = { tenant: "เส้นทางของผู้เช่า", owner: "เส้นทางของเจ้าของหอ" };

/** How long each step stays active while the section plays through on its own. */
const STEP_MS = 3800;

// Reduced motion as a store: no auto-advance and no progress fills when it is on.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const useReducedMotion = () =>
  useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => true);

/**
 * A progress fill: empty, full, or filling over one step while the walk-through plays.
 * Uses the `scale` property (what Tailwind's scale utilities set), animated with WAAPI.
 */
function Fill({ mode, axis, restartKey }: { mode: "empty" | "full" | "play"; axis: "x" | "y"; restartKey: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || mode !== "play") return;
    const from = axis === "x" ? "0 1" : "1 0";
    const animation = el.animate([{ scale: from }, { scale: "1 1" }], { duration: STEP_MS, easing: "linear", fill: "forwards" });
    return () => animation.cancel();
  }, [mode, axis, restartKey]);
  return (
    <span
      ref={ref}
      aria-hidden
      className={cx(
        "absolute inset-0 rounded-full bg-accent-500",
        axis === "x" ? "ltr:origin-left rtl:origin-right" : "origin-top",
        mode === "full" ? "scale-100" : axis === "x" ? "scale-x-0" : "scale-y-0",
      )}
    />
  );
}

/** Reads `?for=owner` so the header's owner link opens the owner steps. Suspends; wrap in `<Suspense>`. */
export function HowItWorksFromUrl({ searchParams }: { searchParams: Promise<{ for?: string | string[] }> }) {
  const { for: audience } = use(searchParams);
  return <HowItWorks initial={audience === "owner" ? "owner" : "tenant"} />;
}

export function HowItWorks({ initial = "tenant" }: { initial?: Audience }) {
  const [audience, setAudience] = useState<Audience>(initial);
  const [active, setActive] = useState(0);
  // Pointer or keyboard focus inside the section pauses the walk-through.
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const steps = STEPS[audience];
  const playing = visible && !paused && !reducedMotion;
  const restartKey = `${audience}-${active}`;

  // The 3D diorama (three/steps.ts) follows this.
  useEffect(() => {
    setJourney({ audience, active });
  }, [audience, active]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Move to the next step when the current one has played for STEP_MS.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setActive((step) => (step + 1) % 3), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, active, audience]);

  const fillMode = (index: number) => (index < active ? "full" : index === active && playing ? "play" : "empty");

  return (
    <div
      ref={rootRef}
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-8"
    >
      <SegmentedControl
        aria-label="แสดงขั้นตอนสำหรับ"
        selectedKeys={[audience]}
        onSelectionChange={(keys) => {
          const [next] = [...keys];
          if (!next) return;
          setAudience(next as Audience);
          setActive(0);
        }}
        className="w-full p-1.5 shadow-xs sm:w-auto sm:justify-self-start lg:col-start-1 lg:row-start-1"
        data-analytics="landing_how_it_works_tab"
      >
        {(
          [
            ["tenant", "ผู้เช่า", RiUserSearchLine],
            ["owner", "เจ้าของหอ", RiBuilding2Line],
          ] as const
        ).map(([id, label, ItemIcon]) => (
          <SegmentedControlItem
            key={id}
            id={id}
            className={({ isSelected }) =>
              cx("flex-1 gap-2 px-6 py-2.5 sm:flex-none", isSelected ? "text-headline-semibold" : "text-headline-regular")
            }
          >
            <ItemIcon className="size-5" aria-hidden />
            {label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>

      {/* The journey on a little film set. It repeats the list below, so assistive tech skips it. */}
      <div
        aria-hidden
        className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border-button-default shadow-lg sm:aspect-[16/10] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:aspect-auto lg:min-h-112"
        style={{
          background:
            "radial-gradient(ellipse 85% 70% at 50% 62%, color-mix(in srgb, var(--color-accent-500) 14%, var(--color-background-secondary-default)), var(--color-background-secondary-default) 75%)",
        }}
      >
        <StepsScene className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl border border-border-button-default bg-background-primary-default/85 px-3 py-2.5 shadow-md backdrop-blur-md sm:inset-x-4 sm:bottom-4 sm:px-4">
          <span className="truncate text-caption-1-medium text-text-secondary">{JOURNEY_LABEL[audience]}</span>
          <span className="flex min-w-16 flex-1 items-center gap-1.5">
            {steps.map(({ title }, index) => (
              <span key={title} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-background-tertiary-default">
                <Fill mode={fillMode(index) === "empty" && index === active ? "full" : fillMode(index)} axis="x" restartKey={restartKey} />
              </span>
            ))}
          </span>
          <span className="text-caption-1-semibold text-text-primary tabular-nums">{active + 1}/3</span>
        </div>
      </div>

      <ol className="flex flex-col lg:col-start-1 lg:row-start-2">
        {steps.map(({ title, description, icon: StepIcon }, index) => {
          const state = index === active ? "active" : index < active ? "done" : "next";
          return (
            // Titles differ between the two audiences, so switching tabs remounts the steps and replays the rise.
            <li
              key={title}
              onPointerEnter={() => setActive(index)}
              style={{ "--rise-delay": `${index * 80}ms` } as CSSProperties}
              className="landing-rise flex gap-3 sm:gap-4"
            >
              <div className="flex w-12 shrink-0 flex-col items-center">
                <span
                  aria-hidden
                  className={cx(
                    "flex shrink-0 items-center justify-center rounded-full transition-[width,height,background-color,color,box-shadow] duration-300",
                    state === "active" &&
                      "size-12 bg-button-primary text-headline-semibold text-text-white shadow-lg ring-4 ring-status-blue-background",
                    state === "done" && "size-10 bg-status-blue-background text-status-blue-text",
                    state === "next" &&
                      "size-10 border border-border-button-default bg-background-primary-default text-body-semibold text-text-tertiary",
                  )}
                >
                  {state === "done" ? <RiCheckLine className="size-5" /> : index + 1}
                </span>
                {index < steps.length - 1 ? (
                  <span aria-hidden className="relative my-2 w-1 flex-1 overflow-hidden rounded-full bg-separator-border">
                    <Fill mode={fillMode(index)} axis="y" restartKey={restartKey} />
                  </span>
                ) : null}
              </div>
              <div
                className={cx(
                  "mb-4 flex min-w-0 flex-1 items-start gap-4 rounded-3xl border p-4 transition-[border-color,background-color,box-shadow] duration-300 sm:p-5",
                  state === "active"
                    ? "border-accent-500 bg-status-blue-background shadow-lg"
                    : "border-border-button-default bg-background-primary-default hover:border-border-button-hover",
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                    state === "active"
                      ? "bg-button-primary text-text-white"
                      : "bg-background-tertiary-default text-foreground-icon-secondary",
                  )}
                >
                  <StepIcon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-headline-semibold text-text-primary">
                    <span className="sr-only">ขั้นที่ {index + 1}: </span>
                    {title}
                  </h3>
                  <p className="text-body-regular text-text-secondary">{description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
