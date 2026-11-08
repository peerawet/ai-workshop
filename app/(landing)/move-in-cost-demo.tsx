"use client";

import { useEffect, useState } from "react";
import { Chip } from "@/components/base/badges/chip";
import { NumberField } from "@/components/base/number-field/number-field";
import { Slider } from "@/components/base/slider/slider";
import { COINS, DEFAULT_MOVE_IN_COST, NOTES, breakdown, setMoveInTotal } from "./features-cost-store";
import { FeaturesScene } from "./scenes";

const baht = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("th-TH");

// NumberField reports NaN while the input is empty.
const safe = (value: number) => (Number.isFinite(value) ? value : 0);

/** The rent slider's range; the number field above it still takes any amount. */
const RENT_MIN = 0;
const RENT_MAX = 30000;

/** "1,000 × 13, 500 × 1" for the denominations present, or an empty string. */
function describe(counts: Record<number, number>, values: readonly number[]) {
  return values
    .filter((value) => counts[value] > 0)
    .map((value) => `${count.format(value)} × ${count.format(counts[value])}`)
    .join(", ");
}

/**
 * Client-only demo of the Move-in Cost Calculator: rent × (months in advance + months of deposit).
 * Beside it, the same total as banknotes and coins in 3D (three/features.ts); the breakdown is
 * also written out in text, for screen readers and when WebGL is unavailable.
 */
export function MoveInCostDemo() {
  const [rent, setRent] = useState<number>(DEFAULT_MOVE_IN_COST.rent);
  const [advance, setAdvance] = useState<number>(DEFAULT_MOVE_IN_COST.advance);
  const [deposit, setDeposit] = useState<number>(DEFAULT_MOVE_IN_COST.deposit);

  const advanceTotal = safe(rent) * safe(advance);
  const depositTotal = safe(rent) * safe(deposit);
  const total = advanceTotal + depositTotal;

  // Hand the total to the money scene, which lives outside React.
  useEffect(() => {
    setMoveInTotal(total);
  }, [total]);

  const counts = breakdown(total);
  const notes = describe(counts, NOTES);
  const coins = describe(counts, COINS);

  return (
    <div
      data-analytics="landing_cost_demo_change"
      className="grid overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-md lg:grid-cols-[1.15fr_1fr]"
    >
      <div className="relative isolate flex aspect-[4/3] flex-col justify-between gap-3 bg-background-secondary-default p-4 sm:aspect-[16/10] sm:p-6 lg:aspect-auto lg:min-h-96">
        <FeaturesScene className="absolute inset-0 -z-10" />
        <div className="pointer-events-none flex items-start justify-between gap-3">
          <p className="text-caption-1-medium text-text-secondary">ยอดจ่ายวันเข้าอยู่ เป็นธนบัตรและเหรียญ</p>
          <Chip color="soft" variant="caption">
            ตัวอย่าง
          </Chip>
        </div>
        <p className="pointer-events-none text-caption-1-regular text-text-tertiary">
          ภาพประกอบ ไม่ใช่ธนบัตรจริง
        </p>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex flex-col gap-3">
            <NumberField
              label="ค่าเช่า/เดือน"
              value={rent}
              onChange={setRent}
              minValue={0}
              // Exact baht: React Aria snaps typed values to the step, so anything coarser would
              // turn 4,537 into 4,500. Holding a stepper still repeats and speeds up.
              step={1}
              formatOptions={{ style: "currency", currency: "THB", maximumFractionDigits: 0 }}
            />
            {/* Drag for a smooth sweep through every baht; the field above takes exact amounts. */}
            <Slider
              thumbLabel="ปรับค่าเช่าต่อเดือน"
              value={Math.min(RENT_MAX, Math.max(RENT_MIN, safe(rent)))}
              onChange={setRent}
              minValue={RENT_MIN}
              maxValue={RENT_MAX}
              step={1}
              showTooltip={false}
              formatOptions={{ style: "currency", currency: "THB", maximumFractionDigits: 0 }}
            />
          </div>
          {/* Whole months only. Fractions would also make React Aria pick the keyboard per device,
              which the server cannot know, and break hydration on phones. */}
          <NumberField
            label="ล่วงหน้า (เดือน)"
            value={advance}
            onChange={setAdvance}
            minValue={0}
            maxValue={6}
            formatOptions={{ maximumFractionDigits: 0 }}
          />
          <NumberField
            label="มัดจำ (เดือน)"
            value={deposit}
            onChange={setDeposit}
            minValue={0}
            maxValue={6}
            formatOptions={{ maximumFractionDigits: 0 }}
          />
        </div>

        <dl className="flex flex-col gap-2 border-t border-separator-border pt-4 text-body-regular">
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">ค่าเช่าล่วงหน้า</dt>
            <dd className="text-text-primary tabular-nums">{baht.format(advanceTotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">เงินมัดจำ</dt>
            <dd className="text-text-primary tabular-nums">{baht.format(depositTotal)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-2">
            <dt className="text-headline-semibold text-text-primary">จ่ายวันเข้าอยู่</dt>
            <dd aria-live="polite" className="text-title-1-semibold text-text-primary tabular-nums">
              {/* Keyed on the total so the fade replays each time it changes. */}
              <span key={total} className="inline-block animate-number-fade">
                {baht.format(total)}
              </span>
            </dd>
          </div>
          {/* The money scene in words: for screen readers, and in place of it without WebGL. */}
          <div className="flex flex-col gap-0.5 text-caption-1-regular text-text-secondary tabular-nums">
            <dt className="sr-only">แบ่งเป็นธนบัตรและเหรียญ</dt>
            {notes ? <dd>ธนบัตร {notes}</dd> : null}
            {coins ? <dd>เหรียญ {coins}</dd> : null}
          </div>
        </dl>
        <p className="text-caption-1-regular text-text-tertiary">
          ในหน้าหอจริงจะรวมค่าธรรมเนียมอื่นที่เจ้าของหอระบุ และประมาณค่าน้ำค่าไฟรายเดือนให้ด้วย
        </p>
      </div>
    </div>
  );
}
