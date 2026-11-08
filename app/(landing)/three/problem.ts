/**
 * "หาหอเองเหนื่อยตรงไหน": a phone whose screen plays the problem → solution pair that is active
 * in the cards beside it (problem-channel.ts). Each pair starts on the old way, drawn dim and
 * messy (a listing weeks out of date, costs nobody mentioned, a stranger asking for a deposit),
 * then resolves into DormDee's answer (the live room map, the move-in cost breakdown, a booking
 * request with the in-system warning). The phone is generic, built from primitives; its screen
 * is a canvas drawn here with the page's own font and theme tokens. It tilts toward the pointer
 * and turns a little as the section scrolls. With reduced motion it holds on the answer.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { getActiveProblem, subscribeActiveProblem } from "../problem-channel";
import {
  disposer,
  glowTexture,
  mountStage,
  type BuildContext,
  type MountOptions,
  type SceneParts,
  type StageInput,
  type Tokens,
} from "./stage";

export function mount(container: HTMLElement, options: MountOptions) {
  return mountStage(container, options, buildPhone);
}

// Phone dimensions (world units) and its screen canvas (pixels, same aspect as the glass).
const BODY_W = 3;
const BODY_H = 6.2;
const BODY_D = 0.34;
const GLASS_W = 2.86;
const CANVAS_W = 640;
const CANVAS_H = Math.round(CANVAS_W * ((BODY_H - 0.14) / GLASS_W));
const GLASS_H = GLASS_W * (CANVAS_H / CANVAS_W);

/** Seconds the old way stays up before DormDee's answer slides in, and the slide's length. */
const PROBLEM_HOLD = 1.9;
const RESOLVE = 0.65;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// Live room map on the first answer: 4 floors × 4 rooms. 0 vacant, 1 held, 2 occupied.
const MAP_ROOMS = ["501", "502", "503", "504", "401", "402", "403", "404", "301", "302", "303", "304", "201", "202", "203", "204"];

interface ScreenColors {
  dark: boolean;
  bezel: string;
  bg: string;
  card: string;
  cardStrong: string;
  line: string;
  ink: string;
  secondary: string;
  muted: string;
  accent: string;
  onAccent: string;
  bubbleMe: string;
  vacant: string;
  held: string;
  occupied: string;
  onStatus: string;
  rose: string;
  roseSoft: string;
  heldSoft: string;
}

function css(c: Color, alpha = 1) {
  const t = { r: 0, g: 0, b: 0 };
  c.getRGB(t, SRGBColorSpace);
  const v = (x: number) => Math.round(clamp01(x) * 255);
  return `rgb(${v(t.r)} ${v(t.g)} ${v(t.b)} / ${alpha})`;
}

function screenColors(t: Tokens): ScreenColors {
  const dark = t.dark;
  const bg = t.background;
  // stage.ts already turns the light theme's held token into a golden fill.
  const held = t.held.clone();
  return {
    dark,
    // Bezels are black glass in either theme.
    bezel: css(dark ? bg.clone().multiplyScalar(0.35) : t.ink.clone().lerp(bg, 0.04)),
    bg: css(bg),
    card: css(bg.clone().lerp(t.ink, dark ? 0.07 : 0.04)),
    cardStrong: css(bg.clone().lerp(t.ink, dark ? 0.12 : 0.08)),
    line: css(bg.clone().lerp(t.ink, dark ? 0.16 : 0.12)),
    ink: css(t.ink),
    secondary: css(t.ink.clone().lerp(bg, 0.35)),
    muted: css(t.ink.clone().lerp(bg, 0.55)),
    accent: css(t.accent),
    onAccent: css(dark ? t.ink : bg),
    bubbleMe: css(t.accent.clone().lerp(bg, dark ? 0.55 : 0.82)),
    vacant: css(t.charts[1]),
    held: css(held),
    occupied: css(bg.clone().lerp(t.ink, dark ? 0.22 : 0.18)),
    onStatus: css(dark ? bg : t.ink),
    rose: css(t.rose),
    roseSoft: css(t.rose, dark ? 0.16 : 0.1),
    heldSoft: css(held, dark ? 0.2 : 0.22),
  };
}

