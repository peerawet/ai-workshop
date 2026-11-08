/**
 * "ใช้งานยังไง": the journey as a small film set. Three plinths stand on a faint grid, joined by
 * a glowing tube path; light flows along it to the active step, carried by a bright traveller.
 * The camera frames each step in turn (an eased fly-to with a slow orbit), and pulls back to a
 * wide shot when the tab changes. Each plinth holds the step as a richer object:
 *   tenant: a phone searching a map → a dorm whose windows light up, vacant ones in lime →
 *           a chat bubble, typing, that turns into a booking card with a ✓
 *   owner:  a dorm assembled floor by floor beside a crane → a room map whose rooms flip
 *           status → a confirmed booking with a golden key and a burst of sparks
 * The active step comes from steps-journey.ts, which the section writes. Colours come from the
 * theme tokens: accent rim light and glows at night, soft daylight with real shadows by day.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NormalBlending,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  ShadowMaterial,
  SphereGeometry,
  SpriteMaterial,
  Sprite,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { getJourney, subscribeJourney, type Audience } from "../steps-journey";
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
  return mountStage(container, options, buildSteps);
}

const STATIONS = [new Vector3(-6, 0, 1.3), new Vector3(0, 0, -1.5), new Vector3(6, 0, 1)];
const PLINTH_TOP = 0.56;
const AUDIENCES: Audience[] = ["tenant", "owner"];
/** Each step's camera: a slight angle along the path, so the shots feel like a walk. */
const SHOT_YAW = [0.32, 0, -0.32];

// Room states for the dorm windows and the owner's room map.
const VACANT = 0;
const HELD = 1;
const LIVED = 2;

function stepColors(t: Tokens) {
  const night = t.dark;
  const s = t.surface;
  const ink = t.ink;
  return {
    night,
    ground: s.clone().lerp(ink, night ? 0.05 : 0.035),
    gridLine: s.clone().lerp(ink, night ? 0.22 : 0.16),
    glow: t.accent.clone(),
    plinthBase: s.clone().lerp(ink, night ? 0.13 : 0.12),
    plinthTop: night ? s.clone().lerp(ink, 0.2) : t.background.clone().lerp(ink, 0.03),
    rimIdle: s.clone().lerp(ink, night ? 0.3 : 0.25),
    pathDim: s.clone().lerp(ink, night ? 0.24 : 0.2),
    accent: t.accent.clone(),
    accentSoft: t.accentSoft.clone(),
    wall: night ? s.clone().lerp(ink, 0.22) : t.background.clone().lerp(ink, 0.05),
    trim: s.clone().lerp(ink, night ? 0.36 : 0.3),
    device: night ? s.clone().lerp(ink, 0.07) : ink.clone().lerp(s, 0.12),
    screen: night ? s.clone().lerp(ink, 0.05) : t.background.clone(),
    card: night ? s.clone().lerp(ink, 0.15) : t.background.clone(),
    chip: s.clone().lerp(ink, night ? 0.16 : 0.08),
    map: t.accentSoft.clone().lerp(s, night ? 0.75 : 0.55),
    vacant: t.charts[1].clone(),
    held: t.held.clone(),
    lived: night ? t.held.clone().lerp(s, 0.84) : t.accentSoft.clone().lerp(ink, 0.22),
    light: night ? ink.clone() : t.background.clone(),
    dark: night ? t.background.clone() : ink.clone(),
    muted: t.muted.clone(),
    mutedSoft: s.clone().lerp(ink, night ? 0.3 : 0.2),
    shadow: night ? new Color(0, 0, 0) : ink.clone(),
  };
}

type Colors = ReturnType<typeof stepColors>;

