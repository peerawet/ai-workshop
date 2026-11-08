import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Thai } from "next/font/google";
import "@/styles/globals.css";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { FloatingThemeToggle } from "@/components/layout/floating-theme-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { THEME_STORAGE_KEY } from "@/components/application/theme/theme-toggle";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], axes: ["opsz"] });
// Inter has no Thai glyphs; theme.css falls back to this face for Thai text.
const notoThai = Noto_Sans_Thai({ variable: "--font-thai", subsets: ["thai"] });
const mono = JetBrains_Mono({ variable: "--font-mono-source", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "DormDee – หาหอพัก ห้องว่างจริง จองผ่านแชท", template: "%s | DormDee" },
  description:
    "ค้นหาหอพักและอพาร์ตเมนต์ เห็นห้องว่างจริงแบบ real-time ค่าใช้จ่ายโปร่งใส และจองกับเจ้าของหอได้ทันทีผ่านแชท",
};

// Dark is the default and ships in the HTML. A saved "light" choice is applied before first
// paint, so neither theme flashes the other.
const themeScript = `try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${inter.variable} ${notoThai.variable} ${mono.variable} dark h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background-full text-text-primary">
        {/* Sets React Aria's locale (number and date formatting, keyboard direction) to Thai. */}
        <DirectionProvider locale="th-TH">
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
          <FloatingThemeToggle />
        </DirectionProvider>
      </body>
    </html>
  );
}
