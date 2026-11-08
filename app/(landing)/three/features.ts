/**
 * The move-in cost demo's money: the total laid out as Thai banknotes (฿1,000, ฿500, ฿100,
 * ฿20) and coins (฿10, ฿5, ฿1), split greedily, one stack per denomination. When the total
 * changes only the difference moves: new pieces drop onto their stack and bounce, removed ones
 * lift off and shrink away, and a change mid-flight simply turns them around. Tall stacks are
 * capped and carry a "×N" tag with the real count.
 *
 * The notes and coins are stylised, not replicas: a token colour, the numeral and "บาท",
 * drawn in the page font. The total arrives through features-cost-store.ts; the canvas is
 * transparent, so the panel's surface token shows through.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import {
  COINS,
  NOTES,
  breakdown,
  getMoveInTotal,
  subscribeMoveInTotal,
  type Denomination,
} from "../features-cost-store";
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
  try {
    return mountStage(container, options, build);
  } catch (error) {
    // The loader swallows failures (the scene is decoration), so say why it is missing.
    console.error("[features scene]", error);
    return null;
  }
}

const NOTE_W = 2;
const NOTE_D = 0.95;
const NOTE_T = 0.034;
const COIN_T = 0.09;
const COIN_R: Partial<Record<Denomination, number>> = { 10: 0.42, 5: 0.37, 1: 0.32 };
/** Pieces drawn per stack; anything beyond shows in the stack's "×N" tag. */
const NOTE_CAP = 22;
const COIN_CAP = 14;
const DROP = 2.6; // how high a piece starts above its place

const ABSENT = 0;
const ARRIVING = 1; // falling in, or resting once it has landed
const LEAVING = 2;

interface Piece {
  state: number;
  /** Height above its resting place, and its vertical speed. */
  y: number;
  vy: number;
  /** Visible size, 0–1: grows as it arrives, shrinks as it leaves. */
  life: number;
  /** Seconds to wait before moving, so stacks fill bottom-up and empty top-down. */
  wait: number;
  /** Where it flies in from (scaled down to nothing as it lands) and how it tilts. */
  fromX: number;
  fromZ: number;
  tiltX: number;
  tiltZ: number;
  /** A hand-stacked look: resting a hair off-centre and turned. */
  jx: number;
  jz: number;
  turn: number;
}

interface Stack {
  value: Denomination;
  note: boolean;
  cap: number;
  thickness: number;
  mesh: InstancedMesh;
  pieces: Piece[];
  count: number;
  /** Where the stack stands, easing toward `target` as other stacks come and go. */
  rest: Vector3;
  target: Vector3;
  /** Whether it took part in the last layout, so a returning stack appears in place. */
  laidOut: boolean;
  face: HTMLCanvasElement;
  faceTexture: CanvasTexture;
  side: MeshLambertMaterial | MeshPhongMaterial;
  tag: Sprite;
  tagCanvas: HTMLCanvasElement;
  tagTexture: CanvasTexture;
  tagText: string;
}

const NOTE_PITCH = 2.3;
const NOTE_ROW = 1.2;
const COIN_PITCH = 1.05;

const numberText = new Intl.NumberFormat("th-TH");

function newPiece(): Piece {
  return { state: ABSENT, y: 0, vy: 0, life: 0, wait: 0, fromX: 0, fromZ: 0, tiltX: 0, tiltZ: 0, jx: 0, jz: 0, turn: 0 };
}

