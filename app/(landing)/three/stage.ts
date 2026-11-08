/**
 * Shared runtime for the landing page's three.js scenes. A scene module describes what to
 * draw; the stage owns everything around it: the renderer, a render loop that runs only while
 * the scene is on screen and the tab is visible, resizing, pointer and scroll input, theme
 * changes, and cleanup. Scenes are decorative art, so their coordinates stay physical in RTL.
 */
import { CanvasTexture, Color, SRGBColorSpace, Vector2, WebGLRenderer, type Camera, type Scene } from "three";

/** The page's semantic colour tokens, resolved for the current theme. */
export interface Tokens {
  dark: boolean;
  background: Color;
  surface: Color;
  ink: Color;
  muted: Color;
  accent: Color;
  accentSoft: Color;
  vacant: Color;
  held: Color;
  rose: Color;
  /** chart-1 … chart-5, for things that just need to be colourful (cars, cubes). */
  charts: Color[];
}

/**
 * Tokens may be lab(), oklch() or color-mix(), which three.js cannot parse, so each one is
 * painted into a 1×1 canvas and read back as sRGB.
 */
function readTokens(probe: CanvasRenderingContext2D): Tokens {
  const style = getComputedStyle(document.documentElement);
  const read = (token: string, fallback: Color) => {
    const value = style.getPropertyValue(token).trim();
    if (!value) return fallback.clone();
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "transparent";
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
  };

  const background = read("--color-background-full", new Color(0, 0, 0));
  const ink = read("--color-text-primary", new Color(1, 1, 1));
  const accent = read("--color-accent-500", ink);
  const dark = background.getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
  // The light theme's yellow status text is a dark ochre made for text on a pale chip; as a
  // fill it reads muddy, so 3D "held" mixes the pale chip colour toward it for a golden yellow.
  const heldText = read("--color-status-yellow-text", accent);
  const held = dark ? heldText : read("--color-status-yellow-background", heldText).lerp(heldText, 0.3);
  return {
    dark,
    background,
    surface: read("--color-background-secondary-default", background),
    ink,
    muted: read("--color-text-tertiary", ink),
    accent,
    accentSoft: read("--color-accent-300", accent),
    vacant: read("--color-status-lime-text", accent),
    held,
    rose: read("--color-status-rose-text", accent),
    charts: [1, 2, 3, 4, 5].map((n) => read(`--color-chart-${n}`, accent)),
  };
}

/** Seeded PRNG (mulberry32), so generated layouts look the same on every visit. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft white dot for glows, lamps and clouds. White, so materials tint it. */
export function glowTexture(falloff = 0.55) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "white");
    g.addColorStop(0.2, "rgb(255 255 255 / 0.55)");
    g.addColorStop(falloff, "rgb(255 255 255 / 0.12)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export interface StageInput {
  /** Pointer over the page, -1…1 on each axis relative to the scene, eased. */
  pointer: Vector2;
  /** 0 while the scene's top is on screen, 1 once it has scrolled a full height out the top. */
  exit: number;
  /** 0 as the scene enters at the bottom of the viewport, 1 as it leaves at the top. */
  through: number;
}

export interface SceneParts {
  scene: Scene;
  camera: Camera;
  /** Recolour for the current theme. Called before the first frame and on every theme change. */
  applyTokens(tokens: Tokens): void;
  resize(width: number, height: number): void;
  /** Advance the animation by `dt` seconds. With reduced motion it runs once, with dt = 0. */
  update(dt: number, time: number, input: StageInput): void;
  dispose(): void;
}

export interface BuildContext {
  renderer: WebGLRenderer;
  compact: boolean;
  reducedMotion: boolean;
}

export interface MountOptions {
  reducedMotion: boolean;
}

export interface Stage {
  dispose(): void;
}

export function mountStage(
  container: HTMLElement,
  { reducedMotion }: MountOptions,
  build: (context: BuildContext) => SceneParts,
): Stage | null {
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!probe) return null;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return null; // No WebGL: whatever the container shows behind the canvas stays.
  }

  const compact = container.clientWidth < 768;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 1.75));
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const parts = build({ renderer, compact, reducedMotion });
  parts.applyTokens(readTokens(probe));
  // Size once now, so the first frame already has the right aspect (the ResizeObserver
  // below fires only after the first animation frame).
  if (container.clientWidth && container.clientHeight) {
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    parts.resize(container.clientWidth, container.clientHeight);
  }

  const input: StageInput = { pointer: new Vector2(), exit: 0, through: 0.5 };
  const pointerTarget = new Vector2();
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const rect = container.getBoundingClientRect();
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    pointerTarget.set(
      clamp(((e.clientX - rect.left) / rect.width) * 2 - 1),
      clamp(-(((e.clientY - rect.top) / rect.height) * 2 - 1)),
    );
  };

  function readScroll() {
    const rect = container.getBoundingClientRect();
    const vh = window.innerHeight;
    input.exit = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
    input.through = Math.min(1, Math.max(0, (vh - rect.top) / Math.max(1, vh + rect.height)));
  }

  let firstFrame = true;
  function render() {
    renderer.render(parts.scene, parts.camera);
    if (firstFrame) {
      firstFrame = false;
      container.setAttribute("data-ready", "");
    }
  }

  let elapsed = 0;
  let last = 0;
  let frame = 0;
  let running = false;
  let inView = false;

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    elapsed += dt;
    input.pointer.lerp(pointerTarget, 1 - Math.exp(-dt * 2.5));
    readScroll();
    parts.update(dt, elapsed, input);
    render();
  }

  function renderStill() {
    readScroll();
    parts.update(0, elapsed, input);
    render();
  }

  function setRunning(next: boolean) {
    if (reducedMotion || next === running) return;
    running = next;
    if (running) {
      last = 0;
      frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
    }
  }
  const updateRunning = () => setRunning(inView && document.visibilityState === "visible");

  const resizeObserver = new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    parts.resize(width, height);
    if (!running) renderStill();
  });
  resizeObserver.observe(container);

  const viewObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateRunning();
  });
  viewObserver.observe(container);

  // The theme toggle flips `.dark` on <html>; recolour with the new tokens.
  const themeObserver = new MutationObserver(() => {
    parts.applyTokens(readTokens(probe));
    if (!running) renderStill();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-accent"] });

  document.addEventListener("visibilitychange", updateRunning);
  if (!reducedMotion) window.addEventListener("pointermove", onPointerMove, { passive: true });

  return {
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      viewObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", updateRunning);
      window.removeEventListener("pointermove", onPointerMove);
      parts.dispose();
      renderer.dispose();
      canvas.remove();
      container.removeAttribute("data-ready");
    },
  };
}

/** Collects GPU resources so a scene can free them all in one call. */
export function disposer() {
  const items: { dispose(): void }[] = [];
  return {
    track<T extends { dispose(): void }>(item: T): T {
      items.push(item);
      return item;
    },
    dispose() {
      for (const item of items) item.dispose();
    },
  };
}