/** easeOutBack: a pop that overshoots a little. */
function pop(x: number) {
  const c = 1.7;
  const t = Math.min(1, Math.max(0, x)) - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const GROUND_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

// A soft pool of light with a faint grid, fading to nothing so the card has no hard edges.
const GROUND_FRAGMENT = /* glsl */ `
uniform vec3 base;
uniform vec3 line;
uniform vec3 glowColor;
uniform float glowStrength;
uniform float lineAlpha;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  float r = length(p / vec2(15.0, 9.5));
  float fade = 1.0 - smoothstep(0.3, 1.0, r);
  vec2 cell = p / 1.5;
  vec2 g = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
  float grid = 1.0 - min(min(g.x, g.y), 1.0);
  vec3 col = mix(base, glowColor, glowStrength * (1.0 - smoothstep(0.0, 0.85, r)));
  col = mix(col, line, grid * lineAlpha);
  gl_FragColor = vec4(col, fade);
  #include <colorspace_fragment>
}`;

const FLOW_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Light flowing along the path up to the traveller, brightest at its head.
const FLOW_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform float time;
uniform float progress;
uniform float strength;
varying vec2 vUv;
void main() {
  float along = vUv.x;
  if (along > progress) discard;
  float stripe = smoothstep(0.15, 0.6, fract(along * 28.0 - time * 1.4));
  float head = smoothstep(progress - 0.07, progress, along);
  float a = ((0.4 + 0.6 * stripe) * strength + head * 0.7);
  gl_FragColor = vec4(color * (1.0 + head * 0.5), clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

function buildSteps({ renderer, compact, reducedMotion }: BuildContext): SceneParts {
  const gpu = disposer();
  const rand = seeded(11);
  const white = new Color(1, 1, 1);
  const glow = gpu.track(glowTexture());

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const fog = new Fog(white.clone(), 16, 38);
  scene.fog = fog;
  const camera = new PerspectiveCamera(34, 1, 0.1, 200);

  // Lights: sky fill, a key light that casts the shadows, a rim from behind, and a lamp that
  // follows the active step.
  const hemi = new HemisphereLight(white.clone(), white.clone(), 1);
  const key = new DirectionalLight(white.clone(), 1.6);
  key.position.set(-6, 12, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(compact ? 512 : 1024, compact ? 512 : 1024);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 8, bottom: -8, near: 1, far: 40 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0008;
  const rim = new DirectionalLight(white.clone(), 1);
  rim.position.set(2, 5, -10);
  const lamp = new PointLight(white.clone(), 0, 9, 1.6);
  scene.add(hemi, key, rim, lamp);

  const world = new Group();
  scene.add(world);

  const geo = <T extends BufferGeometry>(g: T) => gpu.track(g);
  const lambert = () => gpu.track(new MeshLambertMaterial());
  const basic = () => gpu.track(new MeshBasicMaterial());
  const mat = {
    plinthBase: lambert(),
    plinthTop: lambert(),
    path: lambert(),
    wall: lambert(),
    trim: lambert(),
    device: lambert(),
    card: lambert(),
    accent: lambert(),
    vacantSolid: lambert(),
    gold: lambert(),
    glass: gpu.track(new MeshBasicMaterial({ transparent: true, opacity: 0.35 })),
    vacant: basic(),
    held: basic(),
    lived: basic(),
    light: basic(),
    dark: basic(),
    traveller: basic(),
    contact: gpu.track(new MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false })),
  };
  const mesh = (g: BufferGeometry, m: Material, shadows = true) => {
    const out = new Mesh(g, m);
    out.castShadow = shadows;
    out.receiveShadow = shadows;
    return out;
  };
  const box = geo(new BoxGeometry(1, 1, 1));

  // ---- Ground: a glowing grid that fades out, and a plane that only catches shadows.
  const groundMaterial = gpu.track(
    new ShaderMaterial({
      uniforms: {
        base: { value: new Color() },
        line: { value: new Color() },
        glowColor: { value: new Color() },
        glowStrength: { value: 0 },
        lineAlpha: { value: 0.6 },
      },
      vertexShader: GROUND_VERTEX,
      fragmentShader: GROUND_FRAGMENT,
      transparent: true,
      depthWrite: false,
    }),
  );
  const ground = new Mesh(geo(new PlaneGeometry(40, 28)), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  const shadowMaterial = gpu.track(new ShadowMaterial({ opacity: 0.2 }));
  const shadowCatcher = new Mesh(geo(new PlaneGeometry(30, 20)), shadowMaterial);
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.005;
  shadowCatcher.receiveShadow = true;
  world.add(ground, shadowCatcher);

  // ---- Path: a tube along a curve, with a second tube of flowing light on top.
  const curve = new CatmullRomCurve3(
    [
      new Vector3(-10, 0, 3),
      STATIONS[0],
      new Vector3(-3, 0, -1.4),
      STATIONS[1],
      new Vector3(3, 0, 1.6),
      STATIONS[2],
      new Vector3(10, 0, -1.2),
    ],
    false,
    "centripetal",
  );
  const lift = (points: Vector3[]) => points.map((p) => p.clone().setY(0.12));
  const pathCurve = new CatmullRomCurve3(lift(curve.points), false, "centripetal");
  const segments = compact ? 140 : 220;
  const pathTube = mesh(geo(new TubeGeometry(pathCurve, segments, 0.1, 10, false)), mat.path);
  const flowMaterial = gpu.track(
    new ShaderMaterial({
      uniforms: {
        color: { value: new Color() },
        time: { value: 0 },
        progress: { value: 0 },
        strength: { value: 1 },
      },
      vertexShader: FLOW_VERTEX,
      fragmentShader: FLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
    }),
  );
  const flowTube = new Mesh(geo(new TubeGeometry(pathCurve, segments, 0.13, 10, false)), flowMaterial);
  world.add(pathTube, flowTube);

  const stationT = STATIONS.map((station) => {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i <= 600; i++) {
      const d = pathCurve.getPointAt(i / 600).setY(0).distanceTo(station);
      if (d < bestDistance) {
        bestDistance = d;
        best = i / 600;
      }
    }
    return best;
  });

  // ---- Plinths: a base, a lighter top, a rim that lights up, and soft contact shadows.
  const rimMaterials: MeshBasicMaterial[] = [];
  const plinthBaseGeometry = geo(new CylinderGeometry(2.05, 2.2, 0.36, 64));
  const plinthTopGeometry = geo(new CylinderGeometry(1.8, 1.9, 0.2, 64));
  const rimGeometry = geo(new TorusGeometry(1.86, 0.045, 8, 96));
  const contactGeometry = geo(new PlaneGeometry(1, 1));
  STATIONS.forEach((station) => {
    const base = mesh(plinthBaseGeometry, mat.plinthBase);
    base.position.set(station.x, 0.18, station.z);
    const top = mesh(plinthTopGeometry, mat.plinthTop);
    top.position.set(station.x, 0.46, station.z);
    const rimMaterial = gpu.track(new MeshBasicMaterial());
    rimMaterials.push(rimMaterial);
    const rimRing = new Mesh(rimGeometry, rimMaterial);
    rimRing.rotation.x = -Math.PI / 2;
    rimRing.position.set(station.x, 0.565, station.z);
    const contact = new Mesh(contactGeometry, mat.contact);
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(station.x, 0.012, station.z);
    contact.scale.set(6.2, 5, 1);
    world.add(base, top, rimRing, contact);
  });

  // ---- Drawn faces: the phone's search screen and the booking card.
  const phoneCanvas = document.createElement("canvas");
  phoneCanvas.width = 256;
  phoneCanvas.height = 480;
  const phoneTexture = gpu.track(new CanvasTexture(phoneCanvas));
  phoneTexture.colorSpace = SRGBColorSpace;
  const bookingCanvas = document.createElement("canvas");
  bookingCanvas.width = 512;
  bookingCanvas.height = 320;
  const bookingTexture = gpu.track(new CanvasTexture(bookingCanvas));
  bookingTexture.colorSpace = SRGBColorSpace;

  function drawPhone(c: Colors) {
    const ctx = phoneCanvas.getContext("2d");
    if (!ctx) return;
    const css = (x: Color) => x.getStyle();
    ctx.fillStyle = css(c.screen);
    ctx.fillRect(0, 0, 256, 480);
    // Search field.
    ctx.fillStyle = css(c.chip);
    ctx.beginPath();
    ctx.roundRect(18, 30, 220, 44, 22);
    ctx.fill();
    ctx.strokeStyle = css(c.muted);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(44, 51, 9, 0, Math.PI * 2);
    ctx.moveTo(51, 58);
    ctx.lineTo(58, 65);
    ctx.stroke();
    ctx.fillStyle = css(c.mutedSoft);
    ctx.beginPath();
    ctx.roundRect(68, 46, 120, 11, 6);
    ctx.fill();
    // A mini map with pins.
    ctx.fillStyle = css(c.map);
    ctx.beginPath();
    ctx.roundRect(18, 90, 220, 170, 18);
    ctx.fill();
    ctx.strokeStyle = css(c.screen);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(18, 200);
    ctx.bezierCurveTo(90, 170, 140, 230, 238, 150);
    ctx.moveTo(120, 90);
    ctx.lineTo(150, 260);
    ctx.stroke();
    for (const [x, y, col] of [
      [70, 150, c.vacant],
      [175, 125, c.accent],
      [190, 215, c.held],
    ] as const) {
      ctx.fillStyle = css(col);
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(c.screen);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Two results, each with a vacancy dot.
    for (const y of [278, 372]) {
      ctx.fillStyle = css(c.chip);
      ctx.beginPath();
      ctx.roundRect(18, y, 220, 80, 16);
      ctx.fill();
      ctx.fillStyle = css(c.map);
      ctx.beginPath();
      ctx.roundRect(28, y + 10, 60, 60, 12);
      ctx.fill();
      ctx.fillStyle = css(c.mutedSoft);
      ctx.beginPath();
      ctx.roundRect(100, y + 18, 110, 12, 6);
      ctx.roundRect(100, y + 40, 70, 10, 5);
      ctx.fill();
      ctx.fillStyle = css(c.vacant);
      ctx.beginPath();
      ctx.arc(214, y + 56, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    phoneTexture.needsUpdate = true;
  }

  function drawBooking(c: Colors) {
    const ctx = bookingCanvas.getContext("2d");
    if (!ctx) return;
    const css = (x: Color) => x.getStyle();
    ctx.fillStyle = css(c.card);
    ctx.fillRect(0, 0, 512, 320);
    // Header strip with an avatar and a title.
    ctx.fillStyle = css(c.accent);
    ctx.fillRect(0, 0, 512, 78);
    ctx.fillStyle = css(c.light);
    ctx.beginPath();
    ctx.arc(52, 39, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect(88, 26, 180, 14, 7);
    ctx.roundRect(88, 48, 110, 10, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Room, move-in date, contract: three rows.
    [104, 146, 188].forEach((y, i) => {
      ctx.fillStyle = css(i === 0 ? c.vacant : c.chip);
      ctx.beginPath();
      ctx.roundRect(32, y, 30, 30, 8);
      ctx.fill();
      ctx.fillStyle = css(c.mutedSoft);
      ctx.beginPath();
      ctx.roundRect(78, y + 9, [210, 160, 190][i], 12, 6);
      ctx.fill();
    });
    // The confirm button.
    ctx.fillStyle = css(c.vacant);
    ctx.beginPath();
    ctx.roundRect(32, 242, 448, 54, 27);
    ctx.fill();
    ctx.fillStyle = css(c.dark);
    ctx.beginPath();
    ctx.roundRect(196, 263, 120, 12, 6);
    ctx.fill();
    bookingTexture.needsUpdate = true;
  }

  const screenMaterial = gpu.track(new MeshBasicMaterial({ map: phoneTexture }));
  const bookingFaceMaterial = gpu.track(new MeshBasicMaterial({ map: bookingTexture }));

  // ---- The step objects: one holder per station, per audience.
  const groups: Record<Audience, Group> = { tenant: new Group(), owner: new Group() };
  const holders: Record<Audience, Group[]> = { tenant: [], owner: [] };
  for (const audience of AUDIENCES) {
    STATIONS.forEach((station) => {
      const holder = new Group();
      holder.position.set(station.x, PLINTH_TOP, station.z - 0.2);
      groups[audience].add(holder);
      holders[audience].push(holder);
    });
    world.add(groups[audience]);
  }
  // Set by applyTokens, which the stage calls before the first frame.
  let colors!: Colors;
  const glows: { material: SpriteMaterial; color: () => Color }[] = [];
  const addGlow = (parent: Object3D, color: () => Color, x: number, y: number, z: number, size: number) => {
    const material = gpu.track(new SpriteMaterial({ map: glow, transparent: true, depthWrite: false }));
    const sprite = new Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(size);
    parent.add(sprite);
    glows.push({ material, color });
  };

  // Tenant 1: a phone searching a map, a magnifier hovering over it, pins on the plinth.
  const magnifier = new Group();
  const tenantPins: Group[] = [];
  {
    const g = holders.tenant[0];
    const phone = new Group();
    const body = mesh(geo(new RoundedBoxGeometry(1.75, 3.25, 0.2, 4, 0.2)), mat.device);
    const screen = new Mesh(geo(new PlaneGeometry(1.52, 2.85)), screenMaterial);
    screen.position.z = 0.105;
    phone.add(body, screen);
    phone.position.set(-0.2, 1.75, 0);
    phone.rotation.set(-0.1, 0.18, 0);
    const lens = mesh(geo(new TorusGeometry(0.46, 0.085, 14, 44)), mat.accent);
    const glass = new Mesh(geo(new CircleGeometry(0.42, 36)), mat.glass);
    const handle = mesh(geo(new CylinderGeometry(0.08, 0.1, 0.85, 12)), mat.accent);
    handle.position.set(0.6, -0.6, 0);
    handle.rotation.z = Math.PI / 4;
    magnifier.add(lens, glass, handle);
    magnifier.position.set(0.95, 2.35, 0.75);
    const pinGeometry = geo(new SphereGeometry(0.2, 18, 14));
    const pinTip = geo(new ConeGeometry(0.2, 0.42, 18));
    [
      [-1.35, 0.85, mat.vacantSolid],
      [1.25, 0.95, mat.accent],
      [1.45, -0.6, mat.gold],
    ].forEach(([x, z, m]) => {
      const pin = new Group();
      const head = mesh(pinGeometry, m as Material);
      head.position.y = 0.62;
      const tip = mesh(pinTip, m as Material);
      tip.position.y = 0.3;
      tip.rotation.x = Math.PI;
      pin.add(head, tip);
      pin.position.set(x as number, 0, z as number);
      tenantPins.push(pin);
      g.add(pin);
    });
    g.add(phone, magnifier);
  }

  // Tenant 2: a dorm whose windows light up one by one; vacant rooms glow lime.
  const dormWindows: { mesh: Mesh; order: number; status: number }[] = [];
  const windowGeometry = geo(new PlaneGeometry(0.34, 0.44));
  {
    const g = holders.tenant[1];
    const body = mesh(box, mat.wall);
    body.scale.set(2.3, 3.1, 1.7);
    body.position.y = 1.55;
    const roof = mesh(box, mat.trim);
    roof.scale.set(2.5, 0.16, 1.9);
    roof.position.y = 3.18;
    const door = new Mesh(geo(new PlaneGeometry(0.5, 0.62)), mat.accent);
    door.position.set(0, 0.31, 0.856);
    g.add(body, roof, door);
    const slabGeometry = geo(new BoxGeometry(2.4, 0.07, 0.3));
    for (let floor = 0; floor < 4; floor++) {
      const y = 0.95 + floor * 0.62;
      const slab = mesh(slabGeometry, mat.trim);
      slab.position.set(0, y - 0.27, 0.95);
      g.add(slab);
      for (let col = 0; col < 4; col++) {
        const pick = rand();
        const status = (floor === 2 && col === 1) || (floor === 0 && col === 3) ? VACANT : pick < 0.2 ? HELD : LIVED;
        const pane = new Mesh(windowGeometry, mat.lived);
        pane.position.set(-0.78 + col * 0.52, y, 0.856);
        g.add(pane);
        dormWindows.push({ mesh: pane, order: floor * 4 + (floor % 2 ? 3 - col : col), status });
        if (status === VACANT) addGlow(g, () => colors.vacant, pane.position.x, y, 1.05, 1.1);
      }
    }
  }

  // Tenant 3 (and owner 3): a chat bubble that becomes a booking card with a ✓.
  const bubbleGeometry = geo(new RoundedBoxGeometry(2.1, 1.35, 0.42, 4, 0.22));
  const tailGeometry = geo(new ConeGeometry(0.26, 0.55, 4));
  const dotGeometry = geo(new SphereGeometry(0.13, 16, 12));
  const cardGeometry = geo(new RoundedBoxGeometry(2.5, 1.6, 0.12, 3, 0.1));
  const cardFaceGeometry = geo(new PlaneGeometry(2.36, 1.48));
  const badgeGeometry = geo(new CylinderGeometry(0.36, 0.36, 0.14, 32));
  function bookingCard() {
    const card = new Group();
    const slab = mesh(cardGeometry, mat.card);
    const face = new Mesh(cardFaceGeometry, bookingFaceMaterial);
    face.position.z = 0.062;
    const badge = new Group();
    const disc = mesh(badgeGeometry, mat.vacantSolid);
    disc.rotation.x = Math.PI / 2;
    const short = mesh(box, mat.dark, false);
    short.scale.set(0.2, 0.08, 0.06);
    short.position.set(-0.08, -0.04, 0.09);
    short.rotation.z = -Math.PI / 4;
    const long = mesh(box, mat.dark, false);
    long.scale.set(0.38, 0.08, 0.06);
    long.position.set(0.08, 0.03, 0.09);
    long.rotation.z = Math.PI / 3.6;
    badge.add(disc, short, long);
    badge.position.set(1.15, 0.72, 0.12);
    card.add(slab, face, badge);
    return { card, badge };
  }
  const chat = { bubble: new Group(), card: new Group(), badge: new Group(), dots: [] as Mesh[] };
  {
    const g = holders.tenant[2];
    const bubble = mesh(bubbleGeometry, mat.accent);
    const tail = mesh(tailGeometry, mat.accent);
    tail.position.set(-0.6, -0.72, 0);
    tail.rotation.set(0, Math.PI / 4, Math.PI + 0.35);
    chat.bubble.add(bubble, tail);
    for (let i = 0; i < 3; i++) {
      const dot = mesh(dotGeometry, mat.light, false);
      dot.position.set(-0.5 + i * 0.5, 0, 0.23);
      chat.bubble.add(dot);
      chat.dots.push(dot);
    }
    chat.bubble.position.y = 1.9;
    const { card, badge } = bookingCard();
    chat.card = card;
    chat.badge = badge;
    card.position.y = 1.75;
    card.rotation.x = -0.08;
    g.add(chat.bubble, card);
  }

  // Owner 1: a dorm assembled floor by floor, with a crane and a "+" above.
  const floors: Group[] = [];
  const plus = new Group();
  {
    const g = holders.owner[0];
    const floorGeometry = geo(new BoxGeometry(2.2, 0.56, 1.6));
    const stripGeometry = geo(new PlaneGeometry(1.9, 0.26));
    for (let k = 0; k < 5; k++) {
      const floor = new Group();
      const block = mesh(floorGeometry, mat.wall);
      const strip = new Mesh(stripGeometry, k % 2 ? mat.vacant : mat.lived);
      strip.position.set(0, 0.03, 0.805);
      floor.add(block, strip);
      floor.userData.restY = 0.28 + k * 0.58;
      floor.position.y = floor.userData.restY;
      floors.push(floor);
      g.add(floor);
    }
    const bar = mesh(box, mat.vacantSolid);
    bar.scale.set(0.7, 0.18, 0.18);
    const bar2 = bar.clone();
    bar2.rotation.z = Math.PI / 2;
    plus.add(bar, bar2);
    plus.position.y = 3.55;
    // The crane: a mast, a jib, and a hook line.
    const mast = mesh(box, mat.gold);
    mast.scale.set(0.14, 3.9, 0.14);
    mast.position.set(1.55, 1.95, -0.55);
    const jib = mesh(box, mat.gold);
    jib.scale.set(2.3, 0.12, 0.12);
    jib.position.set(0.75, 3.85, -0.55);
    const cable = mesh(box, mat.trim, false);
    cable.scale.set(0.03, 0.8, 0.03);
    cable.position.set(-0.2, 3.4, -0.55);
    g.add(plus, mast, jib, cable);
  }

  // Owner 2: a room map on a stand; its rooms flip to a new status.
  const mapRooms: { mesh: Mesh; status: number; flip: number; next: number }[] = [];
  const roomMaterials: MeshLambertMaterial[] = [];
  {
    const g = holders.owner[1];
    const stand = new Group();
    const tray = mesh(geo(new RoundedBoxGeometry(3, 2.3, 0.18, 3, 0.08)), mat.trim);
    stand.add(tray);
    const cube = geo(new RoundedBoxGeometry(0.56, 0.56, 0.3, 3, 0.08));
    for (let i = 0; i < 12; i++) {
      const material = lambert();
      roomMaterials.push(material);
      const room = mesh(cube, material);
      room.position.set(-1.02 + (i % 4) * 0.68, 0.72 - Math.floor(i / 4) * 0.72, 0.2);
      stand.add(room);
      const r = rand();
      mapRooms.push({ mesh: room, status: r < 0.35 ? VACANT : r < 0.55 ? HELD : LIVED, flip: 0, next: 0 });
    }
    const leg = mesh(box, mat.trim);
    leg.scale.set(0.16, 1.2, 0.16);
    leg.position.set(0, -1.6, -0.25);
    stand.add(leg);
    stand.position.set(0, 2.15, 0);
    stand.rotation.x = -0.32;
    g.add(stand);
  }

  // Owner 3: a confirmed booking, a golden key and a burst of sparks.
  const key3 = new Group();
  let ownerBadge = new Group();
  const sparkCount = 26;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkDirections = Array.from({ length: sparkCount }, () =>
    new Vector3(rand() - 0.5, rand() * 0.8 + 0.1, rand() - 0.5).normalize(),
  );
  const sparkAttr = new BufferAttribute(sparkPositions, 3);
  sparkAttr.setUsage(DynamicDrawUsage);
  const sparkColors = new BufferAttribute(new Float32Array(sparkCount * 4), 4);
  sparkColors.setUsage(DynamicDrawUsage);
  const sparkGeometry = geo(new BufferGeometry());
  sparkGeometry.setAttribute("position", sparkAttr);
  sparkGeometry.setAttribute("color", sparkColors);
  const sparkMaterial = gpu.track(
    new PointsMaterial({ size: 0.32, map: glow, vertexColors: true, transparent: true, depthWrite: false }),
  );
  {
    const g = holders.owner[2];
    const { card, badge } = bookingCard();
    ownerBadge = badge;
    card.position.y = 1.8;
    card.rotation.x = -0.08;
    const ring = mesh(geo(new TorusGeometry(0.34, 0.1, 12, 32)), mat.gold);
    const shaft = mesh(box, mat.gold);
    shaft.scale.set(1.05, 0.14, 0.14);
    shaft.position.x = 0.85;
    const tooth = mesh(box, mat.gold);
    tooth.scale.set(0.12, 0.28, 0.14);
    tooth.position.set(1.2, -0.17, 0);
    const tooth2 = tooth.clone();
    tooth2.position.x = 0.98;
    key3.add(ring, shaft, tooth, tooth2);
    key3.position.set(1.15, 3.15, 0.4);
    key3.scale.setScalar(0.8);
    const sparks = new Points(sparkGeometry, sparkMaterial);
    sparks.position.y = 1.8;
    g.add(card, key3, sparks);
  }

  // ---- The traveller: a bright bead carrying the light along the path.
  const traveller = new Group();
  const bead = new Mesh(geo(new SphereGeometry(0.22, 20, 16)), mat.traveller);
  const travellerGlowMaterial = gpu.track(new SpriteMaterial({ map: glow, transparent: true, depthWrite: false }));
  const travellerGlow = new Sprite(travellerGlowMaterial);
  travellerGlow.scale.setScalar(1.8);
  traveller.add(bead, travellerGlow);
  world.add(traveller);

  function paintRooms() {
    const palette = [colors.vacant, colors.held, colors.lived];
    mapRooms.forEach((room, i) => roomMaterials[i].color.copy(palette[room.flip > 0.5 ? room.next : room.status]));
  }

  function applyTokens(tokens: Tokens) {
    colors = stepColors(tokens);
    const c = colors;
    const night = c.night;
    fog.color.copy(tokens.surface);

    hemi.color.copy(white).lerp(c.accentSoft, night ? 0.25 : 0.1);
    hemi.groundColor.copy(c.ground);
    hemi.intensity = night ? 0.7 : 1.15;
    key.intensity = night ? 0.9 : 1.9;
    key.color.copy(white).lerp(tokens.held, night ? 0 : 0.06);
    rim.color.copy(c.accent);
    rim.intensity = night ? 2.2 : 0.4;
    lamp.color.copy(c.accent);
    shadowMaterial.opacity = night ? 0.45 : 0.16;

    groundMaterial.uniforms.base.value.copy(c.ground);
    groundMaterial.uniforms.line.value.copy(c.gridLine);
    groundMaterial.uniforms.glowColor.value.copy(c.glow);
    groundMaterial.uniforms.glowStrength.value = night ? 0.2 : 0.06;
    groundMaterial.uniforms.lineAlpha.value = night ? 0.55 : 0.45;
    flowMaterial.uniforms.color.value.copy(c.accent);
    flowMaterial.blending = night ? AdditiveBlending : NormalBlending;
    flowMaterial.needsUpdate = true;

    mat.plinthBase.color.copy(c.plinthBase);
    mat.plinthTop.color.copy(c.plinthTop);
    mat.path.color.copy(c.pathDim);
    mat.wall.color.copy(c.wall);
    mat.trim.color.copy(c.trim);
    mat.device.color.copy(c.device);
    mat.card.color.copy(c.card);
    mat.accent.color.copy(c.accent);
    mat.vacantSolid.color.copy(c.vacant);
    mat.gold.color.copy(c.held);
    mat.glass.color.copy(c.accentSoft);
    mat.vacant.color.copy(c.vacant);
    mat.held.color.copy(c.held);
    mat.lived.color.copy(c.lived);
    mat.light.color.copy(c.light);
    mat.dark.color.copy(c.dark);
    mat.traveller.color.copy(night ? c.light : c.accent);
    mat.contact.color.copy(c.shadow);
    mat.contact.opacity = night ? 0.55 : 0.14;

    for (const m of [travellerGlowMaterial, sparkMaterial, ...glows.map((g) => g.material)]) {
      m.blending = night ? AdditiveBlending : NormalBlending;
      m.needsUpdate = true;
    }
    travellerGlowMaterial.color.copy(c.accent);
    for (const g of glows) g.material.color.copy(g.color());
    for (let i = 0; i < sparkCount; i++) {
      const col = i % 3 === 0 ? c.held : i % 3 === 1 ? c.vacant : c.accent;
      sparkColors.setXYZW(i, col.r, col.g, col.b, 0);
    }
    sparkColors.needsUpdate = true;

    drawPhone(c);
    drawBooking(c);
    paintRooms();
  }

  // ---- Camera: a framed shot per step, or a wide shot after the tab changes.
  let tanHalf = Math.tan((34 * Math.PI) / 360);
  let aspect = 1.6;
  const cam = { target: new Vector3(0, 1.4, 0), distance: 20, yaw: 0, elevation: 0.5 };
  const goal = { target: new Vector3(), distance: 0, yaw: 0, elevation: 0 };

  function wideShot() {
    goal.target.set(0, 1.3, 0.2);
    goal.distance = Math.max(4.6 / tanHalf, 10.4 / (tanHalf * aspect));
    goal.yaw = 0;
    goal.elevation = 0.5;
  }

  function stepShot(k: number) {
    const s = STATIONS[k];
    goal.target.set(s.x, 1.55, s.z - 0.1);
    // Frame the object with its plinth (~4.6 tall incl. the crane, ~5.6 wide), with room
    // for the overlay bar at the bottom and air above the tallest prop.
    goal.distance = Math.max(3.9 / tanHalf, 4.6 / (tanHalf * aspect));
    goal.yaw = SHOT_YAW[k];
    goal.elevation = 0.3;
  }

  function resize(width: number, height: number) {
    aspect = width / height;
    camera.aspect = aspect;
    camera.fov = aspect < 1.2 ? 40 : 34;
    tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    camera.updateProjectionMatrix();
  }

  // ---- Animated state.
  const appear: Record<Audience, number> = { tenant: 0, owner: 0 };
  const emphasis = [0, 0, 0];
  let progress = 0;
  let travellerScale = 1;
  let lastKey = "";
  let stepStart = 0;
  let pullUntil = 0.9; // open on the wide shot, then fly in
  let nextFlip = 0;
  const lampTarget = new Vector3();

  function update(dt: number, time: number, input: StageInput) {
    const { audience, active } = getJourney();
    const still = dt === 0;
    const ease = (rate: number) => (still ? 1 : 1 - Math.exp(-dt * rate));

    const keyNow = `${audience}:${active}`;
    if (keyNow !== lastKey) {
      const tabChanged = lastKey !== "" && !lastKey.startsWith(audience);
      lastKey = keyNow;
      stepStart = time;
      if (tabChanged && !still) pullUntil = time + 1;
    }
    const inStep = still ? 99 : time - stepStart;

    // Tab swap and step emphasis.
    for (let k = 0; k < 3; k++) emphasis[k] += ((k === active ? 1 : 0) - emphasis[k]) * ease(4);
    for (const a of AUDIENCES) {
      appear[a] += ((a === audience ? 1 : 0) - appear[a]) * ease(5);
      const s = appear[a] < 0.003 ? 0 : a === audience ? pop(appear[a]) : appear[a];
      groups[a].visible = s > 0;
      holders[a].forEach((holder, k) => {
        const e = emphasis[k];
        holder.scale.setScalar(s * (0.9 + e * 0.1));
        holder.position.y = PLINTH_TOP + (still ? 0 : e * Math.sin(time * 1.8) * 0.06);
      });
    }

    // Camera.
    if (!still && time < pullUntil) wideShot();
    else stepShot(active);
    cam.target.lerp(goal.target, ease(1.7));
    cam.distance += (goal.distance - cam.distance) * ease(1.7);
    cam.yaw += (goal.yaw - cam.yaw) * ease(1.7);
    cam.elevation += (goal.elevation - cam.elevation) * ease(1.7);
    const orbit = still ? 0 : Math.sin(time * 0.22) * 0.12;
    const yaw = cam.yaw + orbit + input.pointer.x * 0.14;
    const elevation = cam.elevation + input.pointer.y * 0.05;
    camera.position.set(
      cam.target.x + Math.sin(yaw) * Math.cos(elevation) * cam.distance,
      cam.target.y + Math.sin(elevation) * cam.distance,
      cam.target.z + Math.cos(yaw) * Math.cos(elevation) * cam.distance,
    );
    camera.lookAt(cam.target);

    // The traveller walks to the active step; back to step 1 starts the walk again.
    const goalT = stationT[active];
    if (still) progress = goalT;
    else {
      if (goalT < progress - 0.02) {
        progress = 0;
        travellerScale = 0;
      }
      progress += (goalT - progress) * ease(1.6);
      travellerScale += (1 - travellerScale) * ease(5);
    }
    pathCurve.getPointAt(Math.min(1, Math.max(0, progress)), traveller.position);
    const moving = Math.abs(goalT - progress) > 0.004;
    traveller.position.y = 0.42 + (moving && !still ? Math.abs(Math.sin(time * 8)) * 0.16 : 0);
    traveller.scale.setScalar(Math.max(0.001, travellerScale));
    flowMaterial.uniforms.time.value = time;
    flowMaterial.uniforms.progress.value = progress;
    flowMaterial.uniforms.strength.value = colors.night ? 0.9 : 0.75;

    // Plinth rims and the lamp mark the active step.
    rimMaterials.forEach((m, k) => {
      const pulse = still ? 1 : 0.8 + Math.sin(time * 3) * 0.2;
      m.color.copy(colors.rimIdle).lerp(colors.accent, emphasis[k] * pulse);
    });
    lampTarget.set(STATIONS[active].x, 3.2, STATIONS[active].z + 1.6);
    lamp.position.lerp(lampTarget, ease(3));
    lamp.intensity = colors.night ? 8 : 0;

    const e = emphasis;
    const t = still ? 0 : time;

    // Tenant 1: the magnifier sweeps the screen; the pins pop up.
    magnifier.position.set(0.95 + Math.sin(t * 1.2) * 0.35 * e[0], 2.35 + Math.cos(t * 1.5) * 0.2 * e[0], 0.75);
    magnifier.rotation.z = Math.sin(t * 0.9) * 0.15;
    tenantPins.forEach((pin, i) => {
      const up = audience === "tenant" && active === 0 ? pop(smooth(0, 0.5, inStep - 0.25 - i * 0.18)) : 1;
      pin.scale.setScalar(Math.max(0.001, up));
      pin.position.y = Math.sin(t * 2 + i) * 0.05 * e[0];
    });

    // Tenant 2: windows light up in order while the step plays; vacant ones glow.
    const lighting = audience === "tenant" && active === 1;
    for (const w of dormWindows) {
      const on = !lighting || inStep > 0.2 + w.order * 0.07;
      w.mesh.material = on ? (w.status === VACANT ? mat.vacant : w.status === HELD ? mat.held : mat.lived) : mat.trim;
      const s = w.status === VACANT && on ? 1 + Math.sin(t * 3) * 0.07 * e[1] : 1;
      w.mesh.scale.setScalar(s);
    }
    for (const g of glows) g.material.opacity = (colors.night ? 0.9 : 0.4) * (lighting ? smooth(0.6, 1.4, inStep) : 0.6);

    // Tenant 3: typing, then the bubble turns into a booking card.
    const morph = audience === "tenant" && active === 2 ? smooth(1.4, 2.1, inStep) : 0;
    chat.bubble.scale.setScalar(Math.max(0.001, 1 - morph));
    chat.bubble.visible = morph < 0.999;
    chat.card.scale.setScalar(Math.max(0.001, pop(morph)));
    chat.card.visible = morph > 0.001;
    chat.badge.scale.setScalar(Math.max(0.001, pop(smooth(2.1, 2.6, inStep)) * (morph > 0 ? 1 : 0)));
    chat.dots.forEach((dot, i) => {
      dot.position.y = Math.max(0, Math.sin(t * 7 - i * 0.8)) * 0.14 * e[2];
    });

    // Owner 1: floors drop into place one by one; the "+" spins above.
    const building = audience === "owner" && active === 0;
    floors.forEach((floor, k) => {
      const land = building ? smooth(0, 0.45, inStep - 0.2 - k * 0.3) : 1;
      floor.position.y = floor.userData.restY + (1 - land) * 2.2;
      floor.scale.setScalar(Math.max(0.001, land < 0.02 ? 0 : 0.6 + land * 0.4));
      floor.visible = land > 0.02;
    });
    plus.rotation.y = still ? 0.5 : time * 1.3;
    plus.position.y = 3.55 + Math.sin(t * 2) * 0.1;
    plus.scale.setScalar(Math.max(0.001, building ? pop(smooth(1.7, 2.2, inStep)) : 1));

    // Owner 2: rooms flip to a new status.
    if (!still && audience === "owner" && active === 1 && time >= nextFlip) {
      nextFlip = time + 0.5;
      const room = mapRooms[Math.floor(Math.random() * mapRooms.length)];
      if (room.flip === 0) {
        room.next = (room.status + 1) % 3;
        room.flip = 0.0001;
      }
    }
    for (const room of mapRooms) {
      if (room.flip > 0 && !still) {
        room.flip = Math.min(1, room.flip + dt * 2.2);
        room.mesh.rotation.x = room.flip * Math.PI * 2;
        if (room.flip >= 1) {
          room.status = room.next;
          room.flip = 0;
          room.mesh.rotation.x = 0;
        }
      }
    }
    paintRooms();

    // Owner 3: the ✓ pops, the key turns, sparks burst from the card.
    const confirming = audience === "owner" && active === 2;
    ownerBadge.scale.setScalar(Math.max(0.001, confirming ? pop(smooth(0.5, 1, inStep)) : 1));
    key3.rotation.set(0.3, still ? 0.6 : time * 0.9, Math.sin(t * 1.4) * 0.2);
    key3.position.y = 3.15 + Math.sin(t * 1.6) * 0.12;
    const burst = confirming && !still ? ((inStep - 0.6) % 2.4) / 2.4 : -1;
    for (let i = 0; i < sparkCount; i++) {
      const d = sparkDirections[i];
      const r = burst < 0 ? 0 : burst * (1.6 + (i % 5) * 0.25);
      sparkAttr.setXYZ(i, d.x * r * 1.6, d.y * r, d.z * r + 0.3);
      sparkColors.setW(i, burst < 0 ? 0 : (1 - burst) * (colors.night ? 1 : 0.8));
    }
    sparkAttr.needsUpdate = true;
    sparkColors.needsUpdate = true;

    travellerGlowMaterial.opacity = colors.night ? 0.95 : 0.55;
    world.rotation.y = (input.through - 0.5) * 0.08;
  }

  // With reduced motion the stage draws only on resize or theme change, so redraw on a new step.
  const unsubscribe = reducedMotion
    ? subscribeJourney(() => {
        update(0, 0, { pointer: new Vector2(), exit: 0, through: 0.5 });
        renderer.render(scene, camera);
      })
    : () => {};

  return {
    scene,
    camera,
    applyTokens,
    resize,
    update,
    dispose() {
      unsubscribe();
      gpu.dispose();
    },
  };
}
