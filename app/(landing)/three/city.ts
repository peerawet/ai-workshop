/**
 * The hero's city. Every window is a room: most are lived in, a few glow as vacant (lime) or
 * held (yellow), and they keep changing, which is the live room map at the scale of a city.
 *
 * Dark theme is night: a moon, stars, lit windows, street lamps, and cars with headlights.
 * Light theme is day: a blue sky with a sun and drifting clouds, sunlit towers, glass windows.
 * Every colour comes from the page's tokens (see stage.ts), so the scene follows the theme.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Fog,
  HemisphereLight,
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
  ShaderMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Material,
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
  return mountStage(container, options, buildCity);
}

// Window states.
const OFF = 0;
const LIVED = 1;
const VACANT = 2;
const HELD = 3;

/** How a room moves on: vacant rooms get held, holds confirm or lapse, tenants come and go. */
function nextStatus(s: number) {
  if (s === VACANT) return HELD;
  if (s === HELD) return Math.random() < 0.5 ? LIVED : VACANT;
  if (s === LIVED) return Math.random() < 0.3 ? VACANT : OFF;
  return LIVED;
}

// Street layout (world units). The road runs along x in front of the first row of towers.
const ROAD_Z = 12;
const ROAD_HALF = 5;
const LANES = [
  { z: 9.7, dir: 1 },
  { z: 14.3, dir: -1 },
];
const CAR_WRAP = 120;

interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  row: number;
}

function layoutCity(rand: () => number, compact: boolean): Building[] {
  const buildings: Building[] = [];
  const rows = compact ? 7 : 10;
  const frontLimit = ROAD_Z - ROAD_HALF - 2.4; // leave room for the sidewalk and lamps
  for (let row = 0; row < rows; row++) {
    const z = -2 - row * 14;
    // Rows widen with distance so the skyline fills the frame edge to edge.
    const span = 40 + row * 14;
    for (let x = -span; x <= span; x += 9) {
      if (rand() < 0.16) continue; // side streets and empty lots
      const bx = x + (rand() - 0.5) * 3;
      const near = row < 2;
      // Keep the front rows low and sparse on the headline side, so the text sits on calm ground.
      if (near && bx < -2 && rand() < 0.65) continue;
      const tower = rand() < 0.12 ? 1.8 : 1;
      const base = near ? (bx < 0 ? 3 : 7) : 6 + row * 1.5;
      const h = base + rand() * (near ? 12 : 10 + row * 2.2) * tower;
      const d = 4 + rand() * 4;
      const bz = Math.min(z + (rand() - 0.5) * 4, frontLimit - d / 2);
      buildings.push({ x: bx, z: bz, w: 4 + rand() * 4, d, h, row });
    }
  }
  // A landmark tower behind the room-map card, tall enough to rise above it.
  buildings.push({ x: 16, z: -12, w: 7, d: 6, h: compact ? 28 : 34, row: 1 });
  return buildings;
}

interface WindowSlot {
  x: number;
  y: number;
  z: number;
  /** Rotation about Y: 0 faces the street (+z), ±π/2 faces sideways. */
  ry: number;
  row: number;
}

function windowsOf(b: Building, out: WindowSlot[]) {
  const pitchX = 1.05;
  const pitchY = 1.35;
  const floors = Math.max(1, Math.floor((b.h - 1.6) / pitchY));
  const frontCols = Math.max(1, Math.floor((b.w - 0.8) / pitchX));
  const fx0 = b.x - ((frontCols - 1) * pitchX) / 2;
  const fz = b.z + b.d / 2 + 0.03;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < frontCols; c++) out.push({ x: fx0 + c * pitchX, y: 1.6 + f * pitchY, z: fz, ry: 0, row: b.row });
  }
  // The near rows also show the side that faces the camera.
  if (b.row > 2 || Math.abs(b.x) < 2) return;
  const sideCols = Math.max(1, Math.floor((b.d - 0.8) / pitchX));
  const sz0 = b.z - ((sideCols - 1) * pitchX) / 2;
  const right = b.x > 0;
  const sx = right ? b.x - b.w / 2 - 0.03 : b.x + b.w / 2 + 0.03;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < sideCols; c++) {
      out.push({ x: sx, y: 1.6 + f * pitchY, z: sz0 + c * pitchX, ry: right ? -Math.PI / 2 : Math.PI / 2, row: b.row });
    }
  }
}