/** Breaks Thai (no spaces between words) and Latin text into lines that fit `maxWidth`. */
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const parts = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const part of parts) {
    const next = line + part;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line.trimEnd());
      line = part.trimStart();
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the app screen. One instance per scene; `draw` repaints the whole canvas. */
function createScreenPainter(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  let family = "sans-serif";

  const W = CANVAS_W;
  const H = CANVAS_H;
  const INSET = 20; // bezel width
  const PAD = 48; // content padding inside the screen
  const X0 = INSET + PAD;
  const CW = W - 2 * (INSET + PAD);

  function setFont(size: number, weight: number) {
    if (!ctx) return;
    ctx.font = `${weight} ${size}px ${family}`;
  }

  function rect(x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 2) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  function text(s: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign = "left") {
    if (!ctx) return;
    setFont(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(s, x, y);
  }

  /** A wrapped paragraph; returns the y below it. */
  function para(s: string, x: number, y: number, maxW: number, size: number, weight: number, color: string) {
    if (!ctx) return y;
    setFont(size, weight);
    const lh = size * 1.45;
    const lines = wrap(ctx, s, maxW);
    lines.forEach((l, i) => text(l, x, y + lh * (i + 0.5), size, weight, color));
    return y + lh * lines.length;
  }

  function dot(x: number, y: number, r: number, color: string) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function check(x: number, y: number, r: number, c: ScreenColors) {
    if (!ctx) return;
    dot(x, y, r, c.vacant);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y + r * 0.02);
    ctx.lineTo(x - r * 0.1, y + r * 0.38);
    ctx.lineTo(x + r * 0.5, y - r * 0.35);
    ctx.strokeStyle = c.onStatus;
    ctx.lineWidth = r * 0.28;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  /** A chat bubble; returns the y below it. */
  function bubble(s: string, side: "me" | "them", y: number, c: ScreenColors, tone: "plain" | "warn" = "plain") {
    if (!ctx) return y;
    const size = 27;
    setFont(size, 500);
    const maxW = CW * 0.78;
    const lines = wrap(ctx, s, maxW - 44);
    const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44);
    const lh = size * 1.4;
    const h = lines.length * lh + 30;
    const x = side === "me" ? X0 + CW - w : X0;
    const fill = side === "me" ? c.bubbleMe : tone === "warn" ? c.roseSoft : c.cardStrong;
    rect(x, y, w, h, 26, fill, tone === "warn" ? c.rose : undefined, 2);
    lines.forEach((l, i) => text(l, x + 22, y + 15 + lh * (i + 0.5), size, 500, c.ink));
    return y + h + 16;
  }

  function header(kind: "generic" | "dormdee", c: ScreenColors) {
    if (!ctx) return;
    const y = 128;
    if (kind === "generic") {
      dot(X0 + 22, y, 22, c.line);
      text("ประกาศหอพัก", X0 + 58, y, 30, 600, c.muted);
      rect(X0 + CW - 44, y - 8, 44, 6, 3, c.line);
      rect(X0 + CW - 44, y + 4, 44, 6, 3, c.line);
      return;
    }
    // House mark: a roof and a body, in the accent colour, then the wordmark.
    ctx.beginPath();
    ctx.moveTo(X0, y + 2);
    ctx.lineTo(X0 + 22, y - 18);
    ctx.lineTo(X0 + 44, y + 2);
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    rect(X0 + 8, y - 2, 28, 22, 4, undefined, c.accent, 6);
    text("DormDee", X0 + 58, y, 34, 700, c.ink);
    dot(X0 + CW - 22, y, 22, c.cardStrong);
  }

  /* The old way: dim, crooked, out of date. */
  function problem(i: number, c: ScreenColors) {
    if (!ctx) return;
    if (i === 0) {
      ctx.save();
      ctx.translate(W / 2, 400);
      ctx.rotate(-0.025);
      ctx.translate(-W / 2, -400);
      rect(X0, 205, CW, 360, 28, c.card);
      rect(X0 + 18, 223, CW - 36, 190, 18, c.line);
      // A placeholder photo: a few diagonal hatches.
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(X0 + 18, 223, CW - 36, 190, 18);
      ctx.clip();
      ctx.strokeStyle = c.card;
      ctx.lineWidth = 6;
      for (let k = -200; k < CW; k += 48) {
        ctx.beginPath();
        ctx.moveTo(X0 + 18 + k, 413);
        ctx.lineTo(X0 + 18 + k + 190, 223);
        ctx.stroke();
      }
      ctx.restore();
      text("ห้องว่าง ใกล้รถไฟฟ้า", X0 + 22, 455, 30, 600, c.secondary);
      text("฿4,500 / เดือน", X0 + 22, 505, 27, 500, c.muted);
      ctx.restore();
      // The stamp: posted months ago.
      ctx.save();
      ctx.translate(X0 + CW - 150, 300);
      ctx.rotate(-0.16);
      rect(-150, -34, 300, 68, 14, c.roseSoft, c.rose, 4);
      text("ประกาศเมื่อ 2 เดือนก่อน", 0, 0, 24, 700, c.rose, "center");
      ctx.restore();
      let y = bubble("ห้องนี้ยังว่างไหมคะ", "me", 610, c);
      y = bubble("เต็มไปนานแล้วค่ะ ลืมลบประกาศ", "them", y, c);
      text("ตอบกลับหลัง 3 วัน", X0 + 6, y + 12, 22, 500, c.muted);
      return;
    }
    if (i === 1) {
      ctx.save();
      ctx.translate(W / 2, 430);
      ctx.rotate(0.02);
      ctx.translate(-W / 2, -430);
      rect(X0, 205, CW, 450, 28, c.card);
      text("ค่าใช้จ่ายวันเข้าอยู่", X0 + 28, 258, 30, 600, c.secondary);
      const rows: [string, string, boolean][] = [
        ["ค่าเช่า", "฿4,500", false],
        ["เงินมัดจำ", "???", true],
        ["ค่าส่วนกลาง", "???", true],
        ["ค่าน้ำ ค่าไฟ", "ถามเจ้าของ", true],
      ];
      rows.forEach(([label, value, unknown], k) => {
        const ry = 330 + k * 64;
        text(label, X0 + 28, ry, 27, 500, c.muted);
        text(value, X0 + CW - 28, ry, 27, 600, unknown ? c.rose : c.secondary, "right");
      });
      rect(X0 + 28, 580, CW - 56, 2, 1, c.line);
      text("รวม", X0 + 28, 620, 28, 700, c.secondary);
      text("???", X0 + CW - 28, 620, 30, 700, c.rose, "right");
      ctx.restore();
      const y = bubble("วันเข้าอยู่มีค่าอื่นเพิ่มนะคะ", "them", 700, c);
      bubble("ทำไมไม่บอกตั้งแต่แรกคะ", "me", y, c);
      return;
    }
    // A stranger asking for a deposit before a viewing.
    dot(X0 + 30, 236, 30, c.cardStrong);
    text("?", X0 + 30, 237, 30, 700, c.muted, "center");
    text("ผู้ประกาศ", X0 + 76, 224, 27, 600, c.secondary);
    text("ไม่ได้ยืนยันตัวตน", X0 + 76, 256, 22, 500, c.muted);
    let y = bubble("โอนมัดจำมาก่อนนะคะ จะล็อกห้องให้", "them", 300, c);
    y = bubble("บัญชี xxx-x-x4521-x", "them", y, c);
    y = bubble("ยังไม่ได้ดูห้องเลยค่ะ", "me", y, c);
    bubble("คนจองเยอะ รีบโอนภายในวันนี้นะคะ", "them", y, c, "warn");
  }

  /* DormDee's answer: clean, current, confirmed in the system. */
  function solution(i: number, c: ScreenColors, map: Uint8Array) {
    if (!ctx) return;
    if (i === 0) {
      text("ผังห้อง", X0, 230, 34, 700, c.ink);
      text("บ้านสวนเรสซิเดนซ์ · ห้องสตูดิโอ", X0, 272, 23, 500, c.muted);
      // Live badge.
      rect(X0 + CW - 150, 210, 150, 42, 21, c.card);
      dot(X0 + CW - 126, 231, 7, c.vacant);
      text("อัปเดตสด", X0 + CW - 108, 232, 22, 600, c.secondary);
      const gap = 14;
      const cw = (CW - gap * 3) / 4;
      const ch = 84;
      MAP_ROOMS.forEach((no, k) => {
        const col = k % 4;
        const row = Math.floor(k / 4);
        const x = X0 + col * (cw + gap);
        const y = 312 + row * (ch + gap);
        const s = map[k];
        rect(x, y, cw, ch, 18, s === 0 ? c.vacant : s === 1 ? c.held : c.occupied);
        text(no, x + cw / 2, y + ch / 2, 26, 700, s === 2 ? c.secondary : c.onStatus, "center");
      });
      // Legend, so the colours are labelled on the screen too.
      const ly = 735;
      const legend: [string, string][] = [
        ["ว่าง", c.vacant],
        ["ติดจอง", c.held],
        ["มีผู้เช่า", c.occupied],
      ];
      let lx = X0;
      setFont(23, 500);
      for (const [label, color] of legend) {
        dot(lx + 9, ly, 9, color);
        text(label, lx + 26, ly + 1, 23, 500, c.secondary);
        lx += 26 + (ctx.measureText(label).width || 60) + 30;
      }
      const vacant = Array.from(map).filter((s) => s === 0).length;
      rect(X0, 790, CW, 120, 26, c.card);
      text(`ว่างตอนนี้ ${vacant} ห้อง`, X0 + 28, 832, 28, 700, c.ink);
      text("ห้องถูกจองเมื่อไร ผังก็เปลี่ยนเอง", X0 + 28, 874, 23, 500, c.muted);
      rect(X0, 940, CW, 88, 44, c.accent);
      text("แชทเพื่อจอง", W / 2, 985, 29, 700, c.onAccent, "center");
      return;
    }
    if (i === 1) {
      text("ค่าใช้จ่ายวันเข้าอยู่", X0, 230, 34, 700, c.ink);
      text("ห้องสตูดิโอ · ฿4,500 / เดือน", X0, 272, 23, 500, c.muted);
      rect(X0, 310, CW, 330, 28, c.card);
      const rows: [string, string][] = [
        ["ค่าเช่าล่วงหน้า 1 เดือน", "฿4,500"],
        ["เงินมัดจำ 2 เดือน", "฿9,000"],
      ];
      rows.forEach(([label, value], k) => {
        const ry = 370 + k * 70;
        text(label, X0 + 28, ry, 27, 500, c.secondary);
        text(value, X0 + CW - 28, ry, 27, 600, c.ink, "right");
      });
      rect(X0 + 28, 490, CW - 56, 2, 1, c.line);
      text("รวมจ่ายวันเข้าอยู่", X0 + 28, 540, 28, 700, c.ink);
      text("฿13,500", X0 + CW - 28, 590, 40, 700, c.accent, "right");
      rect(X0, 670, CW, 220, 28, c.card);
      text("รายเดือนโดยประมาณ", X0 + 28, 720, 25, 600, c.secondary);
      text("ค่าน้ำ", X0 + 28, 782, 26, 500, c.secondary);
      text("฿18 / หน่วย", X0 + CW - 28, 782, 26, 600, c.ink, "right");
      text("ค่าไฟ", X0 + 28, 840, 26, 500, c.secondary);
      text("฿7 / หน่วย", X0 + CW - 28, 840, 26, 600, c.ink, "right");
      check(X0 + 20, 950, 20, c);
      text("เห็นครบก่อนตัดสินใจ", X0 + 56, 951, 27, 600, c.ink);
      return;
    }
    text("คำขอจอง", X0, 230, 34, 700, c.ink);
    text("ส่งผ่าน DormDee", X0, 272, 23, 500, c.muted);
    rect(X0, 310, CW, 300, 28, c.card);
    text("ห้อง 204 · ห้องสตูดิโอ", X0 + 28, 365, 29, 700, c.ink);
    text("เข้าอยู่ 1 มิ.ย. · สัญญา 12 เดือน", X0 + 28, 412, 24, 500, c.secondary);
    rect(X0 + 28, 450, CW - 56, 2, 1, c.line);
    rect(X0 + 28, 485, 262, 54, 27, c.heldSoft);
    dot(X0 + 54, 512, 8, c.held);
    text("รอเจ้าของหอยืนยัน", X0 + 72, 513, 23, 600, c.ink);
    text("ยังไม่ต้องโอนเงิน", X0 + 28, 575, 23, 500, c.muted);
    // The in-system warning.
    rect(X0, 640, CW, 190, 28, c.roseSoft, c.rose, 2);
    dot(X0 + 46, 696, 22, c.rose);
    text("!", X0 + 46, 697, 28, 800, c.onAccent, "center");
    para("อย่าโอนเงินนอกระบบ ก่อนเจ้าของหอยืนยันการจอง", X0 + 86, 664, CW - 116, 26, 600, c.ink);
    check(X0 + 20, 890, 20, c);
    text("การจองยืนยันในระบบ", X0 + 56, 891, 27, 600, c.ink);
  }

  function draw(c: ScreenColors, index: number, mix: number, map: Uint8Array, fontsReady: boolean) {
    if (!ctx) return;
    family = getComputedStyle(document.body).fontFamily || "sans-serif";
    ctx.clearRect(0, 0, W, H);

    // Bezel and screen.
    rect(0, 0, W, H, 76, c.bezel);
    rect(INSET, INSET, W - INSET * 2, H - INSET * 2, 58, c.bg);

    if (fontsReady) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(INSET, INSET, W - INSET * 2, H - INSET * 2, 58);
      ctx.clip();

      if (mix < 1) {
        ctx.save();
        ctx.globalAlpha = (1 - mix) * 0.92;
        ctx.translate(0, -mix * 36);
        header("generic", c);
        problem(index, c);
        ctx.restore();
      }
      if (mix > 0) {
        ctx.save();
        ctx.globalAlpha = mix;
        ctx.translate(0, (1 - mix) * 48);
        header("dormdee", c);
        solution(index, c, map);
        ctx.restore();
      }

      // Status bar.
      text("9:41", INSET + 52, 62, 24, 600, c.ink);
      rect(W - INSET - 92, 52, 44, 22, 7, undefined, c.secondary, 2.5);
      rect(W - INSET - 88, 56, 30, 14, 4, c.ink);
      ctx.restore();
    }

    // Front camera, a punch hole in the glass.
    dot(W / 2, 62, 14, c.bezel);
    // Home indicator.
    rect(W / 2 - 90, H - INSET - 34, 180, 9, 5, c.secondary);
  }

  return { draw };
}

