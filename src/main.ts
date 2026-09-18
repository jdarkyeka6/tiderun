import * as THREE from 'three';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <div id="hud">
    <div class="hud-top">
      <div class="battle-pill" id="levelLabel">BATTLE 1</div>
      <div class="phase-pill" id="phaseBadge">BREAK A LANE</div>
    </div>

    <div class="hud-stats">
      <div class="hud-stat">
        <span>ARMY</span>
        <strong id="armyCount">8</strong>
      </div>
      <div class="hud-stat">
        <span>POWER</span>
        <strong id="powerCount">1.0×</strong>
      </div>
    </div>

    <div id="bossWrap">
      <div class="boss-line">
        <span>COMMANDER</span>
        <strong id="bossHp">0</strong>
      </div>
      <div class="boss-track"><div id="bossBar"></div></div>
    </div>

    <div id="hint">DRAG LEFT / RIGHT · SHOOT A LANE OPEN</div>
    <div id="toast"></div>

    <div id="overlay">
      <div id="resultCard">
        <div id="resultKicker">BATTLE COMPLETE</div>
        <h1 id="resultTitle">VICTORY</h1>
        <p id="resultText"></p>
        <button id="restart" type="button">NEXT BATTLE</button>
      </div>
    </div>
  </div>
`;

const armyEl = document.querySelector<HTMLElement>('#armyCount')!;
const powerEl = document.querySelector<HTMLElement>('#powerCount')!;
const levelEl = document.querySelector<HTMLElement>('#levelLabel')!;
const phaseEl = document.querySelector<HTMLElement>('#phaseBadge')!;
const bossWrapEl = document.querySelector<HTMLElement>('#bossWrap')!;
const bossHpEl = document.querySelector<HTMLElement>('#bossHp')!;
const bossBarEl = document.querySelector<HTMLElement>('#bossBar')!;
const hintEl = document.querySelector<HTMLElement>('#hint')!;
const toastEl = document.querySelector<HTMLElement>('#toast')!;
const overlayEl = document.querySelector<HTMLElement>('#overlay')!;
const resultKickerEl = document.querySelector<HTMLElement>('#resultKicker')!;
const resultTitleEl = document.querySelector<HTMLElement>('#resultTitle')!;
const resultTextEl = document.querySelector<HTMLElement>('#resultText')!;
const restartButton = document.querySelector<HTMLButtonElement>('#restart')!;

const STORAGE_LEVEL = 'tiderun-battle-v4';
const level = Math.max(1, Number.parseInt(localStorage.getItem(STORAGE_LEVEL) ?? '1', 10) || 1);
levelEl.textContent = `BATTLE ${level}`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x89d9ff);
scene.fog = new THREE.Fog(0x89d9ff, 44, 92);

const camera = new THREE.PerspectiveCamera(49, window.innerWidth / window.innerHeight, 0.1, 180);
const CAMERA_BASE = new THREE.Vector3(0, 15.2, -13.8);
camera.position.copy(CAMERA_BASE);
camera.lookAt(0, 0.75, 12);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x35586d, 2.65));

const sun = new THREE.DirectionalLight(0xfff6df, 2.2);
sun.position.set(-7, 18, -5);
scene.add(sun);

const FIELD_HALF = 8;
const PLAYER_Z = 1.4;
const WALL_Z = 17;
const GATE_Z = 21;
const ENEMY_START_Z = 33;
const CONTACT_Z = 3.1;
const LANE_X = [-4.35, 0, 4.35] as const;
const MAX_BLUE = 360;
const MAX_RED = 260;
const LEVEL_SCALE = Math.pow(1.14, level - 1);

const field = new THREE.Mesh(
  new THREE.BoxGeometry(FIELD_HALF * 2, 0.3, 115),
  new THREE.MeshStandardMaterial({ color: 0xd3cbb8, roughness: 0.96 })
);
field.position.set(0, -0.22, 43);
scene.add(field);

const seaMaterial = new THREE.MeshStandardMaterial({
  color: 0x1785b7,
  roughness: 0.45
});
for (const x of [-21, 21]) {
  const sea = new THREE.Mesh(new THREE.BoxGeometry(26, 0.16, 115), seaMaterial);
  sea.position.set(x, -0.36, 43);
  scene.add(sea);
}

const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.88 });
for (const x of [-FIELD_HALF - 0.16, FIELD_HALF + 0.16]) {
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.23, 115), edgeMaterial);
  edge.position.set(x, -0.01, 43);
  scene.add(edge);
}

const laneMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.34,
  roughness: 0.9
});
for (let z = 4; z < 92; z += 7) {
  for (const x of [-2.18, 2.18]) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 1.5), laneMaterial);
    mark.position.set(x, -0.055, z);
    scene.add(mark);
  }
}

const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x765a3c, roughness: 0.9 });
for (let i = 0; i < 14; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.64, 0.72), crateMaterial);
  crate.position.set(side * (7.1 + (i % 3) * 0.2), 0.31, 7 + i * 6.6);
  crate.rotation.y = i * 0.31;
  scene.add(crate);
}

const dummy = new THREE.Object3D();
const tempColor = new THREE.Color();

function seeded(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeLabel(initial: string, background: string, foreground = '#ffffff', width = 3) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    })
  );
  sprite.scale.set(width, width * 0.37, 1);

  const update = (text: string) => {
    ctx.clearRect(0, 0, 512, 192);
    ctx.fillStyle = background;
    roundRect(ctx, 22, 29, 468, 134, 40);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = foreground;
    ctx.font = '900 67px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 96);
    texture.needsUpdate = true;
  };

  update(initial);
  return { sprite, update };
}

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
};

const particles: Particle[] = [];
const particleGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);

function burst(x: number, y: number, z: number, color: number, count: number, force = 4) {
  const material = new THREE.MeshBasicMaterial({ color });
  const random = seeded(Math.floor((x + 10) * 137 + z * 31 + performance.now()));

  for (let i = 0; i < count && particles.length < 120; i++) {
    const mesh = new THREE.Mesh(particleGeometry, material);
    mesh.position.set(
      x + (random() - 0.5) * 0.9,
      y + random() * 0.5,
      z + (random() - 0.5) * 0.7
    );
    scene.add(mesh);

    particles.push({
      mesh,
      velocity: new THREE.Vector3(
        (random() - 0.5) * force,
        1.1 + random() * force,
        (random() - 0.5) * force
      ),
      life: 0.3 + random() * 0.38
    });
  }
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.velocity.y -= 8 * dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.rotation.x += 5 * dt;
    p.mesh.rotation.y += 6 * dt;
    p.mesh.scale.setScalar(Math.max(0.03, p.life * 1.8));

    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

const bodyGeometry = new THREE.CapsuleGeometry(0.17, 0.38, 3, 6);
const headGeometry = new THREE.SphereGeometry(0.15, 7, 6);

const blueGroup = new THREE.Group();
blueGroup.position.set(0, 0, PLAYER_Z);
scene.add(blueGroup);

const blueBodies = new THREE.InstancedMesh(
  bodyGeometry,
  new THREE.MeshStandardMaterial({ color: 0x087cff, roughness: 0.5 }),
  MAX_BLUE
);
const blueHeads = new THREE.InstancedMesh(
  headGeometry,
  new THREE.MeshStandardMaterial({ color: 0xc9ebff, roughness: 0.42 }),
  MAX_BLUE
);
blueBodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
blueHeads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
blueGroup.add(blueBodies, blueHeads);

let army = 8 + Math.floor((level - 1) * 1.2);
let damageMultiplier = 1;
let fireRateMultiplier = 1;
let pierce = 0;
let squadX = 0;
let targetX = 0;
let pointerDown = false;
let pointerStartX = 0;
let pointerStartTargetX = 0;
let shootTimer = 0;
let toastTimer = 0;
let cameraShake = 0;
let running = true;
let won = false;
let firstInput = true;
let laneArmed = false;

type Phase = 'choice' | 'battle' | 'boss' | 'finished';
let phase: Phase = 'choice';

function displayedPower() {
  return damageMultiplier * fireRateMultiplier * (1 + pierce * 0.18);
}

function syncHud() {
  armyEl.textContent = Math.max(0, Math.floor(army)).toLocaleString();
  powerEl.textContent = `${displayedPower().toFixed(1)}×`;
}

function rebuildBlueFormation() {
  const visibleCount = Math.min(MAX_BLUE, army);
  blueBodies.count = visibleCount;
  blueHeads.count = visibleCount;

  const columns = Math.max(
    4,
    Math.min(28, Math.ceil(Math.sqrt(Math.max(visibleCount, 1) * 2.25)))
  );
  const spacingX = Math.min(0.36, 10.5 / columns);
  const spacingZ = 0.34;

  for (let i = 0; i < visibleCount; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const rowCount = Math.min(columns, visibleCount - row * columns);
    const noise = ((i * 83) % 97) / 97;
    const x = (col - (rowCount - 1) / 2) * spacingX + (noise - 0.5) * 0.045;
    const z = -row * spacingZ;

    dummy.position.set(x, 0.47, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    blueBodies.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, 0.91, z + 0.01);
    dummy.updateMatrix();
    blueHeads.setMatrixAt(i, dummy.matrix);
  }

  blueBodies.instanceMatrix.needsUpdate = true;
  blueHeads.instanceMatrix.needsUpdate = true;
}

function setArmy(next: number) {
  army = Math.max(0, Math.floor(next));
  syncHud();
  rebuildBlueFormation();

  if (army <= 0 && running) {
    finish(false, 'The enemy line overwhelmed your squad.');
  }
}

function setPhase(next: Phase) {
  phase = next;
  phaseEl.textContent =
    next === 'choice' ? 'BREAK A LANE' :
    next === 'battle' ? 'ENEMY ATTACK' :
    next === 'boss' ? 'COMMANDER' :
    '';
  phaseEl.classList.toggle('danger', next === 'battle' || next === 'boss');
}

function toast(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimer = 1.05;
}

type RewardKind = 'troops' | 'damage' | 'rate' | 'pierce' | 'multiply';

type Reward = {
  kind: RewardKind;
  value: number;
  label: string;
  color: number;
  bg: string;
};

function troopReward(value: number): Reward {
  return {
    kind: 'troops',
    value,
    label: `+${Math.floor(value)}`,
    color: 0x159bff,
    bg: 'rgba(0,105,204,.95)'
  };
}

function damageReward(value: number): Reward {
  return {
    kind: 'damage',
    value,
    label: `DMG +${Math.round((value - 1) * 100)}%`,
    color: 0xff7b37,
    bg: 'rgba(202,79,8,.96)'
  };
}

function rateReward(value: number): Reward {
  return {
    kind: 'rate',
    value,
    label: `RATE +${Math.round((value - 1) * 100)}%`,
    color: 0xa05cff,
    bg: 'rgba(92,38,181,.96)'
  };
}

function pierceReward(value: number): Reward {
  return {
    kind: 'pierce',
    value,
    label: `PIERCE +${Math.floor(value)}`,
    color: 0x1fc89a,
    bg: 'rgba(2,127,94,.96)'
  };
}

function multiplyReward(value: number): Reward {
  return {
    kind: 'multiply',
    value,
    label: `×${value}`,
    color: 0xffc72e,
    bg: 'rgba(191,126,0,.97)'
  };
}

class Barrier {
  readonly lane: number;
  readonly x: number;
  readonly width = 3.25;
  readonly maxHealth: number;
  health: number;
  destroyed = false;
  group = new THREE.Group();
  label: ReturnType<typeof makeLabel>;
  material: THREE.MeshStandardMaterial;

  constructor(lane: number, x: number, health: number, hard: boolean) {
    this.lane = lane;
    this.x = x;
    this.maxHealth = Math.max(1, Math.floor(health));
    this.health = this.maxHealth;

    this.material = new THREE.MeshStandardMaterial({
      color: hard ? 0x353946 : 0x505866,
      roughness: 0.54,
      metalness: 0.4,
      emissive: 0x000000
    });

    for (let i = 0; i < 5; i++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.61, 1.45, 0.42), this.material);
      block.position.set((i - 2) * 0.64, 0.72, 0);
      this.group.add(block);
    }

    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.5), this.material);
    cap.position.y = 1.46;
    this.group.add(cap);

    this.group.position.set(x, 0, WALL_Z);
    scene.add(this.group);

    this.label = makeLabel(
      this.health.toLocaleString(),
      hard ? 'rgba(91,27,31,.96)' : 'rgba(23,29,38,.96)',
      '#ffffff',
      2.68
    );
    this.label.sprite.position.set(x, 2.24, WALL_Z - 0.24);
    scene.add(this.label.sprite);
  }

  hit(amount: number) {
    if (this.destroyed) return;

    this.health = Math.max(0, this.health - Math.max(1, Math.floor(amount)));
    this.label.update(this.health.toLocaleString());

    const ratio = this.health / this.maxHealth;
    tempColor.setHex(0x505866).lerp(new THREE.Color(0xff5d49), 1 - ratio);
    this.material.color.copy(tempColor);

    if (this.health <= 0) {
      this.destroyed = true;
      scene.remove(this.group, this.label.sprite);
      burst(this.x, 0.78, WALL_Z, 0x68717e, 15, 4.8);
      cameraShake = Math.max(cameraShake, 0.15);
      onBarrierBroken(this);
    }
  }

  remove() {
    scene.remove(this.group, this.label.sprite);
  }
}

class RewardGate {
  readonly lane: number;
  readonly x: number;
  readonly reward: Reward;
  used = false;
  group = new THREE.Group();
  label: ReturnType<typeof makeLabel>;

  constructor(lane: number, x: number, reward: Reward) {
    this.lane = lane;
    this.x = x;
    this.reward = reward;

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: reward.color,
      emissive: reward.color,
      emissiveIntensity: 0.2,
      roughness: 0.35
    });

    const paneMaterial = new THREE.MeshBasicMaterial({
      color: reward.color,
      transparent: true,
      opacity: 0.17,
      side: THREE.DoubleSide
    });

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.35, 0.13), frameMaterial);
    const right = left.clone();
    left.position.x = -1.47;
    right.position.x = 1.47;

    const top = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.13, 0.13), frameMaterial);
    top.position.y = 1.15;

    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.84, 2.1), paneMaterial);
    pane.position.y = 0.02;
    pane.rotation.y = Math.PI;

    this.group.add(left, right, top, pane);
    this.group.position.set(x, 1.16, GATE_Z);
    scene.add(this.group);

    this.label = makeLabel(reward.label, reward.bg, '#ffffff', 2.86);
    this.label.sprite.position.set(x, 3.05, GATE_Z);
    scene.add(this.label.sprite);
  }

  apply() {
    if (this.used) return;
    this.used = true;

    if (this.reward.kind === 'troops') {
      setArmy(army + this.reward.value);
      toast(`+${Math.floor(this.reward.value)} TROOPS`);
    } else if (this.reward.kind === 'damage') {
      damageMultiplier *= this.reward.value;
      syncHud();
      toast(`DAMAGE +${Math.round((this.reward.value - 1) * 100)}%`);
    } else if (this.reward.kind === 'rate') {
      fireRateMultiplier *= this.reward.value;
      syncHud();
      toast(`FIRE RATE +${Math.round((this.reward.value - 1) * 100)}%`);
    } else if (this.reward.kind === 'pierce') {
      pierce += Math.floor(this.reward.value);
      syncHud();
      toast(`PIERCE +${Math.floor(this.reward.value)}`);
    } else {
      setArmy(army * this.reward.value);
      toast(`ARMY ×${this.reward.value}`);
    }

    burst(this.x, 1.1, GATE_Z, this.reward.color, 18, 4);
    this.remove();
  }

  remove() {
    scene.remove(this.group, this.label.sprite);
  }
}

class EnemyHorde {
  z = ENEMY_START_Z;
  count: number;
  readonly speed: number;
  active = false;
  dead = false;
  contactAccumulator = 0;
  dirty = true;
  group = new THREE.Group();
  body: THREE.InstancedMesh;
  head: THREE.InstancedMesh;
  label: ReturnType<typeof makeLabel>;

  constructor(count: number, speed: number) {
    this.count = Math.max(1, Math.floor(count));
    this.speed = speed;

    this.body = new THREE.InstancedMesh(
      bodyGeometry,
      new THREE.MeshStandardMaterial({ color: 0xef334e, roughness: 0.5 }),
      MAX_RED
    );
    this.head = new THREE.InstancedMesh(
      headGeometry,
      new THREE.MeshStandardMaterial({ color: 0x781628, roughness: 0.44 }),
      MAX_RED
    );
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.head.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.label = makeLabel(
      this.count.toLocaleString(),
      'rgba(171,23,45,.95)',
      '#ffffff',
      2.58
    );
    this.label.sprite.position.set(0, 2.8, 0.7);

    this.group.add(this.body, this.head, this.label.sprite);
    this.group.position.set(0, 0, this.z);
    this.group.visible = false;
    scene.add(this.group);

    this.rebuild();
  }

  activate() {
    this.active = true;
    this.group.visible = true;
  }

  hit(amount: number) {
    if (!this.active || this.dead) return;

    this.count = Math.max(0, this.count - Math.max(1, Math.floor(amount)));
    this.dirty = true;

    if (this.count <= 0) this.destroy();
  }

  rebuild() {
    if (this.dead) return;

    const visibleCount = Math.min(MAX_RED, this.count);
    this.body.count = visibleCount;
    this.head.count = visibleCount;

    const columns = Math.max(
      5,
      Math.min(25, Math.ceil(Math.sqrt(Math.max(visibleCount, 1) * 2)))
    );
    const spacingX = Math.min(0.41, 10 / columns);
    const spacingZ = 0.36;

    for (let i = 0; i < visibleCount; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const rowCount = Math.min(columns, visibleCount - row * columns);
      const noise = ((i * 43) % 101) / 101;
      const x = (col - (rowCount - 1) / 2) * spacingX + (noise - 0.5) * 0.05;
      const z = row * spacingZ;

      dummy.position.set(x, 0.47, z);
      dummy.rotation.set(0, Math.PI, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.body.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, 0.91, z - 0.01);
      dummy.updateMatrix();
      this.head.setMatrixAt(i, dummy.matrix);
    }

    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.label.update(this.count.toLocaleString());
    this.dirty = false;
  }

  update(dt: number) {
    if (!this.active || this.dead) return;

    if (this.z > CONTACT_Z) {
      this.z = Math.max(CONTACT_Z, this.z - this.speed * dt);
      this.group.position.z = this.z;
    } else {
      this.contactAccumulator += dt * Math.max(9, Math.min(54, this.count * 0.34));
      const losses = Math.floor(this.contactAccumulator);

      if (losses > 0) {
        this.contactAccumulator -= losses;
        const actual = Math.min(losses, this.count, army);
        this.count -= actual;
        setArmy(army - actual);
        this.dirty = true;
        cameraShake = Math.max(cameraShake, 0.09);

        if (this.count <= 0) this.destroy();
      }
    }

    if (this.dirty && !this.dead) this.rebuild();
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    burst(0, 0.78, this.z, 0xef334e, 28, 5.4);
    scene.remove(this.group);
    onHordeDestroyed(this);
  }

  remove() {
    scene.remove(this.group);
  }
}

class Commander {
  z = ENEMY_START_Z + 2;
  readonly maxHealth: number;
  health: number;
  active = false;
  dead = false;
  contactAccumulator = 0;
  group = new THREE.Group();

  constructor(health: number) {
    this.maxHealth = Math.max(1, Math.floor(health));
    this.health = this.maxHealth;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x7b1f37,
      roughness: 0.36,
      metalness: 0.18
    });
    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x252b36,
      roughness: 0.35,
      metalness: 0.62
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1.85, 6, 12), bodyMaterial);
    body.position.y = 1.5;

    const chest = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.78, 0.95), armorMaterial);
    chest.position.set(0, 1.82, 0);

    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.28, 2.35, 10), armorMaterial);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 2.38, -1);

    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42),
      new THREE.MeshStandardMaterial({
        color: 0xff4b4b,
        emissive: 0xff1818,
        emissiveIntensity: 1.5
      })
    );
    beacon.position.set(0, 3.28, 0);

    this.group.add(body, chest, cannon, beacon);
    this.group.position.set(0, 0, this.z);
    this.group.visible = false;
    scene.add(this.group);

    bossHpEl.textContent = this.health.toLocaleString();
  }

  activate() {
    this.active = true;
    this.group.visible = true;
    bossWrapEl.classList.add('show');
  }

  hit(amount: number) {
    if (!this.active || this.dead) return;

    this.health = Math.max(0, this.health - Math.max(1, Math.floor(amount)));
    bossHpEl.textContent = this.health.toLocaleString();
    bossBarEl.style.width = `${(this.health / this.maxHealth) * 100}%`;

    if (this.health <= 0) {
      this.dead = true;
      burst(0, 1.45, this.z, 0xff4b4b, 42, 6.8);
      scene.remove(this.group);
      finish(true, `${army.toLocaleString()} troops survived the battle.`);
    }
  }

  update(dt: number, time: number) {
    if (!this.active || this.dead) return;

    this.group.rotation.y = Math.sin(time * 1.7) * 0.06;

    if (this.z > CONTACT_Z + 0.8) {
      this.z = Math.max(CONTACT_Z + 0.8, this.z - (2.7 + level * 0.05) * dt);
      this.group.position.z = this.z;
    } else {
      this.contactAccumulator += dt * (9 + level * 0.48);
      const losses = Math.floor(this.contactAccumulator);

      if (losses > 0) {
        this.contactAccumulator -= losses;
        setArmy(army - losses);
        cameraShake = Math.max(cameraShake, 0.12);
      }
    }
  }
}

type SectionSpec = {
  walls: [number, number, number];
  rewards: [Reward, Reward, Reward];
  enemyCount: number;
  enemySpeed: number;
};

const specs: SectionSpec[] = [];
const sectionCount = Math.min(7, 5 + Math.floor((level - 1) / 4));

let expectedArmy = army;
let expectedWeapon = 1;

for (let i = 0; i < sectionCount; i++) {
  const baseWall = Math.round((19 + i * 14) * LEVEL_SCALE * (0.9 + expectedWeapon * 0.1));
  const safeTroops = Math.max(5, Math.round(5 + expectedArmy * 0.17));
  const mediumTroops = Math.max(9, Math.round(8 + expectedArmy * 0.31));
  const jackpotTroops = Math.max(22, Math.round(20 + expectedArmy * 0.7));

  let rewards: [Reward, Reward, Reward];

  if (i % 4 === 0) {
    rewards = [troopReward(safeTroops), damageReward(1.28), troopReward(jackpotTroops)];
  } else if (i % 4 === 1) {
    rewards = [
      troopReward(safeTroops),
      rateReward(1.25),
      i >= 3 ? multiplyReward(2) : troopReward(jackpotTroops)
    ];
  } else if (i % 4 === 2) {
    rewards = [
      troopReward(mediumTroops),
      pierceReward(1),
      troopReward(jackpotTroops + Math.round(expectedArmy * 0.16))
    ];
  } else {
    rewards = [damageReward(1.18), troopReward(mediumTroops), multiplyReward(2)];
  }

  const walls: [number, number, number] = [
    Math.max(7, Math.round(baseWall * 0.66)),
    Math.max(11, Math.round(baseWall * 1.04)),
    Math.max(20, Math.round(baseWall * 2.2))
  ];

  const expectedPick = rewards[i % 3 === 2 ? 1 : 0];
  if (expectedPick.kind === 'troops') expectedArmy += expectedPick.value;
  if (expectedPick.kind === 'multiply') expectedArmy *= expectedPick.value;
  if (expectedPick.kind === 'damage' || expectedPick.kind === 'rate') expectedWeapon *= expectedPick.value;
  if (expectedPick.kind === 'pierce') expectedWeapon *= 1.12;

  specs.push({
    walls,
    rewards,
    enemyCount: Math.max(
      14,
      Math.round((14 + i * 8 + expectedArmy * 0.3) * Math.pow(LEVEL_SCALE, 0.5))
    ),
    enemySpeed: 4.7 + i * 0.25 + level * 0.04
  });
}

class ActiveSection {
  readonly barriers: Barrier[];
  readonly gates: RewardGate[];
  readonly horde: EnemyHorde;
  selectedLane: number | null = null;

  constructor(spec: SectionSpec) {
    this.barriers = LANE_X.map(
      (x, lane) => new Barrier(lane, x, spec.walls[lane], lane === 2)
    );
    this.gates = LANE_X.map(
      (x, lane) => new RewardGate(lane, x, spec.rewards[lane])
    );
    this.horde = new EnemyHorde(spec.enemyCount, spec.enemySpeed);
  }

  chooseLane(lane: number) {
    if (this.selectedLane !== null) return;
    this.selectedLane = lane;

    this.barriers.forEach((barrier, index) => {
      if (index !== lane) barrier.remove();
    });

    this.gates.forEach((gate, index) => {
      if (index !== lane) gate.remove();
    });

    this.gates[lane].apply();
    this.horde.activate();
  }

  remove() {
    this.barriers.forEach((barrier) => barrier.remove());
    this.gates.forEach((gate) => gate.remove());
    this.horde.remove();
  }
}

let sectionIndex = 0;
let activeSection = new ActiveSection(specs[sectionIndex]);

const commanderHealth = Math.round(
  (230 + expectedArmy * 3.5 + expectedWeapon * 125) * Math.pow(LEVEL_SCALE, 0.56)
);
const commander = new Commander(commanderHealth);

function onBarrierBroken(barrier: Barrier) {
  if (!running || phase !== 'choice') return;
  if (barrier !== activeSection.barriers[barrier.lane]) return;

  targetX = LANE_X[barrier.lane];
  activeSection.chooseLane(barrier.lane);
  setPhase('battle');
  hintEl.classList.add('hidden');
  toast('ENEMY INCOMING');
}

function onHordeDestroyed(horde: EnemyHorde) {
  if (!running || horde !== activeSection.horde) return;

  activeSection.remove();
  sectionIndex += 1;
  targetX = 0;

  if (sectionIndex < specs.length) {
    activeSection = new ActiveSection(specs[sectionIndex]);
    laneArmed = false;
    targetX = 0;
    hintEl.textContent = 'SWIPE LEFT / RIGHT TO CHOOSE A LANE';
    hintEl.classList.remove('hidden');
    setPhase('choice');
    toast('CHOOSE YOUR NEXT LANE');
  } else {
    setPhase('boss');
    commander.activate();
    toast('COMMANDER INCOMING');
  }
}

type Bullet = {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  damage: number;
  pierceLeft: number;
};

const bullets: Bullet[] = [];
const bulletGeometry = new THREE.BoxGeometry(0.075, 0.075, 0.7);
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffed6f });

function fireVolley() {
  if (
    !running ||
    army <= 0 ||
    phase === 'finished' ||
    (phase === 'choice' && !laneArmed)
  ) return;

  const shots = Math.min(16, Math.max(1, Math.ceil(Math.sqrt(army) / 1.42)));
  const unitWeight = Math.max(1, army / shots);
  const damage = Math.max(1, Math.round(unitWeight * 0.34 * damageMultiplier));
  const spread = Math.min(2.45, 0.34 * (shots - 1));

  for (let i = 0; i < shots && bullets.length < 150; i++) {
    const t = shots === 1 ? 0.5 : i / (shots - 1);
    const x = squadX - spread / 2 + spread * t;

    const mesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    mesh.position.set(x, 0.78, PLAYER_Z + 0.95);
    scene.add(mesh);

    bullets.push({
      mesh,
      x,
      z: PLAYER_Z + 0.95,
      damage,
      pierceLeft: pierce
    });
  }
}

function removeBullet(index: number) {
  scene.remove(bullets[index].mesh);
  bullets.splice(index, 1);
}

function clearBullets() {
  for (const bullet of bullets) scene.remove(bullet.mesh);
  bullets.length = 0;
}

function updateBullets(dt: number) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const previousZ = bullet.z;
    bullet.z += 31 * dt;
    bullet.mesh.position.z = bullet.z;

    let hit = false;

    if (phase === 'choice') {
      for (const barrier of activeSection.barriers) {
        if (barrier.destroyed) continue;
        if (Math.abs(bullet.x - barrier.x) > barrier.width / 2) continue;

        if (previousZ <= WALL_Z + 0.32 && bullet.z >= WALL_Z - 0.32) {
          barrier.hit(bullet.damage);
          hit = true;
          break;
        }
      }
    }

    if (
      !hit &&
      phase === 'battle' &&
      activeSection.horde.active &&
      !activeSection.horde.dead &&
      Math.abs(bullet.x) < 5.8 &&
      previousZ <= activeSection.horde.z + 4 &&
      bullet.z >= activeSection.horde.z - 0.55
    ) {
      activeSection.horde.hit(bullet.damage);
      hit = true;
    }

    if (
      !hit &&
      phase === 'boss' &&
      commander.active &&
      !commander.dead &&
      Math.abs(bullet.x) < 1.8 &&
      previousZ <= commander.z + 1.35 &&
      bullet.z >= commander.z - 1.3
    ) {
      commander.hit(bullet.damage);
      hit = true;
    }

    if (hit) {
      if (bullet.pierceLeft > 0) {
        bullet.pierceLeft -= 1;
      } else {
        removeBullet(i);
        continue;
      }
    }

    if (bullet.z > 72) removeBullet(i);
  }
}

function finish(success: boolean, message: string) {
  if (!running) return;

  running = false;
  won = success;
  setPhase('finished');
  clearBullets();

  resultKickerEl.textContent = success
    ? `BATTLE ${level} COMPLETE`
    : `BATTLE ${level} LOST`;
  resultTitleEl.textContent = success ? 'VICTORY' : 'LINE BROKEN';
  resultTextEl.textContent = message;
  restartButton.textContent = success ? 'NEXT BATTLE' : 'RETRY';
  overlayEl.classList.add('show');
  hintEl.classList.add('hidden');
}

function updateCamera(dt: number) {
  const shakeX = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
  const shakeY = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake * 0.45 : 0;

  camera.position.set(
    CAMERA_BASE.x + shakeX,
    CAMERA_BASE.y + shakeY,
    CAMERA_BASE.z
  );
  camera.lookAt(0, 0.75, 12);

  cameraShake = Math.max(0, cameraShake - dt * 2.4);
}

renderer.domElement.addEventListener('pointerdown', (event: PointerEvent) => {
  if (!running || phase === 'finished') return;

  pointerDown = true;
  pointerStartX = event.clientX;
  pointerStartTargetX = targetX;
  renderer.domElement.setPointerCapture(event.pointerId);

  if (firstInput) {
    firstInput = false;
    hintEl.classList.add('hidden');
  }
});

renderer.domElement.addEventListener('pointermove', (event: PointerEvent) => {
  if (!pointerDown || !running || phase === 'finished') return;

  const delta = (event.clientX - pointerStartX) / Math.max(280, window.innerWidth);

  // Match the swipe direction to what feels natural from the player's view.
  targetX = THREE.MathUtils.clamp(pointerStartTargetX - delta * 13.5, -5.25, 5.25);

  // Choice phases do nothing until the player actually commits to a swipe.
  // This prevents the game from idling through the centre lane by itself.
  if (phase === 'choice' && Math.abs(delta) > 0.035) {
    laneArmed = true;
    hintEl.classList.add('hidden');
  }
});

function releasePointer(event: PointerEvent) {
  pointerDown = false;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
}

renderer.domElement.addEventListener('pointerup', releasePointer);
renderer.domElement.addEventListener('pointercancel', releasePointer);

restartButton.addEventListener('click', () => {
  if (won) localStorage.setItem(STORAGE_LEVEL, String(level + 1));
  window.location.reload();
});

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
    squadX += (targetX - squadX) * Math.min(1, dt * 13);
    blueGroup.position.x = squadX;
    blueGroup.position.y = Math.sin(time * 5.5) * 0.012;

    shootTimer -= dt;
    if (shootTimer <= 0) {
      fireVolley();
      shootTimer = Math.max(0.08, 0.22 / fireRateMultiplier);
    }

    updateBullets(dt);

    if (phase === 'battle') activeSection.horde.update(dt);
    if (phase === 'boss') commander.update(dt, time);

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.remove('show');
    }
  }

  updateParticles(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

syncHud();
rebuildBlueFormation();
laneArmed = false;
hintEl.textContent = 'SWIPE LEFT / RIGHT TO CHOOSE A LANE';
setPhase('choice');
requestAnimationFrame(frame);
