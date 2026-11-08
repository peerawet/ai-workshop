/**
 * The owner section's model dorm: five floors of rooms whose balcony windows show each room's
 * status and keep changing, the floor-by-floor room map an owner manages, as a building. It
 * turns gently with the pointer and as the section scrolls by. Colours follow the theme tokens;
 * at night (dark theme) vacant and held rooms glow.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NormalBlending,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
} from "three";
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
  return mountStage(container, options, buildDorm);
}

const FLOORS = 5;
const ROOMS = 6;
const ROOM_W = 1.7;
const FLOOR_H = 1.3;
const DEPTH = 2.8;
const LOBBY_H = 1.5;
const WIDTH = ROOMS * ROOM_W + 0.4;
const HEIGHT = LOBBY_H + FLOORS * FLOOR_H;

// Room states, as on the room map.
const VACANT = 0;
const HELD = 1;
const OCCUPIED = 2;
const MAINTENANCE = 3;

function nextStatus(s: number) {
  if (s === VACANT) return HELD;
  if (s === HELD) return Math.random() < 0.6 ? OCCUPIED : VACANT;
  if (s === OCCUPIED) return Math.random() < 0.85 ? VACANT : MAINTENANCE;
  return VACANT;
}

function dormColors(t: Tokens) {
  const night = t.dark;
  const surface = t.surface;
  return {
    night,
    background: surface.clone(),
    building: surface.clone().lerp(t.ink, night ? 0.09 : 0.14),
    trim: surface.clone().lerp(t.ink, night ? 0.18 : 0.3),
    ground: surface.clone().lerp(t.ink, night ? 0.05 : 0.08),
    shadow: night ? surface.clone().multiplyScalar(0.4) : surface.clone().lerp(t.ink, 0.35),
    glass: night ? surface.clone().lerp(t.accent, 0.3) : t.accentSoft.clone().lerp(surface, 0.25),
    sign: t.accent.clone(),
    tree: [t.charts[0].clone().lerp(surface, 0.15), t.charts[1].clone().lerp(t.charts[0], 0.4)],
    trunk: surface.clone().lerp(t.ink, 0.45),
    // Matches the legend in owner-section.tsx: chart-2, status-yellow-text, a neutral grey.
    status: [
      t.charts[1].clone(),
      t.held.clone(),
      surface.clone().lerp(t.ink, night ? 0.22 : 0.3).lerp(t.accentSoft, 0.12),
      t.rose.clone(),
    ],
    flash: night ? t.ink.clone() : surface.clone(),
  };
}

function buildDorm({ reducedMotion }: BuildContext): SceneParts {
  const gpu = disposer();
  const rand = seeded(42);
  const dummy = new Object3D();
  const tmp = new Color();
  const white = new Color(1, 1, 1);

  const scene = new Scene();
  scene.background = new Color();
  const camera = new PerspectiveCamera(30, 1, 0.1, 200);
  const target = new Vector3(0, HEIGHT * 0.42, 0);
  let distance = 30;

  const hemi = new HemisphereLight(white.clone(), white.clone(), 1);
  const sun = new DirectionalLight(white.clone(), 1);
  sun.position.set(-4, 9, 7);
  scene.add(hemi, sun);

  const model = new Group();
  scene.add(model);
  const box = gpu.track(new BoxGeometry(1, 1, 1));
  const glow = gpu.track(glowTexture());

  // Ground: a round plot with a soft contact shadow under the building.
  const groundMaterial = gpu.track(new MeshLambertMaterial());
  const plot = new Mesh(gpu.track(new CylinderGeometry(8.5, 8.5, 0.3, 64)), groundMaterial);
  plot.position.y = -0.15;
  const shadowMaterial = gpu.track(new MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false }));
  const shadow = new Mesh(gpu.track(new PlaneGeometry(1, 1)), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.scale.set(WIDTH * 1.7, DEPTH * 3.2, 1);
  model.add(plot, shadow);

  // The block, its roof and the rooftop sign.
  const buildingMaterial = gpu.track(new MeshLambertMaterial());
  const core = new Mesh(box, buildingMaterial);
  core.scale.set(WIDTH, HEIGHT, DEPTH);
  core.position.y = HEIGHT / 2;
  const trimMaterial = gpu.track(new MeshLambertMaterial());
  const roof = new Mesh(box, trimMaterial);
  roof.scale.set(WIDTH + 0.35, 0.2, DEPTH + 0.35);
  roof.position.y = HEIGHT + 0.1;
  const signMaterial = gpu.track(new MeshLambertMaterial());
  const sign = new Mesh(box, signMaterial);
  sign.scale.set(3, 0.6, 0.14);
  sign.position.set(-WIDTH / 2 + 2.2, HEIGHT + 0.6, DEPTH / 2 - 0.3);
  const tank = new Mesh(gpu.track(new CylinderGeometry(0.45, 0.45, 0.8, 20)), trimMaterial);
  tank.position.set(WIDTH / 2 - 1.3, HEIGHT + 0.6, -0.4);
  model.add(core, roof, sign, tank);

  // Lobby glass across the ground floor.
  const glassMaterial = gpu.track(new MeshLambertMaterial());
  const lobby = new Mesh(gpu.track(new PlaneGeometry(WIDTH - 1.2, LOBBY_H - 0.45)), glassMaterial);
  lobby.position.set(0, (LOBBY_H - 0.45) / 2 + 0.12, DEPTH / 2 + 0.01);
  model.add(lobby);

  // Balconies: a slab under every floor, a rail on top, and dividers between rooms.
  const trims = new InstancedMesh(box, trimMaterial, (FLOORS + 1) + FLOORS + FLOORS * (ROOMS + 1));
  let n = 0;
  const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    trims.setMatrixAt(n++, dummy.matrix);
  };
  const balconyZ = DEPTH / 2 + 0.3;
  for (let f = 0; f <= FLOORS; f++) put(0, LOBBY_H + f * FLOOR_H, balconyZ, WIDTH + 0.2, 0.1, 0.62);
  for (let f = 0; f < FLOORS; f++) {
    const y0 = LOBBY_H + f * FLOOR_H;
    put(0, y0 + 0.5, DEPTH / 2 + 0.58, WIDTH + 0.2, 0.05, 0.05);
    for (let r = 0; r <= ROOMS; r++) put(-WIDTH / 2 + 0.2 + r * ROOM_W, y0 + FLOOR_H / 2, balconyZ, 0.07, FLOOR_H, 0.6);
  }
  model.add(trims);

  // Rooms: one window per room, coloured by status.
  const roomCount = FLOORS * ROOMS;
  const status = new Uint8Array(roomCount);
  const flash = new Float32Array(roomCount);
  const pop = new Float32Array(roomCount);
  const roomPos: Vector3[] = [];
  const windowMaterial = gpu.track(new MeshBasicMaterial({ color: white.clone() }));
  const windows = new InstancedMesh(gpu.track(new PlaneGeometry(ROOM_W - 0.4, FLOOR_H - 0.38)), windowMaterial, roomCount);
  const windowColors = new InstancedBufferAttribute(new Float32Array(roomCount * 3), 3);
  windowColors.setUsage(DynamicDrawUsage);
  windows.instanceColor = windowColors;
  for (let f = 0; f < FLOORS; f++) {
    for (let r = 0; r < ROOMS; r++) {
      const i = f * ROOMS + r;
      roomPos.push(new Vector3(-WIDTH / 2 + 0.2 + (r + 0.5) * ROOM_W, LOBBY_H + f * FLOOR_H + FLOOR_H / 2 + 0.06, DEPTH / 2 + 0.01));
      const x = rand();
      status[i] = x < 0.3 ? VACANT : x < 0.43 ? HELD : x < 0.93 ? OCCUPIED : MAINTENANCE;
    }
  }
  model.add(windows);

  const glowGeometry = gpu.track(new BufferGeometry());
  const glowPositions = new Float32Array(roomCount * 3);
  roomPos.forEach((p, i) => glowPositions.set([p.x, p.y, p.z + 0.25], i * 3));
  glowGeometry.setAttribute("position", new BufferAttribute(glowPositions, 3));
  const glowColors = new BufferAttribute(new Float32Array(roomCount * 4), 4);
  glowColors.setUsage(DynamicDrawUsage);
  glowGeometry.setAttribute("color", glowColors);
  const glowMaterial = gpu.track(
    new PointsMaterial({ size: 2.6, map: glow, vertexColors: true, transparent: true, depthWrite: false }),
  );
  model.add(new Points(glowGeometry, glowMaterial));

  // A few low-poly trees around the plot.
  const crownMaterials = [gpu.track(new MeshLambertMaterial({ flatShading: true })), gpu.track(new MeshLambertMaterial({ flatShading: true }))];
  const trunkMaterial = gpu.track(new MeshLambertMaterial());
  const crownGeometry = gpu.track(new IcosahedronGeometry(0.7, 0));
  const trunkGeometry = gpu.track(new CylinderGeometry(0.09, 0.12, 0.7, 6));
  for (const [x, z, s] of [
    [-7, 2.6, 1.1],
    [-6.2, -2.4, 0.85],
    [6.8, 2.9, 1],
    [7.2, -1.6, 1.25],
    [-3.6, 5.6, 0.8],
    [4.4, 5.4, 0.9],
  ]) {
    const trunk = new Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(x, 0.35 * s, z);
    trunk.scale.setScalar(s);
    const crown = new Mesh(crownGeometry, crownMaterials[Math.round(rand())]);
    crown.position.set(x, (0.7 + 0.55) * s, z);
    crown.scale.setScalar(s);
    crown.rotation.set(rand(), rand(), rand());
    model.add(trunk, crown);
  }

  let colors!: ReturnType<typeof dormColors>;

  function paintRoom(i: number) {
    tmp.copy(colors.status[status[i]]);
    if (flash[i] > 0) tmp.lerp(colors.flash, flash[i] * 0.6);
    windowColors.setXYZ(i, tmp.r, tmp.g, tmp.b);
    const lit = colors.night && (status[i] === VACANT || status[i] === HELD);
    const c = colors.status[status[i]];
    glowColors.setXYZW(i, c.r, c.g, c.b, lit ? Math.min(1, 0.7 * (1 + flash[i])) : 0);
    // A changed room pops forward a touch, then settles.
    const s = 1 + pop[i] * 0.18;
    const p = roomPos[i];
    dummy.position.set(p.x, p.y, p.z + pop[i] * 0.06);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(s, s, 1);
    dummy.updateMatrix();
    windows.setMatrixAt(i, dummy.matrix);
  }

  function paintAll() {
    for (let i = 0; i < roomCount; i++) paintRoom(i);
    windowColors.needsUpdate = true;
    glowColors.needsUpdate = true;
    windows.instanceMatrix.needsUpdate = true;
  }

  function applyTokens(tokens: Tokens) {
    colors = dormColors(tokens);
    const c = colors;
    (scene.background as Color).copy(c.background);
    hemi.color.copy(white).lerp(tokens.accentSoft, 0.15);
    hemi.groundColor.copy(c.ground);
    hemi.intensity = c.night ? 0.85 : 1.1;
    sun.intensity = c.night ? 0.45 : 1.2;
    buildingMaterial.color.copy(c.building);
    trimMaterial.color.copy(c.trim);
    groundMaterial.color.copy(c.ground);
    glassMaterial.color.copy(c.glass);
    signMaterial.color.copy(c.sign);
    shadowMaterial.color.copy(c.shadow);
    shadowMaterial.opacity = c.night ? 0.8 : 0.45;
    shadowMaterial.blending = NormalBlending;
    crownMaterials.forEach((m, i) => m.color.copy(c.tree[i]));
    trunkMaterial.color.copy(c.trunk);
    glowMaterial.blending = c.night ? AdditiveBlending : NormalBlending;
    glowMaterial.needsUpdate = true;
    paintAll();
  }

  function resize(width: number, height: number) {
    camera.aspect = width / height;
    // Fit the plot (radius ~8.5) and the building's height, whatever the box's shape.
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    distance = Math.max(7 / tanHalf, 10.2 / (tanHalf * camera.aspect));
    camera.updateProjectionMatrix();
  }

  let nextChange = 1.2;
  const changing = new Set<number>();

  function update(dt: number, time: number, input: StageInput) {
    const motion = reducedMotion ? 0 : 1;
    model.rotation.y = -0.5 + Math.sin(time * 0.22) * 0.22 * motion + input.pointer.x * 0.35 + (input.through - 0.5) * 0.7;

    const elevation = 0.32 + input.pointer.y * 0.08;
    camera.position.set(0, target.y + Math.sin(elevation) * distance, Math.cos(elevation) * distance);
    camera.lookAt(target);

    if (dt === 0) return;
    while (time >= nextChange) {
      nextChange += 0.7 + Math.random() * 0.6;
      const i = Math.floor(Math.random() * roomCount);
      status[i] = nextStatus(status[i]);
      flash[i] = 1;
      pop[i] = 1;
      changing.add(i);
    }
    if (changing.size) {
      for (const i of changing) {
        flash[i] = Math.max(0, flash[i] - dt * 1.3);
        pop[i] = Math.max(0, pop[i] - dt * 2.2);
        paintRoom(i);
        if (flash[i] === 0 && pop[i] === 0) changing.delete(i);
      }
      windowColors.needsUpdate = true;
      glowColors.needsUpdate = true;
      windows.instanceMatrix.needsUpdate = true;
    }
    glowMaterial.opacity = 0.85 + Math.sin(time * 1.4) * 0.15;
  }

  return {
    scene,
    camera,
    applyTokens,
    resize,
    update,
    dispose() {
      trims.dispose();
      windows.dispose();
      gpu.dispose();
    },
  };
}
