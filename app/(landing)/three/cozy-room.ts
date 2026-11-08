/**
 * The closing call to action's scene: the room you are about to find. A cut-away dorm room
 * with a bed, a desk under the window, a lamp, a plant and a shelf of books, and a key with a
 * "ห้องว่าง" tag floating over the rug. Through the window is the city from the hero.
 *
 * Dark theme is night: the desk lamp is on, the laptop glows and the city outside is lit.
 * Light theme is day: sunlight falls through the window and the frame's shadow crosses the
 * floor. Colours come from the theme tokens; the canvas is transparent so the card shows.
 */
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  disposer,
  glowTexture,
  mountStage,
  seeded,
  type BuildContext,
  type MountOptions,
  type SceneParts,
  type StageInput,
  type Tokens,
} from "./stage";

export function mount(container: HTMLElement, options: MountOptions) {
  return mountStage(container, options, buildRoom);
}

// Room box: floor x/z ∈ [-3.5, 3.5]; back wall at z = -3.5, left wall at x = -3.5.
const HALF = 3.5;
const WALL_H = 4.2;
const WALL_T = 0.25;
// The window opening in the back wall.
const WIN = { x0: 0, x1: 2.4, y0: 1.75, y1: 3.35 };

function css(color: Color, alpha = 1) {
  const { r, g, b } = color.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${c(r)} ${c(g)} ${c(b)} / ${alpha})`;
}

function roomColors(t: Tokens) {
  const night = t.dark;
  const s = t.surface;
  const white = new Color(1, 1, 1);
  return {
    night,
    floor: s.clone().lerp(t.held, night ? 0.16 : 0.32).lerp(t.ink, night ? 0.1 : 0.14),
    wall: night ? s.clone().lerp(t.ink, 0.1).lerp(t.accent, 0.05) : t.background.clone().lerp(t.accentSoft, 0.14),
    trim: night ? s.clone().lerp(t.ink, 0.2) : t.background.clone().lerp(t.ink, 0.07),
    wood: s.clone().lerp(t.held, 0.38).lerp(t.ink, night ? 0.16 : 0.32),
    linen: night ? s.clone().lerp(t.ink, 0.55) : t.background.clone().lerp(t.ink, 0.04),
    blanket: t.accent.clone(),
    metal: s.clone().lerp(t.ink, night ? 0.35 : 0.5),
    rug: t.charts[4].clone().lerp(s, 0.45),
    pot: t.rose.clone().lerp(s, 0.35),
    leaves: [t.charts[0].clone().lerp(s, 0.1), t.charts[1].clone().lerp(t.charts[0], 0.45)],
    books: [t.charts[0], t.charts[2], t.charts[3], t.held, t.accent, t.charts[4]].map((c) => c.clone()),
    screen: night ? t.accentSoft.clone() : t.accent.clone().lerp(t.background, 0.45),
    lamp: t.held.clone().lerp(t.ink, 0.5),
    sun: night ? t.accentSoft.clone().lerp(t.ink, 0.3) : t.held.clone().lerp(white, 0.65),
    key: t.held.clone(),
    tag: t.charts[1].clone(),
    tagText: night ? s.clone() : t.ink.clone(),
    shadow: night ? s.clone().multiplyScalar(0.35) : s.clone().lerp(t.ink, 0.4),
    // The view through the window, in the hero's palette.
    sky: night ? [t.background.clone(), t.background.clone().lerp(t.accent, 0.4)] : [t.accentSoft.clone().lerp(t.background, 0.15), t.background.clone().lerp(t.accentSoft, 0.3)],
    tower: night ? t.background.clone().lerp(t.ink, 0.07) : t.background.clone().lerp(t.ink, 0.3),
    lit: night ? [t.held.clone().lerp(t.background, 0.4), t.charts[1].clone(), t.held.clone()] : [t.accentSoft.clone().lerp(t.ink, 0.25), t.charts[1].clone(), t.held.clone()],
    orb: night ? t.ink.clone().lerp(t.accentSoft, 0.2) : t.held.clone().lerp(white, 0.6),
  };
}

type RoomColors = ReturnType<typeof roomColors>;

/** The city outside: a sky, towers with a few rooms lit, and the moon or sun. */
function drawView(ctx: CanvasRenderingContext2D, c: RoomColors, seed: number) {
  const { width: w, height: h } = ctx.canvas;
  const rand = seeded(seed);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, css(c.sky[0]));
  sky.addColorStop(1, css(c.sky[1]));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const orb = ctx.createRadialGradient(w * 0.74, h * 0.26, 0, w * 0.74, h * 0.26, h * 0.32);
  orb.addColorStop(0, css(c.orb));
  orb.addColorStop(0.22, css(c.orb));
  orb.addColorStop(0.3, css(c.orb, 0.35));
  orb.addColorStop(1, "transparent");
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, w, h);

  const layout = seeded(3);
  let x = -10;
  while (x < w) {
    const bw = 34 + layout() * 46;
    const bh = h * (0.28 + layout() * 0.5);
    ctx.fillStyle = css(c.tower);
    ctx.fillRect(x, h - bh, bw, bh);
    for (let wy = h - bh + 10; wy < h - 8; wy += 15) {
      for (let wx = x + 6; wx < x + bw - 8; wx += 11) {
        const r = rand();
        if (c.night && r < 0.45) continue;
        ctx.fillStyle = css(r > 0.93 ? c.lit[1] : r > 0.88 ? c.lit[2] : c.lit[0]);
        ctx.fillRect(wx, wy, 6, 8);
      }
    }
    x += bw + 4 + layout() * 10;
  }
}

/** The key's tag: a lime pill that says the room is free. */
function drawTag(ctx: CanvasRenderingContext2D, c: RoomColors) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = css(c.tag);
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, (h - 8) / 2);
  ctx.fill();
  ctx.fillStyle = css(c.tagText);
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  ctx.font = `600 ${Math.round(h * 0.42)}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ห้องว่าง", w / 2, h / 2 + h * 0.03);
}

