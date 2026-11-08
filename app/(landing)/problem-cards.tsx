"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiRefreshLine,
  RiShieldCheckLine,
  RiWallet3Line,
  type RemixiconComponentType,
} from "@remixicon/react";
import { cx } from "@/utils/cx";
import { PROBLEM_COUNT, getActiveProblem, setActiveProblem, subscribeActiveProblem } from "./problem-channel";
import { revealDelay } from "./section";

const ITEMS: { problem: string; solution: string; icon: RemixiconComponentType }[] = [
  {
    problem: "ทักไปแล้วห้องเต็ม ประกาศค้างเป็นเดือน",
    solution: "สถานะห้องมาจากระบบจัดการหอโดยตรง ห้องไหนถูกจอง ประกาศเปลี่ยนทันที",
    icon: RiRefreshLine,
  },
  {
    problem: "ไปถึงวันเข้าอยู่แล้วเจอค่าใช้จ่ายเพิ่ม",
    solution: "แสดงเงินวันเข้าอยู่ และค่าน้ำค่าไฟโดยประมาณก่อนตัดสินใจ",
    icon: RiWallet3Line,
  },
  {
    problem: "โดนหลอกโอนมัดจำก่อนดูห้อง",
    solution: "การจองยืนยันในระบบ ไม่ต้องโอนเงินให้ใครก่อนเจ้าของหอยืนยัน",
    icon: RiShieldCheckLine,
  },
];

/** How long each pair stays on the phone before moving on, and how long a visitor's choice holds. */
const ADVANCE_MS = 7000;
const HOLD_AFTER_INTERACTION_MS = 12000;

/**
 * The three problem → solution cards. Pointing at, focusing or tapping a card shows that pair on
 * the phone beside them; left alone, they take turns while the section is on screen. Reduced
 * motion turns the turn-taking off.
 */
export function ProblemCards() {
  const listRef = useRef<HTMLOListElement>(null);
  const lastInteraction = useRef(0);
  const active = useSyncExternalStore(subscribeActiveProblem, getActiveProblem, () => 0);

  useEffect(() => {
    const section = listRef.current?.closest("section");
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let inView = false;
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    }, { threshold: 0.25 });
    observer.observe(section);

    const timer = window.setInterval(() => {
      if (!inView || document.visibilityState !== "visible") return;
      // Event timestamps share performance.now()'s clock.
      if (performance.now() - lastInteraction.current < HOLD_AFTER_INTERACTION_MS) return;
      setActiveProblem((getActiveProblem() + 1) % PROBLEM_COUNT);
    }, ADVANCE_MS);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  const choose = (index: number, timeStamp: number) => {
    lastInteraction.current = timeStamp;
    setActiveProblem(index);
  };

  return (
    <ol ref={listRef} className="flex flex-col gap-4">
      {ITEMS.map(({ problem, solution, icon: Icon }, index) => {
        const isActive = index === active;
        return (
          <li
            key={problem}
            data-reveal
            style={revealDelay(index + 1)}
            // Focusable so keyboard users can bring a pair up on the phone, as hover does.
            tabIndex={0}
            data-active={isActive || undefined}
            onPointerEnter={(e) => e.pointerType === "mouse" && choose(index, e.timeStamp)}
            onFocus={(e) => choose(index, e.timeStamp)}
            onClick={(e) => choose(index, e.timeStamp)}
            className={cx(
              "flex cursor-default flex-col gap-4 rounded-3xl border bg-background-primary-default p-5 outline-none transition-[border-color,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-border-focus-ring sm:p-6",
              isActive ? "border-accent-500 shadow-lg" : "border-border-button-default shadow-sm",
            )}
          >
            <div className="flex items-start gap-4">
              <span
                className={cx(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                  isActive ? "bg-status-lime-background" : "bg-background-secondary-default",
                )}
              >
                <Icon
                  className={cx("size-5", isActive ? "text-status-lime-text" : "text-foreground-icon-tertiary")}
                  aria-hidden
                />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-caption-1-medium text-text-tertiary">ปัญหาเดิม</span>
                  <p className="flex gap-2 text-body-regular text-text-tertiary">
                    <RiCloseCircleLine className="mt-0.5 size-5 shrink-0 text-status-rose-text" aria-hidden />
                    <span className="line-through decoration-text-placeholder">{problem}</span>
                  </p>
                </div>
                <div aria-hidden className="h-px bg-separator-border" />
                <div className="flex flex-col gap-1">
                  <span className="text-caption-1-medium text-text-secondary">DormDee แก้ให้</span>
                  <p className="flex gap-2 text-headline-medium text-text-primary">
                    <RiCheckboxCircleLine className="mt-0.5 size-5 shrink-0 text-status-lime-text" aria-hidden />
                    {solution}
                  </p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
