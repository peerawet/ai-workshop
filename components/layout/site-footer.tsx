import Link from "next/link";
import { cacheLife } from "next/cache";
import { RiHome4Line } from "@remixicon/react";

const COLUMNS = [
  {
    title: "ผู้เช่า",
    links: [
      { href: "/search", label: "ค้นหาหอพัก" },
      { href: "/#areas", label: "ทำเลยอดนิยม" },
    ],
  },
  {
    title: "เจ้าของหอ",
    links: [
      { href: "/signup?role=owner", label: "ลงประกาศฟรี" },
      { href: "/login", label: "เข้าสู่ระบบ" },
    ],
  },
  {
    title: "เกี่ยวกับ",
    links: [
      { href: "/#faq", label: "คำถามที่พบบ่อย" },
      { href: "/privacy", label: "นโยบายความเป็นส่วนตัว" },
      { href: "/terms", label: "เงื่อนไขการใช้งาน" },
    ],
  },
];

/** Cached, so reading the clock does not make every page dynamic. */
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="border-t border-separator-border bg-background-primary-default">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2 self-start text-headline-semibold text-text-primary">
            <RiHome4Line className="size-6 text-accent-500" aria-hidden />
            DormDee
          </Link>
          <p className="max-w-xs text-body-regular text-text-secondary">
            หาหอพักที่ว่างจริง เห็นค่าใช้จ่ายครบ และจองกับเจ้าของหอได้ทันทีผ่านแชท
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <h2 className="text-body-semibold text-text-primary">{column.title}</h2>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded-sm text-body-regular text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-separator-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6">
          <p className="text-caption-1-regular text-text-tertiary">
            © <CopyrightYear /> DormDee
          </p>
          {/* Theme: the header has the switch from sm up; phones get FloatingThemeToggle. */}
        </div>
      </div>
    </footer>
  );
}
