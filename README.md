# DormDee · หาหอพักที่ว่างจริง จองผ่านแชท

แพลตฟอร์มหอพักที่ใช้ข้อมูลชุดเดียวกันทั้งหน้าประกาศและระบบจัดการห้อง ผู้เช่าค้นหาหอ เห็นห้องที่ว่างจริงตอนนี้ แล้วจองผ่านแชทกับเจ้าของหอ ส่วนเจ้าของหอลงประกาศ จัดการผังห้อง และตอบคำขอจองได้ในที่เดียว

<h2 align="center">🌐 ลองใช้เว็บจริง</h2>

<p align="center">
  <a href="https://ai-workshop-two-peach.vercel.app/">
    <img src="https://img.shields.io/badge/Live_demo-ai--workshop--two--peach.vercel.app-000000?style=for-the-badge&logo=vercel" alt="Live demo บน Vercel">
  </a>
</p>

<p align="center">
  <a href="https://ai-workshop-two-peach.vercel.app/"><b>https://ai-workshop-two-peach.vercel.app</b></a><br>
  deploy บน Vercel + Supabase · ใช้ได้ทั้งคอมและมือถือ
</p>

| ลองอะไร | ทำอย่างไร |
|---|---|
| ค้นหาหอ | กด "ค้นหาหอพัก" → กรองจังหวัด ประเภทหอ ช่วงค่าเช่า สิ่งอำนวยความสะดวก หรือติ๊ก "เฉพาะห้องว่าง" → สลับมุมมอง รายการ / แผนที่ (มีหอตัวอย่าง 7 แห่ง) |
| ค้นหาตามเวลาเดินทาง | เลือกจุดหมาย (มหาวิทยาลัย, BTS/MRT) วิธีเดินทาง และเวลาไม่เกิน 10–60 นาที |
| ดูรายละเอียดหอ | รูป · ประเภทห้อง · เครื่องคิดค่าแรกเข้า · ผังห้องรายชั้นพร้อมสถานะสด · แผนที่ · รีวิว |
| จองผ่านแชท | สมัครเป็นผู้เช่า → กด "แชทเพื่อจอง" → ส่งคำขอจอง (ประเภทห้อง วันเข้าอยู่ ระยะสัญญา) |
| ฝั่งเจ้าของหอ | สมัครเป็นเจ้าของหอ → "ลงประกาศหอพักฟรี" → ใส่ข้อมูลหอ หมุดแผนที่ รูป ประเภทห้อง ผังห้อง → ตอบคำขอจองในแชท (กันห้อง 24 / 48 / 72 ชม. ยืนยัน หรือปฏิเสธ) |
| หาเพื่อนร่วมห้อง | เมนู "หาเพื่อนร่วมห้อง" กรองตามจังหวัด งบ และไลฟ์สไตล์ |

> ⚠️ เป็นเว็บสาธิต หอทั้ง 7 แห่งเป็นข้อมูลตัวอย่าง ไม่ต้องใส่ข้อมูลส่วนตัวจริง และ **อย่าโอนเงินจริง** ผ่าน QR มัดจำ

## ทำอะไรได้แล้ว (v1.2.0)

| ใคร | ฟีเจอร์ |
|---|---|
| ผู้เช่า | ค้นหาแบบรายการและแผนที่ · ค้นหาตามเวลาเดินทาง · คิดค่าแรกเข้า · แชทกับเจ้าของหอแบบ real-time · ส่งคำขอจอง · จ่ายมัดจำด้วย PromptPay QR และแนบสลิป · แจ้งเตือนเมื่อห้องเต็มกลับมาว่าง · รีวิวหลังจองยืนยัน · รายงานประกาศน่าสงสัย · หาเพื่อนร่วมห้อง |
| เจ้าของหอ | สร้างและเผยแพร่หอ · ผังห้องรายชั้น · กันห้อง ยืนยัน ปฏิเสธในแชท (ห้องที่กันไว้หมดเวลาแล้วคืนเอง) · ตั้ง PromptPay · ผู้ช่วย AI ตอบแชทตอนไม่อยู่ · สถิติ (ยอดเข้าชม อัตราแชทเป็นการจอง อัตราเข้าพัก เทียบราคาหอใกล้เคียง) · ยืนยันตัวตนรับป้าย Verified |
| บัญชีและแอดมิน | สมัครด้วยอีเมลหรือ Google · ลืมรหัสผ่าน · ธีมสว่าง/มืด · ขอข้อมูลส่วนบุคคลและลบบัญชี · แผงแอดมินตรวจคำขอยืนยันตัวตน รายงาน และปิดประกาศ |

