import { Suspense } from "react";
import { RiCheckLine } from "@remixicon/react";
import { ButtonLink } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { getCurrentProfile } from "@/lib/auth";
import { cx } from "@/utils/cx";
import { DormBuildingScene } from "./scenes";
import { ComingSoon, LandingSection, revealDelay } from "./section";

/** Legend for the model dorm, so the room colours are never the only cue. */
const LEGEND = [
  { label: "ว่าง", dot: "bg-chart-2" },
  { label: "ติดจอง", dot: "bg-status-yellow-text" },
  { label: "มีผู้เช่า", dot: "bg-foreground-icon-quaternary" },
] as const;

const POINTS: { text: string; comingSoon?: boolean }[] = [
  { text: "ลงประกาศฟรี ไม่จำกัดจำนวนห้อง" },
  { text: "ผังห้องรายชั้น เปลี่ยนสถานะได้ในคลิกเดียว" },
  { text: "กล่องแชทรวมผู้สนใจทุกคน พร้อมการ์ดคำขอจอง" },
  { text: "แจ้งเตือนข้อความและคำขอจองผ่าน LINE" },
  { text: "ป้าย Verified สร้างความน่าเชื่อถือให้หอของคุณ" },
];

function SignupCta() {
  return (
    <ButtonLink
      href="/signup?role=owner"
      data-analytics="landing_owner_cta_click"
    >
      ลงประกาศหอพักฟรี
    </ButtonLink>
  );
}

/** Owners who are already signed in go straight to their dorms. */
async function OwnerCta() {
  const profile = await getCurrentProfile();
  if (profile?.role === "owner")
    return <ButtonLink href="/owner">ไปที่หอของฉัน</ButtonLink>;
  return <SignupCta />;
}

export function OwnerSection() {
  return (
    <LandingSection
      id="owners"
      title="ลงหอพักฟรี จัดการห้องและการจองในที่เดียว"
    >
      <div
        data-reveal
        className="grid gap-8 overflow-hidden rounded-3xl shadow-xl border border-border-button-default bg-background-secondary-default lg:grid-cols-[0.9fr_1.1fr] lg:gap-0"
      >
        {/* A model dorm whose rooms change status floor by floor (three/dorm-building.ts). */}
        <div className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-full">
          <DormBuildingScene className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
            <p className="text-caption-1-medium text-text-secondary">ผังห้องรายชั้น แบบที่เจ้าของหอเห็น</p>
            <Chip color="soft" variant="caption">
              ตัวอย่าง
            </Chip>
          </div>
          <ul className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
            {LEGEND.map(({ label, dot }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-background-primary-default px-2.5 py-1 text-caption-1-medium text-text-secondary shadow-xs"
              >
                <span aria-hidden className={cx("size-2 rounded-full", dot)} />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-8 bg-background-primary-default px-6 pb-6 sm:px-8 sm:pb-8 lg:p-10">
          <div className="flex flex-col items-start gap-4">
            <p className="text-title-3-regular text-text-secondary">
              เลิกตอบคำถามเดิมซ้ำ ๆ และจดห้องว่างในสมุด
              ประกาศของคุณกับผังห้องเป็นข้อมูลชุดเดียวกัน ห้องถูกจองเมื่อไร
              ประกาศก็อัปเดตเอง
            </p>
            {/* The session is a request-time read, so it streams in behind the static page. */}
            <Suspense fallback={<SignupCta />}>
              <OwnerCta />
            </Suspense>
          </div>

          <ul className="flex flex-col gap-3">
            {POINTS.map(({ text, comingSoon }, index) => (
              <li
                key={text}
                data-reveal
                style={revealDelay(index + 1)}
                className="flex items-start gap-3 text-body-regular text-text-primary"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-status-lime-background">
                  <RiCheckLine
                    className="size-3.5 text-status-lime-text"
                    aria-hidden
                  />
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {text}
                  {comingSoon ? <ComingSoon /> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LandingSection>
  );
}
