import * as THREE from 'three';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <div id="hud">
    <div class="topbar">
      <div class="brand">TIDERUN</div>
      <div class="stage" id="stageLabel">RUN 1</div>
    </div>
    <div class="stats">
      <div class="stat"><span>ARMY</span><strong id="armyCount">6</strong></div>
      <div class="stat"><span>FIREPOWER</span><strong id="powerCount">1.0×</strong></div>
    </div>
    <div id="bossWrap">
      <div class="bossHeader"><span>COMMANDER</span><strong id="bossHp">0</strong></div>
      <div class="bossTrack"><div id="bossBar"></div></div>
    </div>
    <div id="choiceHint">DRAG TO PICK A LANE</div>
    <div id="toast"></div>
    <div id="overlay">
      <div id="resultCard">
        <div class="resultKicker" id="resultKicker">RUN COMPLETE</div>
        <h1 id="resultTitle">VICTORY</h1>
        <p id="resultText"></p>
        <button id="restart" type="button">NEXT RUN</button>
      </div>
    </div>
  </div>
`;

const armyEl = document.querySelector<HTMLElement>('#armyCount')!;
const powerEl = document.querySelector<HTMLElement>('#powerCount')!;
const stageEl = document.querySelector<HTMLElement>('#stageLabel')!;
const bossWrapEl = document.querySelector<HTMLElement>('#bossWrap')!;
const bossHpEl = document.querySelector<HTMLElement>('#bossHp')!;
const bossBarEl = document.querySelector<HTMLElement>('#bossBar')!;
const choiceHintEl = document.querySelector<HTMLElement>('#choiceHint')!;
const toastEl = document.querySelector<HTMLElement>('#toast')!;
const overlayEl = document.querySelector<HTMLElement>('#overlay')!;
const resultKickerEl = document.querySelector<HTMLElement>('#resultKicker')!;
const resultTitleEl = document.querySelector<HTMLElement>('#resultTitle')!;
const resultTextEl = document.querySelector<HTMLElement>('#resultText')!;
const restartButton = document.querySelector<HTMLButtonElement>('#restart')!;

const STORAGE_STAGE = 'tiderun-stage-v2';
const stage = Math.max(1, Number.parseInt(localStorage.getItem(STORAGE_STAGE) ?? '1', 10) || 1);
stageEl.textContent = `RUN ${stage}`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x83d9ff);
scene.fog = new THREE.Fog(0x83d9ff, 42, 118);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 420);
camera.position.set(0, 13.5, -16);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x28526f, 2.35));
const sun = new THREE.DirectionalLight(0xfff8df, 3.1);
sun.position.set(-8, 20, -10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -15;
scene.add(sun);

const TRACK_HALF = 6;
const LANE_X = [-3.72, 0, 3.72] as const;
const MAX_RENDER_SOLDIERS = 520;
const MAX_RENDER_ENEMIES = 300;
const FORWARD_SPEED = 5.7;
const STAGE_SCALE = Math.pow(1.18, stage - 1);

const track = new THREE.Mesh(
  new THREE.BoxGeometry(TRACK_HALF * 2, 0.35, 520),
  new THREE.MeshStandardMaterial({ color: 0xd8d3c5, roughness: 0.93 })
);
track.position.set(0, -0.24, 235);
track.receiveShadow = true;
scene.add(track);

const waterMat = new THREE.MeshStandardMaterial({ color: 0x158cc6, roughness: 0.35, metalness: 0.06 });
for (const x of [-20, 20]) {
  const water = new THREE.Mesh(new THREE.BoxGeometry(28, 0.18, 520), waterMat);
  water.position.set(x, -0.38, 235);
  scene.add(water);
}

const borderMat = new THREE.MeshStandardMaterial({ color: 0xf7f1df, roughness: 0.75 });
for (const x of [-TRACK_HALF - 0.15, TRACK_HALF + 0.15]) {
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 520), borderMat);
  border.position.set(x, 0.02, 235);
  scene.add(border);
}

const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
for (let z = 8; z < 480; z += 8) {
  for (const x of [-1.86, 1.86]) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 2.1), dashMat);
    dash.position.set(x, -0.045, z);
    scene.add(dash);
  }
}

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

function seeded(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function makeLabel(text: string, background: string, foreground = '#ffffff', width = 3.1) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, width * 0.37, 1);

  const update = (next: string) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = background;
    roundRect(ctx, 24, 30, 464, 132, 42);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = foreground;
    ctx.font = '900 68px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(next, 256, 96);
    texture.needsUpdate = true;
  };

  update(text);
  return { sprite, update };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; spin: THREE.Vector3 };
const particles: Particle[] = [];
const particleGeo = new THREE.BoxGeometry(0.13, 0.13, 0.13);

function burst(x: number, y: number, z: number, color: number, amount: number, force = 3) {
  const mat = new THREE.MeshBasicMaterial({ color });
  const random = seeded(Math.floor((x + 9) * 101 + z * 17 + performance.now()));
  for (let i = 0; i < amount && particles.length < 260; i++) {
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.set(x + (random() - 0.5) * 0.8, y + random() * 0.5, z + (random() - 0.5) * 0.7);
    const velocity = new THREE.Vector3((random() - 0.5) * force, random() * force + 1.2, (random() - 0.5) * force);
    scene.add(mesh);
    particles.push({ mesh, velocity, life: 0.35 + random() * 0.45, spin: new THREE.Vector3(random() * 5, random() * 5, random() * 5) });
  }
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.velocity.y -= 8.5 * dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.rotation.x += p.spin.x * dt;
    p.mesh.rotation.y += p.spin.y * dt;
    p.mesh.rotation.z += p.spin.z * dt;
    p.mesh.scale.setScalar(Math.max(0.05, p.life * 1.7));
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

const soldierBodyGeo = new THREE.CapsuleGeometry(0.17, 0.37, 3, 6);
const soldierHeadGeo = new THREE.SphereGeometry(0.15, 7, 6);
const soldierBodyMat = new THREE.MeshStandardMaterial({ color: 0x087cff, roughness: 0.52 });
const soldierHeadMat = new THREE.MeshStandardMaterial({ color: 0xb9e2ff, roughness: 0.42 });
const soldierBodies = new THREE.InstancedMesh(soldierBodyGeo, soldierBodyMat, MAX_RENDER_SOLDIERS);
const soldierHeads = new THREE.InstancedMesh(soldierHeadGeo, soldierHeadMat, MAX_RENDER_SOLDIERS);
soldierBodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
soldierHeads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
soldierBodies.castShadow = true;
soldierHeads.castShadow = true;
scene.add(soldierBodies, soldierHeads);

let army = 6 + Math.floor((stage - 1) * 1.4);
let damageMultiplier = 1;
let fireRateMultiplier = 1;
let pierce = 0;
let squadX = 0;
let targetX = 0;
let squadZ = 0;
let running = true;
let won = false;
let shootTimer = 0;
let cameraShake = 0;
let pointerDown = false;
let pointerStartX = 0;
let pointerStartTarget = 0;
let toastTimer = 0;

function displayedPower() {
  return damageMultiplier * fireRateMultiplier * (1 + pierce * 0.18);
}

function syncHud() {
  armyEl.textContent = Math.max(0, Math.floor(army)).toLocaleString();
  powerEl.textContent = `${displayedPower().toFixed(1)}×`;
}

function setArmy(value: number) {
  army = Math.max(0, Math.floor(value));
  syncHud();
  if (army <= 0 && running) finish(false, 'Your squad was wiped out before the commander.');
}

function toast(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimer = 1.25;
}

function updateSoldiers(time: number) {
  const renderCount = Math.min(MAX_RENDER_SOLDIERS, army);
  soldierBodies.count = renderCount;
  soldierHeads.count = renderCount;
  const columns = Math.max(2, Math.min(22, Math.ceil(Math.sqrt(Math.max(renderCount, 1) * 1.55))));
  const spacingX = Math.min(0.42, 7.4 / Math.max(columns, 1));
  const spacingZ = 0.43;

  for (let i = 0; i < renderCount; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const rowCount = Math.min(columns, renderCount - row * columns);
    const seed = ((i * 9301 + 49297) % 233280) / 233280;
    const x = squadX + (col - (rowCount - 1) / 2) * spacingX + (seed - 0.5) * 0.06;
    const z = squadZ - row * spacingZ + Math.sin(time * 8 + i * 0.71) * 0.025;
    const bob = Math.sin(time * 10 + i * 0.83) * 0.035;

    dummy.position.set(x, 0.47 + bob, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    soldierBodies.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, 0.91 + bob, z + 0.015);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    soldierHeads.setMatrixAt(i, dummy.matrix);
  }
  soldierBodies.instanceMatrix.needsUpdate = true;
  soldierHeads.instanceMatrix.needsUpdate = true;
}

type RewardKind = 'troops' | 'damage' | 'rate' | 'pierce' | 'multiply';

type RewardSpec = {
  kind: RewardKind;
  value: number;
  label: string;
  color: number;
  bg: string;
};

class Barrier {
  readonly x: number;
  readonly z: number;
  readonly width = 2.95;
  readonly maxHealth: number;
  health: number;
  destroyed = false;
  group = new THREE.Group();
  label: ReturnType<typeof makeLabel>;
  wallMat: THREE.MeshStandardMaterial;

  constructor(x: number, z: number, health: number, hard = false) {
    this.x = x;
    this.z = z;
    this.maxHealth = Math.max(1, Math.floor(health));
    this.health = this.maxHealth;
    this.wallMat = new THREE.MeshStandardMaterial({
      color: hard ? 0x343744 : 0x4b5260,
      roughness: 0.55,
      metalness: 0.42,
      emissive: 0x000000
    });

    for (let i = 0; i < 4; i++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.42, 0.34), this.wallMat);
      slab.position.set((i - 1.5) * 0.7, 0.7, 0);
      slab.castShadow = true;
      slab.receiveShadow = true;
      this.group.add(slab);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.22, 0.46), this.wallMat);
    top.position.y = 1.42;
    top.castShadow = true;
    this.group.add(top);
    this.group.position.set(x, 0, z);
    scene.add(this.group);

    this.label = makeLabel(String(this.health), hard ? 'rgba(87,28,31,.95)' : 'rgba(21,27,37,.95)');
    this.label.sprite.position.set(x, 2.25, z - 0.28);
    scene.add(this.label.sprite);
  }

  hit(amount: number) {
    if (this.destroyed) return;
    const dealt = Math.max(1, Math.floor(amount));
    this.health = Math.max(0, this.health - dealt);
    this.label.update(String(this.health));
    const ratio = this.health / this.maxHealth;
    tmpColor.setHex(0x4b5260).lerp(new THREE.Color(0xff594f), 1 - ratio);
    this.wallMat.color.copy(tmpColor);
    this.wallMat.emissive.setHex(0x38100d);
    this.wallMat.emissiveIntensity = Math.min(0.45, (1 - ratio) * 0.6);
    if (this.health <= 0) this.breakApart();
  }

  breakApart() {
    if (this.destroyed) return;
    this.destroyed = true;
    scene.remove(this.group, this.label.sprite);
    burst(this.x, 0.8, this.z, 0x697180, 14, 4.8);
    cameraShake = Math.max(cameraShake, 0.14);
  }

  collide() {
    if (this.destroyed) return;
    const remaining = this.health / this.maxHealth;
    const loss = Math.max(1, Math.ceil(army * (0.08 + remaining * 0.34)));
    setArmy(army - loss);
    toast(`WALL HIT  −${loss}`);
    burst(this.x, 0.7, this.z, 0xff664f, 18, 5.5);
    cameraShake = Math.max(cameraShake, 0.28);
    this.breakApart();
  }

  hide() {
    if (this.destroyed) return;
    this.destroyed = true;
    scene.remove(this.group, this.label.sprite);
  }
}

class RewardGate {
  readonly x: number;
  readonly z: number;
  readonly reward: RewardSpec;
  used = false;
  group = new THREE.Group();
  label: ReturnType<typeof makeLabel>;

  constructor(x: number, z: number, reward: RewardSpec) {
    this.x = x;
    this.z = z;
    this.reward = reward;
    const mat = new THREE.MeshStandardMaterial({ color: reward.color, emissive: reward.color, emissiveIntensity: 0.22, roughness: 0.34 });
    const paneMat = new THREE.MeshBasicMaterial({ color: reward.color, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.3, 0.13), mat);
    const right = left.clone();
    left.position.x = -1.36;
    right.position.x = 1.36;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.13, 0.13), mat);
    top.position.y = 1.12;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 2.08), paneMat);
    pane.position.y = 0.03;
    pane.rotation.y = Math.PI;
    this.group.add(left, right, top, pane);
    this.group.position.set(x, 1.12, z);
    scene.add(this.group);

    this.label = makeLabel(reward.label, reward.bg, '#ffffff', 2.85);
    this.label.sprite.position.set(x, 3.05, z - 0.08);
    scene.add(this.label.sprite);
  }

  apply() {
    if (this.used) return;
    this.used = true;
    switch (this.reward.kind) {
      case 'troops':
        setArmy(army + this.reward.value);
        toast(`+${Math.floor(this.reward.value)} TROOPS`);
        break;
      case 'multiply':
        setArmy(army * this.reward.value);
        toast(`ARMY ×${this.reward.value}`);
        break;
      case 'damage':
        damageMultiplier *= this.reward.value;
        syncHud();
        toast(`DAMAGE +${Math.round((this.reward.value - 1) * 100)}%`);
        break;
      case 'rate':
        fireRateMultiplier *= this.reward.value;
        syncHud();
        toast(`FIRE RATE +${Math.round((this.reward.value - 1) * 100)}%`);
        break;
      case 'pierce':
        pierce += Math.floor(this.reward.value);
        syncHud();
        toast(`PIERCE +${Math.floor(this.reward.value)}`);
        break;
    }
    burst(this.x, 1.1, this.z, this.reward.color, 18, 3.8);
    this.hide();
  }

  hide() {
    if (!this.group.parent && !this.label.sprite.parent) return;
    scene.remove(this.group, this.label.sprite);
  }
}

class ChoiceRow {
  readonly z: number;
  readonly barriers: Barrier[];
  readonly gates: RewardGate[];
  resolved = false;
  collided = new Set<number>();

  constructor(z: number, barrierHealth: number[], rewards: RewardSpec[]) {
    this.z = z;
    this.barriers = LANE_X.map((x, i) => new Barrier(x, z, barrierHealth[i], i === 2));
    this.gates = LANE_X.map((x, i) => new RewardGate(x, z + 3.6, rewards[i]));
  }

  update() {
    if (this.resolved) return;
    if (squadZ >= this.z - 0.18 && squadZ <= this.z + 0.7) {
      const lane = nearestLane(squadX);
      if (!this.collided.has(lane) && Math.abs(squadX - LANE_X[lane]) < 1.55) {
        this.collided.add(lane);
        this.barriers[lane].collide();
      }
    }

    if (squadZ >= this.z + 3.55) {
      const lane = nearestLane(squadX);
      this.gates[lane].apply();
      this.resolved = true;
      this.barriers.forEach((barrier, i) => {
        if (i !== lane) barrier.hide();
      });
      this.gates.forEach((gate, i) => {
        if (i !== lane) gate.hide();
      });
    }
  }
}

class EnemyHorde {
  x = 0;
  z: number;
  count: number;
  dead = false;
  readonly width: number;
  readonly speed: number;
  readonly body: THREE.InstancedMesh;
  readonly head: THREE.InstancedMesh;
  readonly label: ReturnType<typeof makeLabel>;
  contactAccumulator = 0;

  constructor(z: number, count: number, width = 8.8, speed = 1.15) {
    this.z = z;
    this.count = Math.max(1, Math.floor(count));
    this.width = width;
    this.speed = speed;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef334d, roughness: 0.5 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x6f101f, roughness: 0.46 });
    this.body = new THREE.InstancedMesh(soldierBodyGeo, bodyMat, MAX_RENDER_ENEMIES);
    this.head = new THREE.InstancedMesh(soldierHeadGeo, headMat, MAX_RENDER_ENEMIES);
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.head.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.castShadow = true;
    this.head.castShadow = true;
    scene.add(this.body, this.head);

    this.label = makeLabel(this.count.toLocaleString(), 'rgba(173,24,46,.94)');
    scene.add(this.label.sprite);
    this.refresh(0);
  }

  refresh(time: number) {
    const renderCount = Math.min(MAX_RENDER_ENEMIES, this.count);
    this.body.count = renderCount;
    this.head.count = renderCount;
    const columns = Math.max(5, Math.min(24, Math.ceil(Math.sqrt(renderCount * 1.9))));
    const spacingX = Math.min(0.43, this.width / Math.max(columns, 1));
    const spacingZ = 0.42;
    for (let i = 0; i < renderCount; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const rowCount = Math.min(columns, renderCount - row * columns);
      const j = ((i * 37) % 101) / 101;
      const x = this.x + (col - (rowCount - 1) / 2) * spacingX + (j - 0.5) * 0.08;
      const z = this.z + row * spacingZ + Math.sin(time * 8.5 + i * 0.45) * 0.018;
      const bob = Math.sin(time * 10 + i * 0.67) * 0.025;
      dummy.position.set(x, 0.47 + bob, z);
      dummy.rotation.set(0, Math.PI, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.body.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 0.91 + bob, z - 0.015);
      dummy.updateMatrix();
      this.head.setMatrixAt(i, dummy.matrix);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.label.update(this.count.toLocaleString());
    this.label.sprite.position.set(this.x, 3.0, this.z + 0.8);
  }

  hit(amount: number) {
    if (this.dead) return;
    const dealt = Math.max(1, Math.floor(amount));
    this.count = Math.max(0, this.count - dealt);
    if (this.count <= 0) this.destroy();
  }

  update(dt: number, time: number) {
    if (this.dead) return;
    const gap = this.z - squadZ;
    if (gap < 23 && gap > 1.35) {
      this.z -= this.speed * dt;
    }
    if (gap <= 1.55) {
      this.contactAccumulator += dt * Math.max(7, Math.min(45, this.count * 0.28));
      const losses = Math.floor(this.contactAccumulator);
      if (losses > 0) {
        this.contactAccumulator -= losses;
        const actual = Math.min(losses, army, this.count);
        this.count -= actual;
        setArmy(army - actual);
        cameraShake = Math.max(cameraShake, 0.08);
        if (this.count <= 0) this.destroy();
      }
    }
    this.refresh(time);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    burst(this.x, 0.75, this.z, 0xef334d, 28, 5.2);
    scene.remove(this.body, this.head, this.label.sprite);
  }
}

class Commander {
  z: number;
  x = 0;
  readonly maxHealth: number;
  health: number;
  dead = false;
  group = new THREE.Group();
  attackTimer = 0;

  constructor(z: number, health: number) {
    this.z = z;
    this.maxHealth = Math.floor(health);
    this.health = this.maxHealth;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x771f34, roughness: 0.36, metalness: 0.22 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x222a38, roughness: 0.36, metalness: 0.62 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 1.75, 6, 12), bodyMat);
    body.position.y = 1.45;
    body.castShadow = true;
    const armor = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.72, 0.88), armorMat);
    armor.position.set(0, 1.75, -0.05);
    armor.castShadow = true;
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 2.1, 10), armorMat);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 2.3, -0.92);
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.38), new THREE.MeshStandardMaterial({ color: 0xff4e4e, emissive: 0xff1818, emissiveIntensity: 1.4 }));
    beacon.position.set(0, 3.1, 0);
    this.group.add(body, armor, cannon, beacon);
    this.group.position.set(0, 0, z);
    scene.add(this.group);

    bossHpEl.textContent = this.health.toLocaleString();
  }

  hit(amount: number) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - Math.max(1, Math.floor(amount)));
    bossHpEl.textContent = this.health.toLocaleString();
    bossBarEl.style.width = `${(this.health / this.maxHealth) * 100}%`;
    if (this.health <= 0) {
      this.dead = true;
      burst(this.x, 1.5, this.z, 0xff4d4d, 46, 7.2);
      scene.remove(this.group);
      finish(true, `${army.toLocaleString()} troops survived Run ${stage}.`);
    }
  }

  update(dt: number, time: number) {
    if (this.dead) return;
    const gap = this.z - squadZ;
    if (gap < 38) bossWrapEl.classList.add('show');
    if (gap < 26 && gap > 2.2) {
      this.z -= 0.86 * dt;
      this.group.position.z = this.z;
      this.group.rotation.y = Math.sin(time * 1.8) * 0.08;
    }
    if (gap <= 2.4) {
      this.attackTimer += dt * (8.5 + stage * 0.4);
      const loss = Math.floor(this.attackTimer);
      if (loss > 0) {
        this.attackTimer -= loss;
        setArmy(army - loss);
        cameraShake = Math.max(cameraShake, 0.12);
      }
    }
  }
}

type Bullet = { mesh: THREE.Mesh; x: number; z: number; damage: number; pierceLeft: number };
const bullets: Bullet[] = [];
const bulletGeo = new THREE.BoxGeometry(0.07, 0.07, 0.64);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffee74 });

function fireVolley() {
  if (!running || army <= 0) return;
  const shots = Math.min(18, Math.max(1, Math.ceil(Math.sqrt(army) / 1.55)));
  const unitWeight = Math.max(1, army / Math.max(shots, 1));
  const shotDamage = Math.max(1, Math.round(unitWeight * 0.28 * damageMultiplier));
  const formationWidth = Math.min(7.5, 0.48 * (shots - 1));
  for (let i = 0; i < shots && bullets.length < 180; i++) {
    const t = shots === 1 ? 0.5 : i / (shots - 1);
    const x = squadX - formationWidth / 2 + formationWidth * t;
    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    mesh.position.set(x, 0.78, squadZ + 0.9);
    scene.add(mesh);
    bullets.push({ mesh, x, z: squadZ + 0.9, damage: shotDamage, pierceLeft: pierce });
  }
}

function consumeBullet(index: number) {
  scene.remove(bullets[index].mesh);
  bullets.splice(index, 1);
}

function updateBullets(dt: number) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const previousZ = bullet.z;
    bullet.z += 28.5 * dt;
    bullet.mesh.position.z = bullet.z;
    let hit = false;

    for (const row of rows) {
      for (const barrier of row.barriers) {
        if (barrier.destroyed || Math.abs(bullet.x - barrier.x) > barrier.width / 2) continue;
        if (previousZ <= barrier.z + 0.28 && bullet.z >= barrier.z - 0.28) {
          barrier.hit(bullet.damage);
          hit = true;
          break;
        }
      }
      if (hit) break;
    }

    if (!hit) {
      for (const horde of hordes) {
        if (horde.dead || Math.abs(bullet.x - horde.x) > horde.width / 2) continue;
        if (previousZ <= horde.z + 3.8 && bullet.z >= horde.z - 0.55) {
          horde.hit(bullet.damage);
          hit = true;
          break;
        }
      }
    }

    if (!hit && !commander.dead && Math.abs(bullet.x - commander.x) < 1.55 && previousZ <= commander.z + 1.3 && bullet.z >= commander.z - 1.25) {
      commander.hit(bullet.damage);
      hit = true;
    }

    if (hit) {
      if (bullet.pierceLeft > 0) bullet.pierceLeft -= 1;
      else {
        consumeBullet(i);
        continue;
      }
    }

    if (bullet.z > squadZ + 58) consumeBullet(i);
  }
}

function nearestLane(x: number) {
  let best = 0;
  let distance = Infinity;
  for (let i = 0; i < LANE_X.length; i++) {
    const d = Math.abs(x - LANE_X[i]);
    if (d < distance) {
      distance = d;
      best = i;
    }
  }
  return best;
}

function troops(value: number): RewardSpec {
  return { kind: 'troops', value, label: `+${Math.floor(value)}`, color: 0x159bff, bg: 'rgba(0,111,205,.95)' };
}
function damage(value: number): RewardSpec {
  return { kind: 'damage', value, label: `DMG +${Math.round((value - 1) * 100)}%`, color: 0xff873d, bg: 'rgba(203,91,12,.96)' };
}
function rate(value: number): RewardSpec {
  return { kind: 'rate', value, label: `RATE +${Math.round((value - 1) * 100)}%`, color: 0xa55cff, bg: 'rgba(99,40,190,.96)' };
}
function piercing(value: number): RewardSpec {
  return { kind: 'pierce', value, label: `PIERCE +${Math.floor(value)}`, color: 0x20c997, bg: 'rgba(4,136,105,.96)' };
}
function multiply(value: number): RewardSpec {
  return { kind: 'multiply', value, label: `×${value}`, color: 0xffc928, bg: 'rgba(192,132,0,.97)' };
}

const rows: ChoiceRow[] = [];
const hordes: EnemyHorde[] = [];
const rowCount = Math.min(8, 5 + Math.floor((stage - 1) / 3));
let expectedArmy = 6 + (stage - 1) * 1.4;
let expectedWeapon = 1;

for (let i = 0; i < rowCount; i++) {
  const z = 32 + i * 41;
  const baseWall = Math.round((17 + i * 15) * STAGE_SCALE * (0.92 + expectedWeapon * 0.08));
  const safeTroops = Math.max(4, Math.round(4 + expectedArmy * 0.18));
  const jackpot = Math.max(15, Math.round(15 + expectedArmy * 0.62));
  const mediumTroops = Math.max(8, Math.round(8 + expectedArmy * 0.3));

  let rewards: RewardSpec[];
  if (i % 4 === 0) rewards = [troops(safeTroops), damage(1.28), troops(jackpot)];
  else if (i % 4 === 1) rewards = [troops(safeTroops), rate(1.25), i > 2 ? multiply(2) : troops(jackpot)];
  else if (i % 4 === 2) rewards = [troops(mediumTroops), piercing(1), troops(jackpot + Math.round(expectedArmy * 0.2))];
  else rewards = [damage(1.18), troops(mediumTroops), multiply(2)];

  const walls = [
    Math.max(6, Math.round(baseWall * 0.62)),
    Math.max(10, Math.round(baseWall * 1.02)),
    Math.max(18, Math.round(baseWall * 2.15))
  ];
  rows.push(new ChoiceRow(z, walls, rewards));

  const expectedPick = i % 3 === 1 ? rewards[1] : rewards[0];
  if (expectedPick.kind === 'troops') expectedArmy += expectedPick.value;
  if (expectedPick.kind === 'multiply') expectedArmy *= expectedPick.value;
  if (expectedPick.kind === 'damage' || expectedPick.kind === 'rate') expectedWeapon *= expectedPick.value;
  if (expectedPick.kind === 'pierce') expectedWeapon *= 1.12;

  const enemyCount = Math.max(9, Math.round((10 + i * 8 + expectedArmy * 0.34) * Math.pow(STAGE_SCALE, 0.55)));
  hordes.push(new EnemyHorde(z + 21, enemyCount, 8.7 + Math.min(1.2, i * 0.16), 1.0 + i * 0.07));
}

const bossZ = 32 + rowCount * 41 + 8;
const bossHealth = Math.round((180 + expectedArmy * 3.6 + expectedWeapon * 105) * Math.pow(STAGE_SCALE, 0.62));
const commander = new Commander(bossZ, bossHealth);
const RUN_END_Z = bossZ + 12;

function finish(success: boolean, text: string) {
  if (!running) return;
  running = false;
  won = success;
  resultKickerEl.textContent = success ? `RUN ${stage} COMPLETE` : `RUN ${stage} FAILED`;
  resultTitleEl.textContent = success ? 'HOLD THE LINE' : 'SQUAD LOST';
  resultTextEl.textContent = text;
  restartButton.textContent = success ? 'NEXT RUN' : 'RETRY';
  overlayEl.classList.add('show');
  choiceHintEl.classList.add('hidden');
}

function updateCamera(dt: number) {
  const shake = cameraShake > 0 ? cameraShake : 0;
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake * 0.45;
  const targetCameraX = squadX * 0.26;
  const targetCameraZ = squadZ - 16.5;
  camera.position.x += (targetCameraX - camera.position.x) * Math.min(1, dt * 6.5);
  camera.position.z += (targetCameraZ - camera.position.z) * Math.min(1, dt * 7.5);
  camera.position.y += (13.4 - camera.position.y) * Math.min(1, dt * 5);
  camera.position.x += sx;
  camera.position.y += sy;
  camera.lookAt(squadX * 0.18, 0.55, squadZ + 15.5);
  cameraShake = Math.max(0, cameraShake - dt * 1.9);
}

renderer.domElement.addEventListener('pointerdown', (event: PointerEvent) => {
  pointerDown = true;
  pointerStartX = event.clientX;
  pointerStartTarget = targetX;
  renderer.domElement.setPointerCapture(event.pointerId);
  choiceHintEl.classList.add('hidden');
});

renderer.domElement.addEventListener('pointermove', (event: PointerEvent) => {
  if (!pointerDown || !running) return;
  const delta = (event.clientX - pointerStartX) / Math.max(280, window.innerWidth);
  targetX = THREE.MathUtils.clamp(pointerStartTarget + delta * 11.5, -4.55, 4.55);
});

function releasePointer(event: PointerEvent) {
  pointerDown = false;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
}
renderer.domElement.addEventListener('pointerup', releasePointer);
renderer.domElement.addEventListener('pointercancel', releasePointer);

restartButton.addEventListener('click', () => {
  if (won) localStorage.setItem(STORAGE_STAGE, String(stage + 1));
  window.location.reload();
});

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

let previous = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  const time = now / 1000;

  if (running) {
    squadX += (targetX - squadX) * Math.min(1, dt * 12.5);
    squadZ += FORWARD_SPEED * dt;

    shootTimer -= dt;
    if (shootTimer <= 0) {
      fireVolley();
      shootTimer = Math.max(0.075, 0.23 / fireRateMultiplier);
    }

    updateBullets(dt);
    for (const row of rows) row.update();
    for (const horde of hordes) horde.update(dt, time);
    commander.update(dt, time);

    if (squadZ > RUN_END_Z && !commander.dead) finish(false, 'The commander was still standing when the runway ended.');

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.remove('show');
    }
  }

  updateParticles(dt);
  updateSoldiers(time);
  updateCamera(dt);
  renderer.render(scene, camera);
}

syncHud();
updateSoldiers(0);
requestAnimationFrame(frame);