function build({ renderer, reducedMotion }: BuildContext): SceneParts {
  const gpu = disposer();
  const dummy = new Object3D();
  const white = new Color(1, 1, 1);

  const scene = new Scene(); // no background: the panel's surface shows through
  const camera = new PerspectiveCamera(30, 1, 0.1, 200);
  const look = new Vector3();
  let aspect = 1.5;
  // What the camera frames: the present stacks' extent, eased as it changes.
  const bounds = { halfX: 2, zMin: -1, zMax: 1 };
  const boundsTarget = { ...bounds };

  const hemi = new HemisphereLight(white.clone(), white.clone(), 1);
  const key = new DirectionalLight(white.clone(), 1.3);
  key.position.set(-3, 8, 5);
  const rim = new DirectionalLight(white.clone(), 0.45);
  rim.position.set(5, 3, -4);
  scene.add(hemi, key, rim);

  // Page font for the numerals; re-drawn once web fonts have loaded.
  let fontFamily = getComputedStyle(document.body).fontFamily || "sans-serif";
  let disposed = false;

  const noteGeometry = gpu.track(new BoxGeometry(NOTE_W, NOTE_T, NOTE_D));
  const glow = gpu.track(glowTexture());

  function makeStack(value: Denomination): Stack {
    const note = NOTES.includes(value);
    const face = document.createElement("canvas");
    face.width = note ? 512 : 256;
    face.height = note ? 244 : 256;
    const faceTexture = gpu.track(new CanvasTexture(face));
    faceTexture.colorSpace = SRGBColorSpace;
    faceTexture.anisotropy = 4;

    let geometry: BufferGeometry;
    let materials: Material[];
    let side: MeshLambertMaterial | MeshPhongMaterial;
    if (note) {
      geometry = noteGeometry;
      side = gpu.track(new MeshLambertMaterial());
      const top = gpu.track(new MeshLambertMaterial({ map: faceTexture }));
      // BoxGeometry faces: +x, -x, +y (top), -y, +z, -z.
      materials = [side, side, top, side, side, side];
    } else {
      geometry = gpu.track(new CylinderGeometry(COIN_R[value], COIN_R[value], COIN_T, 40));
      side = gpu.track(new MeshPhongMaterial({ shininess: 80 }));
      const cap = gpu.track(new MeshPhongMaterial({ map: faceTexture, shininess: 60 }));
      // CylinderGeometry groups: side, top cap, bottom cap.
      materials = [side, cap, cap];
    }
    const cap = note ? NOTE_CAP : COIN_CAP;
    const mesh = new InstancedMesh(geometry, materials, cap);
    for (let i = 0; i < cap; i++) {
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    scene.add(mesh);

    const tagCanvas = document.createElement("canvas");
    tagCanvas.width = 160;
    tagCanvas.height = 80;
    const tagTexture = gpu.track(new CanvasTexture(tagCanvas));
    tagTexture.colorSpace = SRGBColorSpace;
    const tagMaterial = gpu.track(new SpriteMaterial({ map: tagTexture, transparent: true, depthTest: false }));
    const tag = new Sprite(tagMaterial);
    tag.scale.set(0.64, 0.32, 1);
    tag.renderOrder = 10;
    tag.visible = false;
    scene.add(tag);

    return {
      value,
      note,
      cap,
      thickness: note ? NOTE_T : COIN_T,
      mesh,
      pieces: Array.from({ length: cap }, newPiece),
      count: 0,
      rest: new Vector3(),
      target: new Vector3(),
      laidOut: false,
      face,
      faceTexture,
      side,
      tag,
      tagCanvas,
      tagTexture,
      tagText: "",
    };
  }

  const stacks = [...NOTES, ...COINS].map(makeStack);

  // A soft contact shadow under each stack.
  const shadowMaterial = gpu.track(new MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false }));
  const shadows = new InstancedMesh(gpu.track(new PlaneGeometry(1, 1)), shadowMaterial, stacks.length);
  scene.add(shadows);

  /**
   * Lays out only the denominations present (or still leaving), centred: notes in rows of four
   * (two on narrow panels), coins in a row in front. Stacks that remain slide to their new
   * places; one that reappears starts where it belongs.
   */
  function relayout() {
    const present = (s: Stack) => s.count > 0 || s.pieces.some((p) => p.state !== ABSENT);
    const notes = stacks.filter((s) => s.note && present(s));
    const coins = stacks.filter((s) => !s.note && present(s));
    const perRow = aspect >= 1.15 ? 4 : 2;
    const rows = Math.ceil(notes.length / perRow);
    let halfX = 1.2;
    notes.forEach((s, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, notes.length - row * perRow);
      const x = ((i % perRow) - (inRow - 1) / 2) * NOTE_PITCH;
      s.target.set(x, 0, -(rows - 1 - row) * NOTE_ROW);
      halfX = Math.max(halfX, ((inRow - 1) / 2) * NOTE_PITCH + NOTE_W / 2 + 0.2);
    });
    const coinZ = notes.length ? 1.15 : 0;
    coins.forEach((s, i) => {
      s.target.set((i - (coins.length - 1) / 2) * COIN_PITCH, 0, coinZ);
      halfX = Math.max(halfX, ((coins.length - 1) / 2) * COIN_PITCH + 0.6);
    });
    for (const s of stacks) {
      const on = notes.includes(s) || coins.includes(s);
      if (on && !s.laidOut) s.rest.copy(s.target);
      s.laidOut = on;
    }
    boundsTarget.halfX = halfX;
    boundsTarget.zMin = notes.length ? -(rows - 1) * NOTE_ROW - NOTE_D / 2 - 0.2 : -0.6;
    boundsTarget.zMax = coins.length ? coinZ + 0.6 : NOTE_D / 2 + 0.2;
  }

  function settleLayout(dt: number, snapNow: boolean) {
    relayout();
    const ease = snapNow ? 1 : 1 - Math.exp(-dt * 5);
    for (const s of stacks) s.rest.lerp(s.target, ease);
    bounds.halfX += (boundsTarget.halfX - bounds.halfX) * ease;
    bounds.zMin += (boundsTarget.zMin - bounds.zMin) * ease;
    bounds.zMax += (boundsTarget.zMax - bounds.zMax) * ease;
  }

  // ── Drawing: note and coin faces, and the ×N tags ──────────────────────────────

  let tokens: Tokens | null = null;
  let palette: { paper: Record<number, Color>; silver: Color; gold: Color } | null = null;

  /** Light or dark ink, whichever reads on `base`. */
  function inkOn(base: Color, t: Tokens) {
    const light = t.ink.getHSL({ h: 0, s: 0, l: 0 }).l > t.background.getHSL({ h: 0, s: 0, l: 0 }).l ? t.ink : t.background;
    const dark = light === t.ink ? t.background : t.ink;
    return base.getHSL({ h: 0, s: 0, l: 0 }).l > 0.6 ? dark : light;
  }

  function css(color: Color, alpha = 1) {
    return alpha === 1 ? color.getStyle() : color.getStyle().replace("rgb(", "rgba(").replace(")", `,${alpha})`);
  }

  function drawFace(s: Stack) {
    if (!tokens || !palette) return;
    const ctx = s.face.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = s.face;
    const numeral = numberText.format(s.value);
    ctx.clearRect(0, 0, w, h);

    if (s.note) {
      const paper = palette.paper[s.value];
      const ink = inkOn(paper, tokens);
      ctx.fillStyle = css(paper);
      ctx.fillRect(0, 0, w, h);
      // A plain frame and a soft disc: shapes only, nothing taken from real notes.
      ctx.strokeStyle = css(ink, 0.35);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(16, 16, w - 32, h - 32, 18);
      ctx.stroke();
      ctx.fillStyle = css(ink, 0.12);
      ctx.beginPath();
      ctx.arc(w * 0.76, h * 0.5, h * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(ink);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.font = `700 ${numeral.length > 3 ? 92 : 104}px ${fontFamily}`;
      ctx.fillText(numeral, 40, h * 0.56);
      ctx.font = `600 44px ${fontFamily}`;
      ctx.fillText("บาท", 44, h * 0.82);
      ctx.textAlign = "center";
      ctx.font = `700 46px ${fontFamily}`;
      ctx.fillText(numeral, w * 0.76, h * 0.5 + 16);
    } else {
      const r = w / 2;
      const ten = s.value === 10;
      ctx.fillStyle = css(palette.silver);
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fill();
      // ฿10 is bi-colour: a gold centre inside the silver ring.
      if (ten) {
        ctx.fillStyle = css(palette.gold);
        ctx.beginPath();
        ctx.arc(r, r, r * 0.68, 0, Math.PI * 2);
        ctx.fill();
      }
      const inner = ten ? palette.gold : palette.silver;
      const ink = inkOn(inner, tokens);
      ctx.strokeStyle = css(ink, 0.3);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(r, r, r * (ten ? 0.68 : 0.86), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = css(ink);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `700 ${s.value === 10 ? 96 : 110}px ${fontFamily}`;
      ctx.fillText(numeral, r, r + 26);
      ctx.font = `600 38px ${fontFamily}`;
      ctx.fillText("บาท", r, r + 74);
    }
    s.faceTexture.needsUpdate = true;
  }

  function drawTag(s: Stack) {
    const text = `×${numberText.format(s.count)}`;
    if (!tokens) return;
    s.tagText = text;
    const ctx = s.tagCanvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = s.tagCanvas;
    ctx.clearRect(0, 0, w, h);
    ctx.font = `700 40px ${fontFamily}`;
    const textWidth = Math.min(w - 8, ctx.measureText(text).width + 36);
    ctx.fillStyle = css(tokens.background, 0.92);
    ctx.beginPath();
    ctx.roundRect((w - textWidth) / 2, 8, textWidth, h - 16, (h - 16) / 2);
    ctx.fill();
    ctx.fillStyle = css(tokens.ink);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 2);
    s.tagTexture.needsUpdate = true;
  }

  function redrawAll() {
    for (const s of stacks) {
      drawFace(s);
      drawTag(s);
    }
  }

  void document.fonts?.ready.then(() => {
    if (disposed) return;
    fontFamily = getComputedStyle(document.body).fontFamily || fontFamily;
    redrawAll();
  });

  // ── Retargeting: only the difference moves ────────────────────────────────────

  function retarget(total: number) {
    const counts = breakdown(total);
    for (const s of stacks) {
      const count = counts[s.value];
      const shown = Math.min(count, s.cap);
      s.count = count;
      // Arrivals, bottom-up.
      let order = 0;
      for (let k = 0; k < shown; k++) {
        const p = s.pieces[k];
        if (p.state === ARRIVING) continue;
        if (p.state === ABSENT) {
          p.y = DROP + Math.random() * 0.5;
          p.vy = 0;
          p.life = 0;
          const angle = Math.random() * Math.PI * 2;
          p.fromX = Math.cos(angle) * 1.2;
          p.fromZ = Math.sin(angle) * 0.6 - 0.4;
          p.tiltX = (Math.random() - 0.5) * 0.9;
          p.tiltZ = (Math.random() - 0.5) * 0.9;
          p.jx = (Math.random() - 0.5) * (s.note ? 0.12 : 0.05);
          p.jz = (Math.random() - 0.5) * (s.note ? 0.08 : 0.05);
          p.turn = (Math.random() - 0.5) * (s.note ? 0.16 : 0.3);
        }
        // An absent piece waits its turn; one that was leaving turns straight around.
        p.wait = p.state === ABSENT ? Math.min(order++ * 0.05, 0.8) : 0;
        p.state = ARRIVING;
      }
      // Departures, top-down.
      order = 0;
      for (let k = s.cap - 1; k >= shown; k--) {
        const p = s.pieces[k];
        if (p.state !== ARRIVING) continue;
        p.state = LEAVING;
        p.wait = Math.min(order++ * 0.035, 0.5);
      }
      if (s.tagText !== `×${numberText.format(count)}`) drawTag(s);
    }
  }

  function snap() {
    for (const s of stacks) {
      const shown = Math.min(s.count, s.cap);
      s.pieces.forEach((p, k) => {
        p.state = k < shown ? ARRIVING : ABSENT;
        p.y = 0;
        p.vy = 0;
        p.wait = 0;
        p.life = k < shown ? 1 : 0;
      });
    }
  }

  function step(dt: number) {
    for (const s of stacks) {
      for (const p of s.pieces) {
        if (p.state === ABSENT) continue;
        if (p.wait > 0) {
          p.wait -= dt;
          continue;
        }
        if (p.state === ARRIVING) {
          p.life = Math.min(1, p.life + dt * 6);
          // A stiff spring toward its place, with the stack as a floor to bounce off.
          p.vy += (-140 * p.y - 13 * p.vy) * dt;
          p.y += p.vy * dt;
          if (p.y < 0) {
            p.y = 0;
            p.vy = Math.abs(p.vy) < 0.4 ? 0 : -p.vy * 0.35;
          }
        } else {
          p.vy += 7 * dt;
          p.y += p.vy * dt;
          p.life -= dt * 2.6;
          if (p.life <= 0) {
            p.state = ABSENT;
            p.life = 0;
            p.y = 0;
            p.vy = 0;
          }
        }
      }
    }
  }

  function place() {
    stacks.forEach((s, index) => {
      const baseTurn = s.note ? 0 : Math.PI / 2; // turns a coin's face upright toward the viewer
      let top = 0;
      s.pieces.forEach((p, k) => {
        if (p.state === ABSENT || (p.state === ARRIVING && p.life === 0)) {
          dummy.scale.set(0, 0, 0);
        } else {
          const flight = Math.min(1, p.y / DROP);
          dummy.position.set(
            s.rest.x + p.jx + p.fromX * flight,
            s.rest.y + s.thickness * (k + 0.5) + p.y,
            s.rest.z + p.jz + p.fromZ * flight,
          );
          dummy.rotation.set(p.tiltX * flight, baseTurn + p.turn, p.tiltZ * flight);
          const size = 1 - (1 - p.life) * (1 - p.life);
          dummy.scale.setScalar(size);
          if (p.state === ARRIVING && p.y < 0.05) top = Math.max(top, k + 1);
        }
        dummy.updateMatrix();
        s.mesh.setMatrixAt(k, dummy.matrix);
      });
      s.mesh.instanceMatrix.needsUpdate = true;

      const bottom = s.pieces[0];
      const ground = bottom.state === ABSENT ? 0 : bottom.life;
      dummy.position.set(s.rest.x, 0.004, s.rest.z + 0.1);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set((s.note ? NOTE_W * 1.35 : 1.3) * ground, (s.note ? NOTE_D * 1.6 : 1.1) * ground, 1);
      dummy.updateMatrix();
      shadows.setMatrixAt(index, dummy.matrix);

      // The ×N tag rides the near edge of the stack's settled top, clear of the numeral.
      // A single piece needs no count.
      s.tag.visible = s.count > 1 && top > 0;
      const lift = s.thickness * top;
      const r = COIN_R[s.value] ?? 0.4;
      if (s.note) s.tag.position.set(s.rest.x + NOTE_W / 2 - 0.35, lift + 0.12, s.rest.z + NOTE_D / 2 + 0.05);
      else s.tag.position.set(s.rest.x + r * 0.8, lift + 0.1, s.rest.z + r + 0.12);
    });
    shadows.instanceMatrix.needsUpdate = true;
  }

  function frame(time: number, pointerX: number, pointerY: number) {
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const elevation = 0.92 + pointerY * 0.06;
    const zSpan = bounds.zMax - bounds.zMin;
    const halfV = (zSpan * Math.sin(elevation) + 1.4 * Math.cos(elevation)) / 2 + 0.25;
    const distance = Math.max(halfV / tanHalf, bounds.halfX / (tanHalf * aspect), 3.2) * 1.12;
    const azimuth = Math.sin(time * 0.25) * 0.05 + pointerX * 0.16;
    look.set(0, 0.3, (bounds.zMin + bounds.zMax) / 2);
    camera.position.set(
      look.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      look.y + Math.sin(elevation) * distance,
      look.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    camera.lookAt(look);
  }

  function applyTokens(t: Tokens) {
    tokens = t;
    const night = t.dark;
    const silver = t.surface.clone().lerp(t.ink, night ? 0.62 : 0.3);
    // stage.ts already makes held a golden fill in the light theme.
    const gold = t.held.clone();
    palette = {
      silver,
      gold,
      paper: {
        // A warm, matte grey: darker than the silver coins (night 0.42 vs 0.62 of the way to
        // ink; day 0.45 vs 0.30) and warmer than the cool "occupied" grey of the room maps.
        1000: t.surface.clone().lerp(t.ink, night ? 0.42 : 0.45).lerp(t.held, 0.08),
        500: t.charts[4].clone().multiplyScalar(night ? 0.75 : 0.85),
        100: t.rose.clone(),
        20: t.vacant.clone().multiplyScalar(night ? 0.75 : 1),
      },
    };
    for (const s of stacks) {
      s.side.color.copy(s.note ? palette.paper[s.value] : silver);
      if (s.side instanceof MeshPhongMaterial) s.side.specular.copy(t.ink).multiplyScalar(night ? 0.3 : 0.45);
    }
    hemi.color.copy(white).lerp(t.accentSoft, 0.12);
    hemi.groundColor.copy(t.surface);
    hemi.intensity = night ? 0.85 : 1.1;
    key.intensity = night ? 1.15 : 1.35;
    shadowMaterial.color.copy(night ? t.surface.clone().multiplyScalar(0.3) : t.surface.clone().lerp(t.ink, 0.4));
    shadowMaterial.opacity = night ? 0.75 : 0.3;
    redrawAll();
  }

  retarget(getMoveInTotal());
  if (reducedMotion) snap();

  // With reduced motion the stage only draws on resize or theme changes, so jump to the new
  // stacks and redraw here; otherwise the running loop animates toward the new targets.
  const unsubscribe = subscribeMoveInTotal((total) => {
    retarget(total);
    if (!reducedMotion) return;
    snap();
    settleLayout(0, true);
    place();
    renderer.render(scene, camera);
  });

  function resize(w: number, h: number) {
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  function update(dt: number, time: number, input: StageInput) {
    if (!reducedMotion) step(dt);
    settleLayout(dt, reducedMotion);
    place();
    frame(reducedMotion ? 0 : time, input.pointer.x, input.pointer.y);
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
      for (const s of stacks) s.mesh.dispose();
      shadows.dispose();
      gpu.dispose();
    },
  };
}
