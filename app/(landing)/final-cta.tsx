import { RiKey2Line } from "@remixicon/react";
import { ButtonLink } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { CozyRoomScene } from "./scenes";

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      <div
        data-reveal
        className="cta-card relative isolate grid overflow-hidden rounded-3xl border border-border-button-default shadow-xl lg:grid-cols-[1fr_1.2fr]"
      >
        {/* The room you are about to find: lamp-lit at night, sunlit by day (three/cozy-room.ts). */}
        <div className="relative aspect-[4/3] sm:aspect-[16/10] lg:order-last lg:aspect-auto lg:min-h-112">
          <CozyRoomScene className="absolute inset-0" />
        </div>

        <div className="flex flex-col items-start justify-center gap-5 px-6 pb-8 sm:px-10 sm:pb-10 lg:py-14 lg:pe-0">
          <Chip color="lime" variant="caption" className="gap-1.5">
            <RiKey2Line className="size-3.5" aria-hidden />
            ห้องว่างรอคุณอยู่
          </Chip>
          <h2
            id="final-cta-title"
            className="text-display-4-semibold text-text-primary sm:text-display-3-semibold"
          >
            พร้อมหาห้องหรือยัง
          </h2>
          <p className="max-w-md text-title-3-regular text-text-secondary">
            ค้นหาหอที่ว่างจริงใกล้คุณ หรือเริ่มลงประกาศหอของคุณวันนี้
          </p>
          <div className="flex w-full flex-col gap-2 pt-1 sm:w-auto sm:flex-row">
            <ButtonLink href="/search">ค้นหาหอพัก</ButtonLink>
            <ButtonLink href="/signup?role=owner" variant="secondary" data-analytics="landing_owner_cta_click">
              ลงประกาศหอพักฟรี
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