/** A pale disc with a few soft craters, tinted by the sprite colour. */
function moonTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const r = size / 2;
    const disc = ctx.createRadialGradient(r * 0.85, r * 0.8, r * 0.1, r, r, r);
    disc.addColorStop(0, "white");
    disc.addColorStop(0.9, "rgb(225 225 225)");
    disc.addColorStop(0.97, "rgb(210 210 210 / 0.9)");
    disc.addColorStop(1, "transparent");
    ctx.fillStyle = disc;
    ctx.fillRect(0, 0, size, size);
    // Maria: broad, faint, irregular patches rather than neat circles.
    ctx.fillStyle = "rgb(0 0 0 / 0.045)";
    for (const [cx, cy, rx, ry, rot] of [
      [0.36, 0.38, 0.17, 0.11, 0.5],
      [0.55, 0.3, 0.09, 0.06, -0.3],
      [0.6, 0.6, 0.2, 0.12, 0.9],
      [0.3, 0.64, 0.06, 0.05, 0],
      [0.47, 0.47, 0.05, 0.035, 1.2],
    ]) {
      ctx.beginPath();
      ctx.ellipse(cx * size, cy * size, rx * size, ry * size, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const SKY_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 top;
uniform vec3 horizon;
varying vec2 vUv;
void main() {
  float t = smoothstep(0.05, 0.42, vUv.y);
  gl_FragColor = vec4(mix(horizon, top, t), 1.0);
  #include <colorspace_fragment>
}`;

/** Colours for one theme, derived from the tokens. */
function cityColors(t: Tokens) {
  const night = t.dark;
  const bg = t.background;
  const skyTop = night ? bg.clone() : t.accentSoft.clone().lerp(bg, 0.2);
  const horizon = night ? bg.clone().lerp(t.accent, 0.34) : bg.clone().lerp(t.accentSoft, 0.22);
  const building = night ? bg.clone().lerp(t.ink, 0.035) : bg.clone().lerp(t.ink, 0.32).lerp(t.accentSoft, 0.08);
  return {
    night,
    skyTop,
    horizon,
    fog: night ? bg.clone() : horizon.clone(),
    building,
    ground: night ? bg.clone().lerp(t.ink, 0.03) : bg.clone().lerp(t.ink, 0.16),
    road: night ? bg.clone().lerp(t.ink, 0.06) : bg.clone().lerp(t.ink, 0.5),
    sidewalk: night ? bg.clone().lerp(t.ink, 0.1) : bg.clone().lerp(t.ink, 0.26),
    marking: night ? t.ink.clone().multiplyScalar(0.45) : bg.clone(),
    edgeLine: night ? t.held.clone().multiplyScalar(0.55) : t.held.clone().lerp(bg, 0.2),
    pole: night ? bg.clone().lerp(t.ink, 0.14) : bg.clone().lerp(t.ink, 0.55),
    lamp: t.held.clone().lerp(t.ink, 0.55),
    windowOff: night ? building.clone().multiplyScalar(0.55) : skyTop.clone().lerp(t.ink, 0.5),
    // Lived-in rooms: a dim warm light at night, sky-tinted glass by day.
    windowLived: night ? t.held.clone().lerp(building, 0.72) : skyTop.clone().lerp(t.ink, 0.3),
    vacant: night ? t.vacant.clone() : t.charts[1].clone(),
    held: t.held.clone(),
    flash: night ? t.ink.clone() : bg.clone(),
    glass: night ? bg.clone().lerp(t.ink, 0.12) : skyTop.clone().lerp(t.ink, 0.42),
    tyre: night ? bg.clone() : t.ink.clone().lerp(bg, 0.15),
    carPaint: [...t.charts, t.ink.clone().lerp(bg, night ? 0.25 : 0.05), bg.clone().lerp(t.ink, night ? 0.2 : 0.85)],
    headlight: t.ink.clone(),
    taillight: t.rose.clone(),
    sun: night ? t.ink.clone().lerp(t.accentSoft, 0.15) : t.held.clone().lerp(bg, 0.75),
    star: t.ink.clone(),
    dust: t.ink.clone().lerp(t.accent, 0.5),
    hemiSky: night ? new Color(1, 1, 1).lerp(t.accent, 0.2) : skyTop.clone().lerp(new Color(1, 1, 1), 0.5),
    hemiGround: night ? new Color(0.4, 0.4, 0.4) : bg.clone().lerp(t.ink, 0.3),
  };
}

function buildCity({ renderer, compact, reducedMotion }: BuildContext): SceneParts {
  const gpu = disposer();
  const rand = seeded(20261108);
  const dummy = new Object3D();
  const tmp = new Color();
  const white = new Color(1, 1, 1);

  const scene = new Scene();
  const fog = new Fog(white.clone(), 50, 210);
  scene.fog = fog;
  scene.background = new Color();

  const camera = new PerspectiveCamera(40, 1, 0.5, 700);
  const cameraBase = new Vector3(0, 7, 50);
  const lookBase = new Vector3(4, 9, -10);

  const hemi = new HemisphereLight(white.clone(), white.clone(), 1);
  const sunLight = new DirectionalLight(white.clone(), 1);
  scene.add(hemi, sunLight);

  const glow = gpu.track(glowTexture());

  // Sky: a gradient wall far behind the fog, glowing at the horizon.
  const skyMaterial = gpu.track(
    new ShaderMaterial({
      uniforms: { top: { value: new Color() }, horizon: { value: new Color() } },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      depthWrite: false,
    }),
  );
  const sky = new Mesh(gpu.track(new PlaneGeometry(1800, 380)), skyMaterial);
  sky.position.set(0, 170, -340);
  scene.add(sky);

  // Moon by night, sun by day: the same spot in the sky, upper right above the card.
  const celestial = new Vector3(185, 118, -310);
  const discMaterial = gpu.track(new SpriteMaterial({ transparent: true, depthWrite: false, fog: false }));
  const moonMap = gpu.track(moonTexture());
  const disc = new Sprite(discMaterial);
  disc.position.copy(celestial);
  const haloMaterial = gpu.track(new SpriteMaterial({ map: glow, transparent: true, depthWrite: false, fog: false }));
  const halo = new Sprite(haloMaterial);
  halo.position.copy(celestial).add(new Vector3(0, 0, -1));
  scene.add(halo, disc);
  sunLight.position.copy(celestial).normalize();

  // Ground, road, sidewalks, markings.
  const groundMaterial = gpu.track(new MeshLambertMaterial());
  const ground = new Mesh(gpu.track(new PlaneGeometry(1600, 900)), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -200);
  scene.add(ground);

  const flat = gpu.track(new PlaneGeometry(1, 1));
  const roadMaterial = gpu.track(new MeshLambertMaterial());
  const road = new Mesh(flat, roadMaterial);
  road.rotation.x = -Math.PI / 2;
  road.scale.set(400, ROAD_HALF * 2, 1);
  road.position.set(0, 0.02, ROAD_Z);
  const sidewalkMaterial = gpu.track(new MeshLambertMaterial());
  const farWalk = new Mesh(flat, sidewalkMaterial);
  farWalk.rotation.x = -Math.PI / 2;
  farWalk.scale.set(400, 2.4, 1);
  farWalk.position.set(0, 0.06, ROAD_Z - ROAD_HALF - 1.2);
  const nearWalk = farWalk.clone();
  nearWalk.position.z = ROAD_Z + ROAD_HALF + 1.2;
  scene.add(road, farWalk, nearWalk);

  const markingMaterial = gpu.track(new MeshBasicMaterial());
  const dashCount = 70;
  const dashes = new InstancedMesh(flat, markingMaterial, dashCount);
  for (let i = 0; i < dashCount; i++) {
    dummy.position.set(-210 + i * 6, 0.05, ROAD_Z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(2.4, 0.16, 1);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  }
  const edgeMaterial = gpu.track(new MeshBasicMaterial());
  const edges = new InstancedMesh(flat, edgeMaterial, 2);
  [ROAD_Z - ROAD_HALF + 0.35, ROAD_Z + ROAD_HALF - 0.35].forEach((z, i) => {
    dummy.position.set(0, 0.05, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(400, 0.12, 1);
    dummy.updateMatrix();
    edges.setMatrixAt(i, dummy.matrix);
  });
  scene.add(dashes, edges);

  // Street lamps along the far sidewalk, leaning over the road.
  const lampXs: number[] = [];
  for (let x = -112; x <= 112; x += 16) lampXs.push(x);
  const poleMaterial = gpu.track(new MeshLambertMaterial());
  const box = gpu.track(new BoxGeometry(1, 1, 1));
  const poles = new InstancedMesh(box, poleMaterial, lampXs.length * 2);
  const lampZ = ROAD_Z - ROAD_HALF - 1.4;
  lampXs.forEach((x, i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, 2.9, lampZ);
    dummy.scale.set(0.16, 5.8, 0.16);
    dummy.updateMatrix();
    poles.setMatrixAt(i * 2, dummy.matrix);
    dummy.position.set(x, 5.75, lampZ + 0.8);
    dummy.scale.set(0.14, 0.14, 1.7);
    dummy.updateMatrix();
    poles.setMatrixAt(i * 2 + 1, dummy.matrix);
  });
  scene.add(poles);

  const lampGlowMaterial = gpu.track(
    new SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: AdditiveBlending }),
  );
  const lampGlows = lampXs.map((x) => {
    const sprite = new Sprite(lampGlowMaterial);
    sprite.position.set(x, 5.6, lampZ + 1.55);
    sprite.scale.set(3.2, 3.2, 1);
    scene.add(sprite);
    return sprite;
  });
  // Pools of light: flat glows on the asphalt under each lamp, and ahead of each car.
  const poolMaterial = gpu.track(
    new MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: AdditiveBlending }),
  );
  const lampPools = new InstancedMesh(flat, poolMaterial, lampXs.length);
  lampPools.instanceColor = new InstancedBufferAttribute(new Float32Array(lampXs.length * 3), 3);
  lampXs.forEach((x, i) => {
    dummy.position.set(x, 0.07, lampZ + 3.2);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(9, 7, 1);
    dummy.updateMatrix();
    lampPools.setMatrixAt(i, dummy.matrix);
  });
  scene.add(lampPools);

  // Buildings.
  const buildings = layoutCity(rand, compact);
  const shade = buildings.map(() => 0.88 + rand() * 0.18);
  // By day some towers are warm stone, some cool glass, the rest plain concrete.
  const tint = buildings.map(() => Math.floor(rand() * 3));
  const buildingMaterial = gpu.track(new MeshLambertMaterial({ color: white.clone() }));
  const buildingMesh = new InstancedMesh(box, buildingMaterial, buildings.length);
  buildings.forEach((b, i) => {
    dummy.position.set(b.x, b.h / 2, b.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    buildingMesh.setMatrixAt(i, dummy.matrix);
  });
  buildingMesh.instanceColor = new InstancedBufferAttribute(new Float32Array(buildings.length * 3), 3);
  scene.add(buildingMesh);

  // Windows, one instance per room.
  const slots: WindowSlot[] = [];
  for (const b of buildings) windowsOf(b, slots);
  const count = slots.length;
  const status = new Uint8Array(count);
  const onAt = new Float32Array(count);
  const flash = new Float32Array(count);
  const windowMaterial = gpu.track(new MeshBasicMaterial({ color: white.clone() }));
  const windowMesh = new InstancedMesh(gpu.track(new PlaneGeometry(0.55, 0.78)), windowMaterial, count);
  const windowColors = new InstancedBufferAttribute(new Float32Array(count * 3), 3);
  windowColors.setUsage(DynamicDrawUsage);
  windowMesh.instanceColor = windowColors;

  // Near windows get a glow and are the ones that change, so the motion is where the eye is.
  const near: number[] = [];
  const glowOf = new Int32Array(count).fill(-1);
  slots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    windowMesh.setMatrixAt(i, dummy.matrix);
    const r = rand();
    status[i] = r < 0.3 ? OFF : r < 0.82 ? LIVED : r < 0.94 ? VACANT : HELD;
    // The city lights up from front to back over the first couple of seconds.
    onAt[i] = reducedMotion ? 0 : 0.3 + rand() * 1.4 + s.row * 0.12;
    if (s.row <= 3) {
      glowOf[i] = near.length;
      near.push(i);
    }
  });
  scene.add(windowMesh);

  const glowPositions = new Float32Array(near.length * 3);
  near.forEach((i, g) => {
    const s = slots[i];
    const out = 0.2; // just in front of the pane
    glowPositions[g * 3] = s.x + (s.ry === 0 ? 0 : s.ry > 0 ? out : -out);
    glowPositions[g * 3 + 1] = s.y;
    glowPositions[g * 3 + 2] = s.z + (s.ry === 0 ? out : 0);
  });
  const glowGeometry = gpu.track(new BufferGeometry());
  glowGeometry.setAttribute("position", new BufferAttribute(glowPositions, 3));
  const glowColors = new BufferAttribute(new Float32Array(near.length * 4), 4);
  glowColors.setUsage(DynamicDrawUsage);
  glowGeometry.setAttribute("color", glowColors);
  const glowMaterial = gpu.track(
    new PointsMaterial({ size: 3.4, map: glow, vertexColors: true, transparent: true, depthWrite: false }),
  );
  scene.add(new Points(glowGeometry, glowMaterial));

  // Cars: a body, a glass cabin and four tyres each, with head and tail lights.
  const perLane = compact ? 5 : 9;
  const cars = LANES.flatMap((lane, l) =>
    Array.from({ length: perLane }, (_, k) => ({
      lane,
      x: -CAR_WRAP + ((k + rand() * 0.6) * (CAR_WRAP * 2)) / perLane + l * 7,
      speed: 9 + rand() * 5,
      paint: Math.floor(rand() * 7),
    })),
  );
  const bodyMaterial = gpu.track(new MeshLambertMaterial({ color: white.clone() }));
  const bodies = new InstancedMesh(box, bodyMaterial, cars.length);
  bodies.instanceColor = new InstancedBufferAttribute(new Float32Array(cars.length * 3), 3);
  const cabinMaterial = gpu.track(new MeshLambertMaterial());
  const cabins = new InstancedMesh(box, cabinMaterial, cars.length);
  const tyreMaterial = gpu.track(new MeshLambertMaterial());
  const tyreGeometry = gpu.track(new CylinderGeometry(0.4, 0.4, 0.32, 12));
  const tyres = new InstancedMesh(tyreGeometry, tyreMaterial, cars.length * 4);
  const beams = new InstancedMesh(flat, poolMaterial, cars.length);
  beams.instanceColor = new InstancedBufferAttribute(new Float32Array(cars.length * 3), 3);
  scene.add(bodies, cabins, tyres, beams);

  const lightCount = cars.length * 4; // two head, two tail
  const lightPositions = new Float32Array(lightCount * 3);
  const lightAttr = new BufferAttribute(lightPositions, 3);
  lightAttr.setUsage(DynamicDrawUsage);
  const lightColors = new BufferAttribute(new Float32Array(lightCount * 4), 4);
  const lightGeometry = gpu.track(new BufferGeometry());
  lightGeometry.setAttribute("position", lightAttr);
  lightGeometry.setAttribute("color", lightColors);
  const carLightMaterial = gpu.track(
    new PointsMaterial({ size: 1.5, map: glow, vertexColors: true, transparent: true, depthWrite: false }),
  );
  scene.add(new Points(lightGeometry, carLightMaterial));

  function placeCars() {
    cars.forEach((car, i) => {
      const { dir, z } = car.lane;
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(car.x, 0.85, z);
      dummy.scale.set(4.3, 0.95, 1.95);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.set(car.x - dir * 0.35, 1.62, z);
      dummy.scale.set(2.3, 0.72, 1.75);
      dummy.updateMatrix();
      cabins.setMatrixAt(i, dummy.matrix);
      for (let w = 0; w < 4; w++) {
        dummy.position.set(car.x + (w < 2 ? 1.35 : -1.35), 0.4, z + (w % 2 ? 0.92 : -0.92));
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        tyres.setMatrixAt(i * 4 + w, dummy.matrix);
      }
      // The beam: a pool of light on the asphalt ahead of the car.
      dummy.position.set(car.x + dir * 6.2, 0.06, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(9, 3.4, 1);
      dummy.updateMatrix();
      beams.setMatrixAt(i, dummy.matrix);

      const front = car.x + dir * 2.18;
      const back = car.x - dir * 2.18;
      const base = i * 4;
      lightAttr.setXYZ(base, front, 0.95, z - 0.62);
      lightAttr.setXYZ(base + 1, front, 0.95, z + 0.62);
      lightAttr.setXYZ(base + 2, back, 0.98, z - 0.66);
      lightAttr.setXYZ(base + 3, back, 0.98, z + 0.66);
    });
    bodies.instanceMatrix.needsUpdate = true;
    cabins.instanceMatrix.needsUpdate = true;
    tyres.instanceMatrix.needsUpdate = true;
    beams.instanceMatrix.needsUpdate = true;
    lightAttr.needsUpdate = true;
  }

  // Night sky: stars.
  const starCount = compact ? 180 : 360;
  const starPositions = new Float32Array(starCount * 3);
  const starAlpha = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (rand() - 0.5) * 1400;
    starPositions[i * 3 + 1] = 40 + rand() * 280;
    starPositions[i * 3 + 2] = -330;
    starAlpha[i] = 0.25 + rand() * 0.65;
  }
  const starGeometry = gpu.track(new BufferGeometry());
  starGeometry.setAttribute("position", new BufferAttribute(starPositions, 3));
  const starColors = new BufferAttribute(new Float32Array(starCount * 4), 4);
  starGeometry.setAttribute("color", starColors);
  const starMaterial = gpu.track(
    new PointsMaterial({
      size: 1.6 * renderer.getPixelRatio(),
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  const stars = new Points(starGeometry, starMaterial);
  scene.add(stars);

  // Day sky: soft clouds drifting right.
  const cloudMaterial = gpu.track(new SpriteMaterial({ map: glow, transparent: true, depthWrite: false, fog: false }));
  const clouds = Array.from({ length: compact ? 5 : 8 }, () => {
    const puffs = Array.from({ length: 6 }, () => {
      const puff = new Sprite(cloudMaterial);
      const s = 34 + rand() * 40;
      puff.scale.set(s * 1.6, s, 1);
      scene.add(puff);
      return { sprite: puff, dx: (rand() - 0.5) * 70, dy: (rand() - 0.5) * 12 };
    });
    return { puffs, x: (rand() - 0.5) * 1000, y: 70 + rand() * 120, z: -300 + rand() * 30, speed: 2 + rand() * 3 };
  });
  function placeClouds(dt: number) {
    for (const c of clouds) {
      c.x += c.speed * dt;
      if (c.x > 560) c.x = -560;
      for (const p of c.puffs) p.sprite.position.set(c.x + p.dx, c.y + p.dy, c.z);
    }
  }

  // Dust drifting in front of the city at night, for depth.
  const dustCount = compact ? 60 : 130;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSpeed = new Float32Array(dustCount);
  const dustAlpha = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (rand() - 0.5) * 80;
    dustPositions[i * 3 + 1] = rand() * 30;
    dustPositions[i * 3 + 2] = -18 + rand() * 50;
    dustSpeed[i] = 0.25 + rand() * 0.6;
    dustAlpha[i] = 0.25 + rand() * 0.55;
  }
  const dustGeometry = gpu.track(new BufferGeometry());
  const dustAttr = new BufferAttribute(dustPositions, 3);
  dustAttr.setUsage(DynamicDrawUsage);
  dustGeometry.setAttribute("position", dustAttr);
  const dustColors = new BufferAttribute(new Float32Array(dustCount * 4), 4);
  dustGeometry.setAttribute("color", dustColors);
  const dustMaterial = gpu.track(
    new PointsMaterial({ size: 0.28, map: glow, vertexColors: true, transparent: true, depthWrite: false }),
  );
  const dust = new Points(dustGeometry, dustMaterial);
  scene.add(dust);

  // Set by applyTokens, which the stage calls before the first frame.
  let colors!: ReturnType<typeof cityColors>;
  let elapsed = 0;

  function paintWindow(i: number) {
    if (elapsed < onAt[i]) tmp.copy(colors.windowOff);
    else if (status[i] === VACANT) tmp.copy(colors.vacant);
    else if (status[i] === HELD) tmp.copy(colors.held);
    else if (status[i] === LIVED) tmp.copy(colors.windowLived);
    else tmp.copy(colors.windowOff);
    const f = flash[i];
    if (f > 0) tmp.lerp(colors.flash, f * 0.65);
    windowColors.setXYZ(i, tmp.r, tmp.g, tmp.b);

    const g = glowOf[i];
    if (g < 0) return;
    const lit = elapsed >= onAt[i] && (status[i] === VACANT || status[i] === HELD);
    const alpha = lit ? Math.min(1, (colors.night ? 0.8 : 0.28) * (1 + f * 0.9)) : 0;
    const c = status[i] === HELD ? colors.held : colors.vacant;
    glowColors.setXYZW(g, c.r, c.g, c.b, alpha);
  }

  function paintAllWindows() {
    for (let i = 0; i < count; i++) paintWindow(i);
    windowColors.needsUpdate = true;
    glowColors.needsUpdate = true;
  }

  const glowMaterials: Material[] = [glowMaterial, dustMaterial, carLightMaterial, lampGlowMaterial, poolMaterial];

  function applyTokens(tokens: Tokens) {
    colors = cityColors(tokens);
    const c = colors;
    const night = c.night;

    (scene.background as Color).copy(c.fog);
    fog.color.copy(c.fog);
    fog.near = night ? 50 : 70;
    fog.far = night ? (compact ? 160 : 210) : compact ? 220 : 300;
    skyMaterial.uniforms.top.value.copy(c.skyTop);
    skyMaterial.uniforms.horizon.value.copy(c.horizon);

    hemi.color.copy(c.hemiSky);
    hemi.groundColor.copy(c.hemiGround);
    hemi.intensity = night ? 0.75 : 1.15;
    sunLight.intensity = night ? 0.35 : 1.5;

    groundMaterial.color.copy(c.ground);
    roadMaterial.color.copy(c.road);
    sidewalkMaterial.color.copy(c.sidewalk);
    markingMaterial.color.copy(c.marking);
    edgeMaterial.color.copy(c.edgeLine);
    poleMaterial.color.copy(c.pole);
    cabinMaterial.color.copy(c.glass);
    tyreMaterial.color.copy(c.tyre);

    buildings.forEach((_, i) => {
      tmp.copy(c.building);
      if (!night && tint[i] === 1) tmp.lerp(tokens.held, 0.1);
      if (!night && tint[i] === 2) tmp.lerp(tokens.accentSoft, 0.18);
      buildingMesh.setColorAt(i, tmp.multiplyScalar(shade[i]));
    });
    if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;
    cars.forEach((car, i) => bodies.setColorAt(i, c.carPaint[car.paint % c.carPaint.length]));
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;

    // Light adds up on a dark sky; on a light one it would wash out to white, so blend normally.
    for (const m of glowMaterials) {
      m.blending = night ? AdditiveBlending : NormalBlending;
      m.needsUpdate = true;
    }
    for (const sprite of lampGlows) sprite.visible = night;
    lampGlowMaterial.color.copy(c.lamp);
    lampPools.visible = night;
    beams.visible = night;
    for (let i = 0; i < lampXs.length; i++) lampPools.setColorAt(i, tmp.copy(c.lamp).multiplyScalar(0.3));
    if (lampPools.instanceColor) lampPools.instanceColor.needsUpdate = true;
    for (let i = 0; i < cars.length; i++) beams.setColorAt(i, tmp.copy(c.headlight).multiplyScalar(0.2));
    if (beams.instanceColor) beams.instanceColor.needsUpdate = true;

    for (let i = 0; i < cars.length; i++) {
      const head = night ? 0.95 : 0;
      const tail = night ? 0.9 : 0.35;
      lightColors.setXYZW(i * 4, c.headlight.r, c.headlight.g, c.headlight.b, head);
      lightColors.setXYZW(i * 4 + 1, c.headlight.r, c.headlight.g, c.headlight.b, head);
      lightColors.setXYZW(i * 4 + 2, c.taillight.r, c.taillight.g, c.taillight.b, tail);
      lightColors.setXYZW(i * 4 + 3, c.taillight.r, c.taillight.g, c.taillight.b, tail);
    }
    lightColors.needsUpdate = true;

    // Moon or sun.
    discMaterial.map = night ? moonMap : glow;
    discMaterial.color.copy(c.sun);
    discMaterial.opacity = 1;
    discMaterial.blending = NormalBlending;
    discMaterial.needsUpdate = true;
    disc.scale.setScalar(night ? 20 : 36);
    haloMaterial.color.copy(c.sun);
    haloMaterial.opacity = night ? 0.3 : 0.85;
    halo.scale.setScalar(night ? 120 : 220);

    stars.visible = night;
    for (let i = 0; i < starCount; i++) starColors.setXYZW(i, c.star.r, c.star.g, c.star.b, starAlpha[i]);
    starColors.needsUpdate = true;

    for (const cl of clouds) for (const p of cl.puffs) p.sprite.visible = !night;
    cloudMaterial.color.copy(tokens.background);
    cloudMaterial.opacity = 0.7;

    dust.visible = night;
    for (let i = 0; i < dustCount; i++) dustColors.setXYZW(i, c.dust.r, c.dust.g, c.dust.b, dustAlpha[i]);
    dustColors.needsUpdate = true;

    paintAllWindows();
  }

  function resize(width: number, height: number) {
    camera.aspect = width / height;
    // Portrait screens need a wider lens, and a camera nudged toward the city's centre.
    camera.fov = camera.aspect < 0.9 ? 56 : camera.aspect < 1.4 ? 48 : 40;
    cameraBase.x = camera.aspect < 1.4 ? 5 : 0;
    camera.updateProjectionMatrix();
  }

  const introEnd = onAt.reduce((max, t) => Math.max(max, t), 0) + 0.1;
  let introDone = reducedMotion;
  let nextChange = introEnd + 0.4;
  const flashing = new Set<number>();

  function update(dt: number, time: number, input: StageInput) {
    elapsed = time;
    const sway = reducedMotion ? 0 : 1;
    const { pointer, exit } = input;
    camera.position.set(
      cameraBase.x + Math.sin(time * 0.06) * 3 * sway + pointer.x * 2.2,
      cameraBase.y + Math.sin(time * 0.045) * 0.5 * sway + exit * 8 + pointer.y * 0.8,
      cameraBase.z - exit * 14,
    );
    camera.lookAt(lookBase.x + pointer.x * 1.4, lookBase.y + exit * 6 + pointer.y * 0.7, lookBase.z);

    for (const car of cars) {
      car.x += car.lane.dir * car.speed * dt;
      if (car.x > CAR_WRAP) car.x -= CAR_WRAP * 2;
      if (car.x < -CAR_WRAP) car.x += CAR_WRAP * 2;
    }
    placeCars();
    placeClouds(dt);

    if (!introDone) {
      paintAllWindows();
      if (time >= introEnd) introDone = true;
    } else if (dt > 0) {
      // A room changes hands somewhere every fraction of a second.
      while (time >= nextChange) {
        nextChange += 0.16 + Math.random() * 0.24;
        const i = near[Math.floor(Math.random() * near.length)];
        status[i] = nextStatus(status[i]);
        flash[i] = 1;
        flashing.add(i);
      }
      if (flashing.size) {
        for (const i of flashing) {
          flash[i] = Math.max(0, flash[i] - dt * 1.4);
          paintWindow(i);
          if (flash[i] === 0) flashing.delete(i);
        }
        windowColors.needsUpdate = true;
        glowColors.needsUpdate = true;
      }
    }

    glowMaterial.opacity = 0.85 + Math.sin(time * 1.3) * 0.15;
    if (dust.visible && dt > 0) {
      for (let i = 0; i < dustCount; i++) {
        let y = dustPositions[i * 3 + 1] + dustSpeed[i] * dt;
        if (y > 30) y = 0;
        dustPositions[i * 3 + 1] = y;
        dustPositions[i * 3] += Math.sin(time * 0.4 + i) * dt * 0.15;
      }
      dustAttr.needsUpdate = true;
    }
  }

  placeClouds(0);

  return {
    scene,
    camera,
    applyTokens,
    resize,
    update,
    dispose() {
      for (const mesh of [buildingMesh, windowMesh, dashes, edges, poles, lampPools, bodies, cabins, tyres, beams]) {
        mesh.dispose();
      }
      gpu.dispose();
    },
  };
}