function buildRoom({ renderer, compact, reducedMotion }: BuildContext): SceneParts {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const gpu = disposer();
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 120);
  const target = new Vector3(0.2, 1.15, -0.3);
  let distance = 18;

  const room = new Group();
  scene.add(room);

  const box = gpu.track(new BoxGeometry(1, 1, 1));
  const lambert = () => gpu.track(new MeshLambertMaterial());
  const mats = {
    floor: lambert(),
    wall: lambert(),
    trim: lambert(),
    wood: lambert(),
    linen: lambert(),
    blanket: lambert(),
    metal: lambert(),
    rug: lambert(),
    pot: lambert(),
    leaves: [gpu.track(new MeshLambertMaterial({ flatShading: true })), gpu.track(new MeshLambertMaterial({ flatShading: true }))],
    books: Array.from({ length: 6 }, lambert),
    key: lambert(),
    tagBody: lambert(),
  };

  function part(
    geometry: BufferGeometry,
    material: Material,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    { cast = true, receive = true, rx = 0, ry = 0, rz = 0, parent = room } = {},
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  // Shell: floor, the left wall, and the back wall built around the window opening.
  part(box, mats.floor, [0, -0.15, 0], [HALF * 2, 0.3, HALF * 2], { cast: false });
  part(box, mats.wall, [-HALF - WALL_T / 2, (WALL_H - 0.3) / 2, -WALL_T / 2], [WALL_T, WALL_H + 0.3, HALF * 2 + WALL_T]);
  const bz = -HALF - WALL_T / 2;
  part(box, mats.wall, [(-HALF + WIN.x0) / 2, (WALL_H - 0.3) / 2, bz], [WIN.x0 + HALF, WALL_H + 0.3, WALL_T]);
  part(box, mats.wall, [(WIN.x1 + HALF) / 2, (WALL_H - 0.3) / 2, bz], [HALF - WIN.x1, WALL_H + 0.3, WALL_T]);
  part(box, mats.wall, [(WIN.x0 + WIN.x1) / 2, (WIN.y0 - 0.3) / 2, bz], [WIN.x1 - WIN.x0, WIN.y0 + 0.3, WALL_T]);
  part(box, mats.wall, [(WIN.x0 + WIN.x1) / 2, (WIN.y1 + WALL_H) / 2, bz], [WIN.x1 - WIN.x0, WALL_H - WIN.y1, WALL_T]);
  // Skirting along both walls.
  part(box, mats.trim, [0, 0.09, -HALF + 0.03], [HALF * 2, 0.18, 0.06]);
  part(box, mats.trim, [-HALF + 0.03, 0.09, 0], [0.06, 0.18, HALF * 2]);

  // Window: frame, a mullion and transom, a sill, and the view behind.
  const wx = (WIN.x0 + WIN.x1) / 2;
  const wy = (WIN.y0 + WIN.y1) / 2;
  const ww = WIN.x1 - WIN.x0;
  const wh = WIN.y1 - WIN.y0;
  for (const [x, y, sx, sy] of [
    [wx, WIN.y1, ww + 0.16, 0.08],
    [wx, WIN.y0, ww + 0.16, 0.08],
    [WIN.x0, wy, 0.08, wh],
    [WIN.x1, wy, 0.08, wh],
    [wx, wy, 0.06, wh],
    [wx, wy + 0.18, ww, 0.05],
  ] as const) {
    part(box, mats.trim, [x, y, -HALF + 0.02], [sx, sy, 0.1]);
  }
  part(box, mats.trim, [wx, WIN.y0 - 0.06, -HALF + 0.14], [ww + 0.4, 0.07, 0.3]);
  const viewCanvas = document.createElement("canvas");
  viewCanvas.width = 512;
  viewCanvas.height = 352;
  const viewCtx = viewCanvas.getContext("2d");
  const viewTexture = gpu.track(new CanvasTexture(viewCanvas));
  viewTexture.colorSpace = SRGBColorSpace;
  const viewMaterial = gpu.track(new MeshBasicMaterial({ map: viewTexture }));
  part(gpu.track(new PlaneGeometry(ww + 0.9, wh + 0.7)), viewMaterial, [wx, wy, -HALF - 0.55], [1, 1, 1], {
    cast: false,
    receive: false,
  });

  // Bed against the left wall.
  const bedX = -2.15;
  part(box, mats.wood, [bedX, 0.24, -1.55], [2.4, 0.48, 3.7]);
  part(box, mats.wood, [bedX, 0.85, -3.36], [2.4, 1.3, 0.14]);
  part(gpu.track(new RoundedBoxGeometry(2.25, 0.34, 3.5, 3, 0.12)), mats.linen, [bedX, 0.64, -1.52]);
  part(gpu.track(new RoundedBoxGeometry(2.32, 0.16, 2.2, 3, 0.07)), mats.blanket, [bedX, 0.86, -0.82]);
  part(gpu.track(new RoundedBoxGeometry(1.5, 0.24, 0.62, 3, 0.11)), mats.linen, [bedX, 0.92, -2.9], [1, 1, 1], { rx: -0.12 });

  // Desk under the window, a chair, a laptop and a desk lamp.
  const deskY = 1.3;
  part(box, mats.wood, [1.25, deskY, -2.85], [2.7, 0.1, 1.1]);
  for (const [x, z] of [
    [0.02, -3.32],
    [2.48, -3.32],
    [0.02, -2.38],
    [2.48, -2.38],
  ]) {
    part(box, mats.metal, [x, deskY / 2, z], [0.08, deskY, 0.08]);
  }
  part(box, mats.metal, [1.0, deskY + 0.07, -2.72], [0.95, 0.04, 0.62]);
  part(box, mats.metal, [1.0, deskY + 0.36, -3.05], [0.95, 0.6, 0.03], { rx: -0.22 });
  const screenMaterial = gpu.track(new MeshBasicMaterial());
  part(gpu.track(new PlaneGeometry(0.86, 0.52)), screenMaterial, [1.0, deskY + 0.37, -3.025], [1, 1, 1], {
    rx: -0.22,
    cast: false,
    receive: false,
  });
  const chair = new Group();
  chair.position.set(1.15, 0, -1.7);
  chair.rotation.y = 0.35;
  room.add(chair);
  part(gpu.track(new RoundedBoxGeometry(0.8, 0.12, 0.8, 2, 0.05)), mats.blanket, [0, 0.78, 0], [1, 1, 1], { parent: chair });
  part(gpu.track(new RoundedBoxGeometry(0.8, 0.85, 0.1, 2, 0.05)), mats.blanket, [0, 1.25, 0.36], [1, 1, 1], { parent: chair });
  for (const [x, z] of [
    [-0.33, -0.33],
    [0.33, -0.33],
    [-0.33, 0.33],
    [0.33, 0.33],
  ]) {
    part(box, mats.metal, [x, 0.36, z], [0.06, 0.72, 0.06], { parent: chair });
  }
  part(gpu.track(new CylinderGeometry(0.17, 0.2, 0.05, 20)), mats.metal, [2.15, deskY + 0.08, -3.05]);
  part(box, mats.metal, [2.1, deskY + 0.42, -3.05], [0.05, 0.7, 0.05], { rz: 0.28 });
  part(gpu.track(new ConeGeometry(0.22, 0.32, 20, 1, true)), mats.key, [1.93, deskY + 0.8, -2.98], [1, 1, 1], {
    rz: 0.7,
  });
  const glow = gpu.track(glowTexture());
  const bulbMaterial = gpu.track(new SpriteMaterial({ map: glow, transparent: true, depthWrite: false }));
  const bulb = new Sprite(bulbMaterial);
  bulb.position.set(1.83, deskY + 0.66, -2.92);
  bulb.scale.setScalar(1.5);
  room.add(bulb);
  const lampLight = new PointLight(new Color(1, 1, 1), 0, 9, 1.6);
  lampLight.position.set(1.8, deskY + 0.6, -2.85);
  room.add(lampLight);

  // Rug, a plant, and a shelf of books on the left wall.
  part(gpu.track(new CylinderGeometry(1.7, 1.7, 0.03, 48)), mats.rug, [0.7, 0.016, 0.7], [1.15, 1, 0.9], { cast: false });
  part(gpu.track(new CylinderGeometry(0.3, 0.23, 0.55, 20)), mats.pot, [3.0, 0.28, -1.15]);
  const leaf = gpu.track(new IcosahedronGeometry(0.42, 0));
  part(leaf, mats.leaves[0], [3.0, 0.85, -1.15], [1, 1.25, 1]);
  part(leaf, mats.leaves[1], [2.82, 1.18, -1.05], [0.8, 1, 0.8], { ry: 0.6 });
  part(leaf, mats.leaves[0], [3.14, 1.3, -1.25], [0.65, 0.85, 0.65], { ry: 1.2 });
  part(box, mats.wood, [-HALF + 0.27, 2.75, 0.75], [0.5, 0.08, 2.1]);
  const rand = seeded(11);
  let bookZ = -0.15;
  for (let i = 0; i < 9 && bookZ < 1.65; i++) {
    const thick = 0.12 + rand() * 0.1;
    const tall = 0.42 + rand() * 0.2;
    part(box, mats.books[i % mats.books.length], [-HALF + 0.27, 2.79 + tall / 2, bookZ + thick / 2], [0.36, tall, thick], {
      rx: i === 6 ? 0.25 : 0,
    });
    bookZ += thick + 0.02;
  }

  // The key with its tag, floating over the rug: the room is yours.
  const keyGroup = new Group();
  keyGroup.position.set(0.75, 2.45, 0.8);
  room.add(keyGroup);
  part(gpu.track(new TorusGeometry(0.24, 0.07, 12, 32)), mats.key, [-0.42, 0, 0], [1, 1, 1], { parent: keyGroup });
  part(box, mats.key, [0.12, 0, 0], [0.82, 0.1, 0.07], { parent: keyGroup });
  part(box, mats.key, [0.42, -0.1, 0], [0.08, 0.16, 0.07], { parent: keyGroup });
  part(box, mats.key, [0.28, -0.08, 0], [0.07, 0.12, 0.07], { parent: keyGroup });
  part(gpu.track(new RoundedBoxGeometry(1.15, 0.5, 0.06, 3, 0.025)), mats.tagBody, [-0.42, -0.62, 0], [1, 1, 1], { parent: keyGroup });
  const tagCanvas = document.createElement("canvas");
  tagCanvas.width = 512;
  tagCanvas.height = 220;
  const tagCtx = tagCanvas.getContext("2d");
  const tagTexture = gpu.track(new CanvasTexture(tagCanvas));
  tagTexture.colorSpace = SRGBColorSpace;
  tagTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const tagMaterial = gpu.track(new MeshBasicMaterial({ map: tagTexture, transparent: true }));
  const tagFace = gpu.track(new PlaneGeometry(1.1, 0.47));
  part(tagFace, tagMaterial, [-0.42, -0.62, 0.035], [1, 1, 1], { parent: keyGroup, cast: false, receive: false });
  part(tagFace, tagMaterial, [-0.42, -0.62, -0.035], [1, 1, 1], { parent: keyGroup, cast: false, receive: false, ry: Math.PI });
  const keyGlowMaterial = gpu.track(new SpriteMaterial({ map: glow, transparent: true, depthWrite: false }));
  const keyGlow = new Sprite(keyGlowMaterial);
  keyGlow.scale.setScalar(2.6);
  keyGroup.add(keyGlow);

  // A soft shadow under the whole room, so it sits on the card.
  const groundMaterial = gpu.track(new MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false }));
  const ground = new Mesh(gpu.track(new PlaneGeometry(1, 1)), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.31, 0);
  ground.scale.set(13, 13, 1);
  room.add(ground);

  // Light: sky fill, and the sun (or moon) shining in through the window.
  const hemi = new HemisphereLight(new Color(1, 1, 1), new Color(0.5, 0.5, 0.5), 1);
  const ambient = new AmbientLight(new Color(1, 1, 1), 0.2);
  const sun = new DirectionalLight(new Color(1, 1, 1), 2);
  sun.position.set(3.2, 7.5, -11);
  sun.target.position.set(0.4, 0, -0.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(compact ? 1024 : 2048, compact ? 1024 : 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(hemi, ambient, sun, sun.target);

  let colors!: RoomColors;
  let viewSeed = 1;

  function paintView() {
    if (!viewCtx) return;
    drawView(viewCtx, colors, viewSeed);
    viewTexture.needsUpdate = true;
  }
  function paintTag() {
    if (!tagCtx) return;
    drawTag(tagCtx, colors);
    tagTexture.needsUpdate = true;
  }
  // Redraw the tag once the page font has loaded, so the Thai glyphs are the real ones.
  document.fonts?.ready.then(() => {
    if (colors) paintTag();
  });

  function applyTokens(tokens: Tokens) {
    colors = roomColors(tokens);
    const c = colors;
    mats.floor.color.copy(c.floor);
    mats.wall.color.copy(c.wall);
    mats.trim.color.copy(c.trim);
    mats.wood.color.copy(c.wood);
    mats.linen.color.copy(c.linen);
    mats.blanket.color.copy(c.blanket);
    mats.metal.color.copy(c.metal);
    mats.rug.color.copy(c.rug);
    mats.pot.color.copy(c.pot);
    mats.leaves.forEach((m, i) => m.color.copy(c.leaves[i]));
    mats.books.forEach((m, i) => m.color.copy(c.books[i]));
    mats.key.color.copy(c.key);
    mats.tagBody.color.copy(c.tag);
    screenMaterial.color.copy(c.screen);
    groundMaterial.color.copy(c.shadow);
    groundMaterial.opacity = c.night ? 0.9 : 0.5;

    hemi.color.setRGB(1, 1, 1).lerp(tokens.accentSoft, 0.2);
    hemi.groundColor.copy(c.floor);
    hemi.intensity = c.night ? 0.55 : 1.05;
    ambient.intensity = c.night ? 0.15 : 0.45;
    sun.color.copy(c.sun);
    sun.intensity = c.night ? 0.9 : 2.6;
    lampLight.color.copy(c.lamp);
    lampLight.intensity = c.night ? 14 : 0;
    bulb.visible = c.night;
    bulbMaterial.color.copy(c.lamp);
    keyGlowMaterial.color.copy(c.night ? c.key : c.tag);
    keyGlowMaterial.opacity = c.night ? 0.45 : 0.3;
    paintView();
    paintTag();
  }

  function resize(width: number, height: number) {
    camera.aspect = width / height;
    // Fit the room (about 10 wide and 7 tall on screen at this angle) in any box.
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    distance = Math.max(5 / tanHalf, 6.9 / (tanHalf * camera.aspect));
    camera.updateProjectionMatrix();
  }

  let nextView = 2;

  function update(dt: number, time: number, input: StageInput) {
    const motion = reducedMotion ? 0 : 1;
    const azimuth = 0.72 + input.pointer.x * 0.14 + (input.through - 0.5) * 0.3 * motion + Math.sin(time * 0.15) * 0.04 * motion;
    const elevation = 0.5 + input.pointer.y * 0.06;
    camera.position.set(
      target.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    camera.lookAt(target);

    keyGroup.position.y = 2.45 + Math.sin(time * 1.2) * 0.12 * motion;
    keyGroup.rotation.y = Math.sin(time * 0.6) * 0.5 * motion;
    keyGroup.rotation.z = Math.sin(time * 0.9) * 0.06 * motion;
    if (colors?.night) bulbMaterial.opacity = 0.85 + Math.sin(time * 3.1) * 0.05 * motion;

    // Rooms across the street light up and go dark now and then.
    if (dt > 0 && time >= nextView) {
      nextView = time + 1.6;
      viewSeed += 1;
      paintView();
    }
  }

  return {
    scene,
    camera,
    applyTokens,
    resize,
    update,
    dispose() {
      gpu.dispose();
    },
  };
}