รายละเอียดทั้งหมดอยู่ใน [`CHANGELOG.md`](CHANGELOG.md)

| | |
|---|---|
| Stack | Next.js 16 (App Router, TypeScript) · React 19 · Tailwind CSS v4 + [BoardUI](https://www.boardui.com) · Supabase (Postgres, Auth, Storage, Realtime) · Leaflet · Three.js |
| Deploy | Vercel + Supabase |
| CI | GitHub Actions ตรวจ lint, typecheck, build ทุก PR เข้า `develop` และ `main` |
| เทสต์อัตโนมัติ | ยังไม่มี ดู [แผนทดสอบ](#-แผนทดสอบตามแบบฝึกหัด-ยังไม่เริ่ม) ด้านล่าง |

| เอกสาร | มีอะไร |
|---|---|
| [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md) | บทบาทผู้ใช้ · requirement · สำรวจตลาด · ฟีเจอร์ที่ทำให้ต่างจากเว็บอื่น |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | แผนพัฒนาเป็นเฟส |
| [`docs/USER_STORIES.md`](docs/USER_STORIES.md) | User story เรื่องบัญชีและการเริ่มใช้งาน (US-01–12) |
| [`docs/LANDING_PAGE_SPEC.md`](docs/LANDING_PAGE_SPEC.md) | สเปกหน้าแรก |
| [`docs/DEVELOP_FLOW.md`](docs/DEVELOP_FLOW.md) | วิธีแตก branch และ release |

---

## 🧪 แผนทดสอบตามแบบฝึกหัด (ยังไม่เริ่ม)

> **สถานะ: เป็นแผนเท่านั้น ยังไม่ได้ลงมือ** ตอนนี้ยังไม่มีโฟลเดอร์ `qa/` ยังไม่ได้ติดตั้ง Playwright และยังไม่มีไฟล์ผลลัพธ์ตามตารางด้านล่าง

แผนนี้ใช้ [บท 04 · สบายใจ สปา](https://github.com/Tuchsanai/Teaching_CWN2026/tree/main/00_week01/04_sabai-spa-web-and-testplan-from-interview) ของวิชา [Teaching CWN 2026](https://github.com/Tuchsanai/Teaching_CWN2026) เป็นแม่แบบ บทนั้นมี LAB 0–13 ไล่จากฟังร้าน ออกแบบ สร้าง สำรวจ เขียนแผน ไปจนพิสูจน์ด้วย Playwright แผนนี้จะเดินตามลำดับเดิม แต่เปลี่ยนโจทย์จากร้านสปาเป็น DormDee โดยยึดหลักของบทว่า **"ร้านขอ ≠ AI บอกว่าทำแล้ว ≠ เว็บทำจริง"** งานคือพิสูจน์ว่าเว็บทำตามกฎจริง ไม่ใช่เชื่อตามที่เห็น

### ต่างจากบท 04 ตรงไหน

| เรื่อง | บท 04 (สปา) | DormDee |
|---|---|---|
| เว็บ | AI สร้างใหม่จาก BUILD-PROMPT ใน LAB 5–6 | มีเว็บจริงอยู่แล้ว LAB 5–6 จึงเปลี่ยนเป็น "เตรียมเว็บให้ทดสอบได้" |
| ฐานข้อมูล | Docker 2 กล่อง (web + db) | Supabase local (`npx supabase start`) · ล้างข้อมูลด้วย `npx supabase db reset` |
| ทดสอบที่ไหน | `localhost:3000` | `npm run dev` + Supabase local เท่านั้น **ไม่ยิง test ใส่เว็บจริงบน Vercel** เพื่อไม่ให้ข้อมูลทดสอบปนข้อมูลจริง |
| กันอบบั๊ก | agent ที่ทดสอบห้ามอ่านโค้ดใน `web/` | agent ที่สำรวจและเขียน test ห้ามอ่าน `app/` `lib/` `supabase/` อ่านได้แค่ `qa/SPEC.md` |
| เวลา | ล็อกวันที่ไว้ค่าเดียว | การกันห้อง 24 / 48 / 72 ชม. หมดเวลาเอง ต้องมีทางเลื่อนเวลาในโหมดทดสอบ |
| บั๊กปริศนา | AI ฝังบั๊ก 3 ตัวตอนสร้างเว็บ (`BUG_MODE=1`) | ให้ Claude อีกหน้าต่างฝังบั๊ก 3 ตัวไว้หลังสวิตช์ `BUG_MODE=1` ซึ่งทำงานเฉพาะในเครื่อง |

### เรื่องที่จะเน้นทดสอบ

| เรื่อง | ทำไมเสี่ยง | ตัวอย่างค่าขอบ |
|---|---|---|
| สถานะห้องและการกันห้อง | หัวใจของ "ห้องว่างจริง" ถ้าสถานะค้างหรือซ้อน ประกาศก็ไม่จริง | กัน 24 ชม.: ก่อนหมด 1 วินาที / พอดี / เกิน 1 วินาที |
| ขอห้องสุดท้ายพร้อมกัน | สองคนกดพร้อมกันต้องได้ห้องแค่คนเดียว | 2 browser context กดพร้อมกันจริง |
| ค่าแรกเข้า | เรื่องเงิน ผิดบาทเดียวก็เสียความเชื่อใจ | มัดจำ ค่าล่วงหน้า ค่าน้ำไฟ ตามประเภทห้อง คิดด้วยมือก่อนเปิดเว็บ |
| สิทธิ์ | เจ้าของหอแก้ได้เฉพาะหอตัวเอง · รีวิวได้เฉพาะคนที่จองยืนยันแล้ว | เจ้าของ A แก้หอของ B · รีวิวก่อนและหลังยืนยัน |
| มัดจำและสลิป | แนบสลิปได้เฉพาะหลังเจ้าของกันหรือยืนยันห้อง | ก่อนกัน / หลังกัน / หลังปฏิเสธ |
| ค้นหาและตัวกรอง | ห้องเต็มต้องไม่โผล่เมื่อติ๊ก "เฉพาะห้องว่าง" | ว่าง 0 ห้อง / 1 ห้อง |

### ลำดับ LAB

| LAB | ทำอะไร | ได้ไฟล์ (ใน `qa/`) | ปรับจากบท 04 | สถานะ |
|---|---|---|---|---|
| 0 | เช็กเครื่อง | ตารางความพร้อม | Node 22 · Docker · Supabase CLI · Playwright · ffmpeg · พอร์ต 3000 และ 54321–54324 | ⬜ ยังไม่เริ่ม |
| 1 | บันทึกสัมภาษณ์ → User Story | `interview/INTERVIEW.md` `USER-STORIES.md` | เขียนบันทึกสัมภาษณ์จำลองเอง (เจ้าของหอ · ผู้เช่านักศึกษา · ผู้เช่าวัยทำงาน · ผู้จัดการหอ) จาก `docs/PRODUCT_PLAN.md` ตั้งใจให้มีจุดที่พูดขัดกัน · เทียบกับ `docs/USER_STORIES.md` ที่มีแค่เรื่องบัญชี | ⬜ ยังไม่เริ่ม |
| 2 | คำตอบเจ้าของหอ → FR / BR / NFR | `interview/OWNER-ANSWERS.md` `REQUIREMENTS.md` | BR ทุกข้อมีค่าขอบ 3 ค่า รวมขอบเวลาของการกันห้อง | ⬜ ยังไม่เริ่ม |
| 3 | System Design | `DESIGN.md` `design/` | Flowchart สถานะการจอง (ขอจอง → กันห้อง → ยืนยัน / ปฏิเสธ / หมดเวลา) · ERD เทียบกับ `supabase/migrations/` · Sequence: สองคนขอห้องสุดท้ายพร้อมกัน และกันห้องจนหมดเวลา | ⬜ ยังไม่เริ่ม |
| 4 | ข้อมูลทดสอบ | `TEST-DATA.md` | บัญชีครบ 4 บทบาท · ห้องครบ 4 สถานะ · ตารางค่าแรกเข้าคิดด้วยมืออย่างน้อย 10 แถว | ⬜ ยังไม่เริ่ม |
| 5 | สเปกสำหรับคนทดสอบ | `SPEC.md` | ใช้แทน BUILD-PROMPT เพราะมีเว็บแล้ว: รายการหน้า · `data-testid` · hook ทดสอบที่ต้องเพิ่ม | ⬜ ยังไม่เริ่ม |
| 6 | เตรียมเว็บให้ทดสอบได้ | โค้ด hook ทดสอบ · `BUGS.md` (ปิดไว้) | เพิ่ม `data-testid` · reset ข้อมูล · ทางเลื่อนเวลา · `BUG_MODE=1` (ห้ามเปิด `BUGS.md` จนถึงท้าย LAB 13) · ทุกอย่างทำงานเฉพาะในเครื่อง | ⬜ ยังไม่เริ่ม |
| 7 | วางแผนสำรวจ | `CHARTERS.md` | ของกลางที่ต้องกันชนกัน = สถานะห้อง การกันห้อง แชท | ⬜ ยังไม่เริ่ม |
| 8 | สำรวจขนาน | `exploration/` | agent สำรวจด้วย playwright-cli กับเว็บในเครื่อง ไม่อ่านโค้ด | ⬜ ยังไม่เริ่ม |
| 9 | รวมผล + ผู้ตัดสินแยก | `EXPLORATION.md` | P1 = ห้องถูกจองซ้อน · ห้องค้าง "ติดจอง" หลังหมดเวลา · เห็นหรือแก้ข้อมูลของคนอื่นได้ | ⬜ ยังไม่เริ่ม |
| 10 | เขียนแผนทดสอบ | `TEST-PLAN.md` `plan/` | แบ่งหมวดตามบทบาท: ผู้เช่า / เจ้าของหอ / แอดมิน / บัญชี | ⬜ ยังไม่เริ่ม |
| 11 | รีวิวแผน | `PLAN-REVIEW.md` `review/` | ผู้รีวิวไม่ใช่คนเขียน · ตรวจว่าบัญชีหรือห้องจะชนกันตอนรันขนานไหม | ⬜ ยังไม่เริ่ม |
| 12 | ทดสอบจริงด้วย Playwright | `e2e/` `e2e/index.html` | Chromium + จอมือถือ (เว็บออกแบบ mobile-first) · 2 browser context ขอห้องสุดท้ายพร้อมกัน · GIF หลักฐานทุก test | ⬜ ยังไม่เริ่ม |
| 13 | บั๊กปริศนา | `BUG-HUNT.md` | เปิด `BUG_MODE=1` แล้วดูว่าแผนจับได้กี่ตัวจาก 3 | ⬜ ยังไม่เริ่ม |

### โครงโฟลเดอร์ที่จะเพิ่ม

```text
qa/                         ← ยังไม่สร้าง
├─ prompts/                 พรอมต์ทุก LAB (lab0.md … lab13.md) เก็บตัวต่อตัว ไม่สรุป
├─ interview/               INTERVIEW.md · OWNER-ANSWERS.md
├─ USER-STORIES.md  REQUIREMENTS.md  DESIGN.md  design/  TEST-DATA.md  SPEC.md
├─ CHARTERS.md  exploration/  EXPLORATION.md
├─ TEST-PLAN.md  plan/  PLAN-REVIEW.md  review/
├─ e2e/                     Playwright (TypeScript) · index.html · triage.json · test-report/ (GIF)
└─ BUG-HUNT.md
```

### เรื่องที่ต้องตัดสินก่อนเริ่ม

| เรื่อง | ทางเลือก |
|---|---|
| เลื่อนเวลาให้การกันห้องหมดอายุ | endpoint ทดสอบที่ตั้ง "เวลาปัจจุบัน" ได้ หรือแก้เวลาหมดอายุในฐานข้อมูลตรง ๆ ก่อนรัน test |
| รันขนาน | Supabase local หลายชุดคนละพอร์ต หรือรันทีละหมวดด้วย `workers: 1` |
| `BUG_MODE` | ฝังใน server action หรือ SQL function · ต้องพิสูจน์ได้ว่าปิดอยู่บน production |
| นอกขอบเขต | LINE · ผู้ช่วย AI ตอบแชท · ล็อกอิน Google (ต้องใช้คีย์จริง) |

---

## 💻 รันในเครื่อง

ต้องมี Node 22 และ Docker (สำหรับ Supabase local)

```bash
npm install
npx supabase start            # Postgres + Auth + Storage ในเครื่อง และรัน supabase/migrations
npx supabase status -o env    # คัดลอก API_URL และ PUBLISHABLE_KEY ไปใส่ .env.local
cp .env.example .env.local
npm run dev
```

เปิด http://localhost:3000

คีย์ที่ไม่บังคับใน `.env.example` ได้แก่ `SUPABASE_SECRET_KEY`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_BOT_BASIC_ID`, `ANTHROPIC_API_KEY` ถ้าไม่ใส่ LINE กับผู้ช่วย AI จะปิดอยู่ ส่วนอื่นใช้ได้ปกติ

## ฐานข้อมูล

- migration อยู่ใน `supabase/migrations/` สร้างใหม่ด้วย `npx supabase migration new <name>`
- ใช้ migration ใหม่กับ stack ที่รันอยู่: `npx supabase migration up` · ล้างทั้งหมด (migration + seed): `npx supabase db reset`
- แก้ schema แล้วให้สร้าง type ใหม่ด้วย `npm run db:types`
- `supabase/seed.sql` สร้างบัญชีทดสอบในเครื่อง 3 บัญชี (เจ้าของหอ ผู้เช่า แอดมิน รหัสผ่านอยู่ในไฟล์นั้น) และหอตัวอย่าง 7 แห่ง รูปอยู่ใน `public/seed`
- ทุกตารางเปิด Row Level Security หอที่เผยแพร่แล้วเป็นข้อมูลสาธารณะ เจ้าของหอจัดการได้เฉพาะข้อมูลของตัวเอง

## CI และ deploy

- GitHub Actions (`.github/workflows/ci.yml`) รัน lint, typecheck, build ทุก PR เข้า `develop` และ `main`
- Vercel: import repo แล้วตั้ง `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` ทุก PR จะได้ preview URL

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เปิด dev server |
| `npm run build` | build สำหรับ production |
| `npm run lint` | ESLint |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm run db:types` | สร้าง `lib/supabase/database.types.ts` ใหม่จากฐานข้อมูลในเครื่อง |

## เพิ่ม UI component

ใช้ BoardUI ก่อนเสมอ (กฎการออกแบบอยู่ใน `AGENTS.md`)

```bash
npx boardui@latest add <component-name>
```

## Branching

เริ่มงานใหม่จาก `develop`

```bash
git checkout develop
git pull
git checkout -b feature/<short-name>
```
