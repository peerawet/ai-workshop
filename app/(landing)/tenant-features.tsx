import type { RemixiconComponentType } from "@remixicon/react";
import {
  RiArrowDownLine,
  RiChat3Line,
  RiGroupLine,
  RiLayoutGridLine,
  RiNotification3Line,
  RiRouteLine,
  RiWallet3Line,
} from "@remixicon/react";
import { cx } from "@/utils/cx";
import { MoveInCostDemo } from "./move-in-cost-demo";
import { ComingSoon, LandingSection, revealDelay } from "./section";

interface Feature {
  icon: RemixiconComponentType;
  title: string;
  description: string;
  /** Icon tile colours: a status token pair, so both themes get a matching tint. */
  tone: string;
  /** In-page link to a live demo of the feature. */
  demo?: { href: string; label: string };
  comingSoon?: boolean;
}

const FEATURES: Feature[] = [
  {
    icon: RiLayoutGridLine,
    title: "ห้องว่างจริง",
    description: "ดูผังห้องรายชั้น รู้ทันทีว่าห้องไหนว่าง ติดจอง หรือมีคนอยู่แล้ว",
    tone: "bg-status-lime-background text-status-lime-text",
  },
  {
    icon: RiChat3Line,
    title: "จองผ่านแชท",
    description: "คุยกับเจ้าของหอ แล้วส่งคำขอจองพร้อมวันเข้าอยู่ได้ในแชทเดียว",
    tone: "bg-status-blue-background text-status-blue-text",
  },
  {
    icon: RiWallet3Line,
    title: "คำนวณค่าเข้าอยู่",
    description: "เห็นเงินที่ต้องเตรียมวันเข้าอยู่ ทั้งค่าเช่าล่วงหน้าและมัดจำ",
    tone: "bg-status-yellow-background text-status-yellow-text",
    demo: { href: "#move-in-cost", label: "ลองคำนวณ" },
  },
  {
    icon: RiNotification3Line,
    title: "แจ้งเตือนเมื่อห้องว่าง",
    description: "กดติดตามห้องที่ชอบ แล้วรับแจ้งเตือนทันทีที่มีห้องว่าง",
    tone: "bg-status-orange-background text-status-orange-text",
  },
  {
    icon: RiRouteLine,
    title: "ค้นหาตามเวลาเดินทาง",
    description: "ใส่ที่เรียนหรือที่ทำงาน แล้วกรองหอที่เดินทางไม่เกินกี่นาที",
    tone: "bg-status-cyan-background text-status-cyan-text",
  },
  {
    icon: RiGroupLine,
    title: "หาเพื่อนร่วมห้อง",
    description: "จับคู่รูมเมทจากไลฟ์สไตล์ เวลานอน และนิสัยการใช้ห้อง",
    tone: "bg-status-purple-background text-status-purple-text",
  },
];

export function TenantFeatures() {
  return (
    <LandingSection
      id="features"
      title="ทุกอย่างที่ต้องรู้ ก่อนตัดสินใจเช่า"
      description="ไม่ต้องทักถามทีละหอ ข้อมูลที่ใช้ตัดสินใจอยู่ในหน้าเดียว"
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description, tone, demo, comingSoon }, index) => (
          // The reveal animates the <li>; the hover lift lives on the card inside, so the two never fight.
          <li key={title} data-reveal style={revealDelay(index)}>
            <div className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-sm transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-border-button-hover hover:shadow-lg motion-safe:hover:-translate-y-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cx(
                    "flex size-11 items-center justify-center rounded-2xl transition-[scale,rotate] duration-300 ease-out motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-6",
                    tone,
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {comingSoon ? (
                  <ComingSoon />
                ) : (
                  <span aria-hidden className="text-caption-1-medium text-text-tertiary tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                )}
              </div>
              <h3 className="text-headline-semibold text-text-primary">{title}</h3>
              <p className="text-body-regular text-text-secondary">{description}</p>
              {demo ? (
                <a
                  href={demo.href}
                  className="mt-auto inline-flex w-fit items-center gap-1 rounded-md text-body-medium text-status-blue-text outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  {demo.label}
                  <RiArrowDownLine
                    className="size-4 transition-transform duration-200 motion-safe:group-hover:translate-y-0.5"
                    aria-hidden
                  />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div id="move-in-cost" data-reveal className="flex scroll-mt-20 flex-col gap-6 pt-4">
        <div className="flex max-w-2xl flex-col gap-2">
          <h3 className="text-title-2-semibold text-text-primary">ลองคำนวณค่าเข้าอยู่</h3>
          <p className="text-body-regular text-text-secondary">
            หอส่วนใหญ่เก็บค่าเช่าล่วงหน้าและเงินมัดจำรวมกันหลายเดือน ลองใส่ตัวเลขของหอที่สนใจดู
          </p>
        </div>
        <MoveInCostDemo />
      </div>
    </LandingSection>
  );
}
