import type { CSSProperties } from "react";
import Link from "next/link";
import { RiArrowRightLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { SearchField } from "@/components/base/search-field/search-field";
import { CityScene } from "./scenes";
import { LiveRoomGridPreview } from "./room-grid-preview";

/** Staggers the hero entrance (see .landing-rise in landing.css). */
const rise = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as CSSProperties;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="hero-backdrop relative isolate overflow-hidden">
      {/* A city where every window is a room: night in the dark theme, day in the light one (three/city.ts).
          Phones and tablets show it as a band across the top, desktops behind the whole hero. */}
      <CityScene className="absolute inset-x-0 top-0 -z-20 h-136 lg:inset-0 lg:h-auto" />
      {/* Scrims keep the copy readable over the city and melt the scene into the page.
          Below lg: the sky and moon stay clear at the top and fade out behind the copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-136 bg-linear-to-b from-transparent from-15% via-background-full/75 via-38% to-background-full to-70% lg:hidden"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden bg-linear-to-r from-background-full from-20% via-background-full/70 via-40% to-transparent to-65% lg:block rtl:bg-linear-to-l"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden h-24 bg-linear-to-t from-background-full to-transparent lg:block"
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-48 pb-16 sm:pt-56 sm:pb-20 lg:min-h-svh lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-16 lg:pb-24">
        <div className="flex flex-col items-start gap-6">
          <Chip color="blue" variant="caption" className="landing-rise gap-1.5" style={rise(0)}>
            {/* Live dot: a steady core with a ring that pings outward. */}
            <span aria-hidden className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-status-blue-text opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-status-blue-text" />
            </span>
            ห้องว่างอัปเดตแบบ real-time
          </Chip>
          <h1
            id="hero-title"
            style={rise(80)}
            className="landing-rise text-display-4-semibold text-text-primary sm:text-display-2-semibold"
          >
            หาหอพักที่<span className="text-accent-500">ว่างจริง</span> และจองได้ทันทีผ่านแชท
          </h1>
          <p style={rise(160)} className="landing-rise max-w-xl text-title-3-regular text-text-secondary">
            ค้นหาหอใกล้มหาวิทยาลัย ที่ทำงาน หรือรถไฟฟ้า เห็นค่าใช้จ่ายทั้งหมดก่อนตัดสินใจ แล้วคุยกับเจ้าของหอโดยตรง
          </p>

          {/* A plain GET form, so search works before (or without) JavaScript. */}
          <form
            action="/search"
            method="get"
            role="search"
            data-analytics="landing_search_submit"
            style={rise(240)}
            className="landing-rise flex w-full max-w-xl flex-col gap-2 sm:flex-row"
          >
            <SearchField
              name="q"
              aria-label="ค้นหาหอพัก"
              placeholder="ชื่อมหาวิทยาลัย, สถานี BTS/MRT หรือย่าน"
              clearLabel="ล้างคำค้นหา"
              className="flex-1"
            />
            <Button type="submit">ค้นหา</Button>
          </form>

          <Link
            href="/signup?role=owner"
            data-analytics="landing_owner_cta_click"
            style={rise(320)}
            className="group landing-rise inline-flex items-center gap-1 rounded-md text-body-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            เป็นเจ้าของหอ? ลงประกาศฟรี
            <RiArrowRightLine
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

        {/* The live room map floats over the city: the same story, one building up close. */}
        <div className="landing-rise lg:mt-40" style={rise(200)}>
          <div className="rounded-3xl shadow-2xl">
            <LiveRoomGridPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