function buildPhone({ renderer, reducedMotion }: BuildContext): SceneParts {
  const gpu = disposer();
  const white = new Color(1, 1, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  let distance = 15;

  const hemi = new HemisphereLight(white.clone(), white.clone(), 1);
  const key = new DirectionalLight(white.clone(), 1.3);
  key.position.set(-4, 5, 7);
  const rim = new DirectionalLight(white.clone(), 0.7);
  rim.position.set(5, -1, -3);
  scene.add(hemi, key, rim);

  const phone = new Group();
  scene.add(phone);

  // Body, side buttons, rear camera module.
  const bodyMaterial = gpu.track(new MeshPhongMaterial({ shininess: 90 }));
  const body = new Mesh(gpu.track(new RoundedBoxGeometry(BODY_W, BODY_H, BODY_D, 6, 0.42)), bodyMaterial);
  phone.add(body);

  const buttonGeometry = gpu.track(new RoundedBoxGeometry(0.08, 1, 0.14, 2, 0.03));
  for (const [y, h] of [
    [1.6, 0.75],
    [0.6, 0.45],
  ]) {
    const button = new Mesh(buttonGeometry, bodyMaterial);
    button.position.set(BODY_W / 2 + 0.02, y, 0);
    button.scale.y = h;
    phone.add(button);
  }

  const lensMaterial = gpu.track(new MeshPhongMaterial({ shininess: 120 }));
  const moduleMaterial = gpu.track(new MeshPhongMaterial({ shininess: 60 }));
  const cameraModule = new Mesh(gpu.track(new RoundedBoxGeometry(1.15, 1.15, 0.1, 3, 0.26)), moduleMaterial);
  cameraModule.position.set(-BODY_W / 2 + 0.85, BODY_H / 2 - 0.85, -BODY_D / 2 - 0.04);
  phone.add(cameraModule);
  const lensGeometry = gpu.track(new CylinderGeometry(0.2, 0.2, 0.08, 24));
  for (const [x, y] of [
    [-0.24, 0.24],
    [0.24, -0.24],
  ]) {
    const lens = new Mesh(lensGeometry, lensMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(cameraModule.position.x + x, cameraModule.position.y + y, -BODY_D / 2 - 0.1);
    phone.add(lens);
  }

  // The glass: bezel and screen drawn into one canvas, corners left transparent.
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const painter = createScreenPainter(canvas);
  const screenTexture = gpu.track(new CanvasTexture(canvas));
  screenTexture.colorSpace = SRGBColorSpace;
  screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screenMaterial = gpu.track(new MeshBasicMaterial({ map: screenTexture, transparent: true, toneMapped: false }));
  const screen = new Mesh(gpu.track(new PlaneGeometry(GLASS_W, GLASS_H)), screenMaterial);
  screen.position.z = BODY_D / 2 + 0.002;
  phone.add(screen);

  // A soft glow behind the phone.
  const glow = gpu.track(glowTexture());
  const haloMaterial = gpu.track(new SpriteMaterial({ map: glow, transparent: true, depthWrite: false }));
  const halo = new Sprite(haloMaterial);
  halo.position.set(0, 0, -1.2);
  halo.scale.set(11, 13, 1);
  scene.add(halo);

  // Screen state.
  let colors!: ScreenColors;
  let fontsReady = false;
  let shown = getActiveProblem();
  let switchedAt = 0;
  let elapsed = 0;
  let lastKey = "";
  const map = new Uint8Array([0, 2, 2, 1, 2, 0, 2, 2, 0, 2, 1, 2, 2, 2, 0, 0]);
  let mapTick = 0;
  let nextFlip = 0;

  function redraw(mix: number, force = false) {
    const key = `${shown}|${mix.toFixed(3)}|${mapTick}|${fontsReady}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    painter.draw(colors, shown, mix, map, fontsReady);
    screenTexture.needsUpdate = true;
  }

  const currentMix = () => (reducedMotion ? 1 : smooth(clamp01((elapsed - switchedAt - PROBLEM_HOLD) / RESOLVE)));

  // Wait for the page's fonts so Thai glyphs draw in the site's typeface, then paint.
  let disposed = false;
  document.fonts.ready.then(() => {
    if (disposed) return;
    fontsReady = true;
    redraw(currentMix(), true);
    if (reducedMotion) renderer.render(scene, camera);
  });

  // A card was chosen (or the cards moved on): start that pair from its problem.
  const unsubscribe = subscribeActiveProblem((index) => {
    shown = index;
    switchedAt = elapsed;
    // With reduced motion there is no loop to pick this up, so paint and render now.
    if (reducedMotion) {
      redraw(1, true);
      renderer.render(scene, camera);
    }
  });

  function applyTokens(tokens: Tokens) {
    colors = screenColors(tokens);
    const night = tokens.dark;
    const surface = tokens.surface;
    // Graphite by night, silver by day.
    bodyMaterial.color.copy(night ? surface.clone().lerp(tokens.ink, 0.16) : surface.clone().lerp(tokens.ink, 0.1));
    bodyMaterial.specular.copy(tokens.ink).multiplyScalar(night ? 0.25 : 0.12);
    moduleMaterial.color.copy(bodyMaterial.color).multiplyScalar(0.9);
    lensMaterial.color.copy(night ? tokens.background.clone().multiplyScalar(0.4) : tokens.ink.clone().lerp(tokens.background, 0.05));
    lensMaterial.specular.copy(white).multiplyScalar(0.6);
    hemi.color.copy(white).lerp(tokens.accentSoft, 0.15);
    hemi.groundColor.copy(surface);
    hemi.intensity = night ? 0.9 : 1.1;
    key.intensity = night ? 1 : 1.3;
    haloMaterial.color.copy(tokens.accent);
    haloMaterial.opacity = night ? 0.35 : 0.22;
    haloMaterial.blending = night ? AdditiveBlending : NormalBlending;
    haloMaterial.needsUpdate = true;
    redraw(currentMix(), true);
  }

  function resize(width: number, height: number) {
    camera.aspect = width / height;
    // Fit the phone's height, and its width on narrow boxes, with room to tilt.
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    // Portrait panels get extra headroom so the phone clears the caption at the top.
    distance = Math.max((camera.aspect < 1 ? 4.3 : 3.85) / tanHalf, 2.3 / (tanHalf * camera.aspect));
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function update(dt: number, time: number, input: StageInput) {
    elapsed = time;
    const motion = reducedMotion ? 0 : 1;
    const { pointer, through } = input;

    // Held at a fixed three-quarter angle under reduced motion.
    phone.rotation.y = motion ? -0.32 + pointer.x * 0.35 + (through - 0.5) * 0.6 : -0.24;
    phone.rotation.x = motion ? 0.05 - pointer.y * 0.18 : 0.05;
    phone.rotation.z = 0.02 * motion;
    phone.position.y = Math.sin(time * 0.9) * 0.08 * motion;

    // The live room map keeps itself current while its answer is on screen.
    const mix = currentMix();
    if (dt > 0 && shown === 0 && mix === 1 && time >= nextFlip) {
      nextFlip = time + 1.1 + Math.random() * 0.6;
      const k = Math.floor(Math.random() * map.length);
      map[k] = map[k] === 0 ? 1 : map[k] === 1 ? (Math.random() < 0.6 ? 2 : 0) : 0;
      mapTick++;
    }
    redraw(mix);
  }

  return {
    scene,
    camera,
    applyTokens,
    resize,
    update,
    dispose() {
      disposed = true;
      unsubscribe();
      gpu.dispose();
    },
  };
}
