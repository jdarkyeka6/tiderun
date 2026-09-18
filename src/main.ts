import * as THREE from 'three';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <div id="hud">
    <div class="topbar">
      <div class="brand">TIDERUN</div>
      <div class="level" id="levelLabel">BATTLE 1</div>
    </div>

    <div class="stats">
      <div class="stat"><span>ARMY</span><strong id="armyCount">8</strong></div>
      <div class="stat"><span>FIREPOWER</span><strong id="powerCount">1.0×</strong></div>
    </div>

    <div id="phaseBadge">BREAK A LANE</div>

    <div id="bossWrap">
      <div class="bossHeader"><span>COMMANDER</span><strong id="bossHp">0</strong></div>
      <div class="bossTrack"><div id="bossBar"></div></div>
    </div>

    <div id="hint">DRAG LEFT / RIGHT · SHOOT A PATH OPEN</div>
    <div id="toast"></div>

    <div id="overlay">
      <div id="resultCard">
        <div class="resultKicker" id="resultKicker">BATTLE COMPLETE</div>
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
const phaseBadgeEl = document.querySelector<HTMLElement>('#phaseBadge')!;
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

const STORAGE_LEVEL = 'tiderun-battle-v3';
const level = Math.max(1, Number.parseInt(localStorage.getItem(STORAGE_LEVEL) ?? '1', 10) || 1);
levelEl.textContent = `BATTLE ${level}`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ad9ff);
scene.fog = new THREE.Fog(0x8ad9ff, 52, 145);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 420);
camera.position.set(0, 16.8, -15.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x244866, 2.45));

const sun = new THREE.DirectionalLight(0xfffbef, 3.15);
sun.position.set(-9, 22, -8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -22;
sun.shadow.camera.right = 22;
sun.shadow.camera.top = 38;
sun.shadow.camera.bottom = -18;
scene.add(sun);

const FIELD_HALF = 8.2;
const LANE_X = [-4.55, 0, 4.55] as const;
const MAX_BLUE = 560;
const MAX_RED = 360;
const LEVEL_SCALE = Math.pow(1.15, level - 1);

const field = new THREE.Mesh(
  new THREE.BoxGeometry(FIELD_HALF * 2, 0.34, 410),
  new THREE.MeshStandardMaterial({ color: 0xcfc8b5, roughness: 0.94 })
);
field.position.set(0, -0.25, 184);
field.receiveShadow = true;
scene.add(field);

const seaMaterial = new THREE.MeshStandardMaterial({
  color: 0x167fae,
  roughness: 0.3,
  metalness: 0.08
});
for (const x of [-24, 24]) {
  const sea = new THREE.Mesh(new THREE.BoxGeometry(30, 0.16, 410), seaMaterial);
  sea.position.set(x, -0.39, 184);
  scene.add(sea);
}

const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xf2ead5, roughness: 0.82 });
for (const x of [-FIELD_HALF - 0.18, FIELD_HALF + 0.18]) {
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 410), edgeMaterial);
  edge.position.set(x, 0.01, 184);
  edge.receiveShadow = true;
  scene.add(edge);
}

const laneMarkMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.42,
  roughness: 0.85
});
for (let z = 5; z < 380; z += 7.5) {
  for (const x of [-2.28, 2.28]) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 1.65), laneMarkMaterial);
    mark.position.set(x, -0.055, z);
    scene.add(mark);
  }
}

const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x76593a, roughness: 0.88 });
for (let i = 0; i < 30; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.72, 0.8), crateMaterial);
  crate.position.set(side * (7.1 + (i % 3) * 0.22), 0.36, 12 + i * 11.5);
  crate.rotation.y = ((i * 37) % 17) * 0.04;
  crate.castShadow = true;
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

function makeLabel(initial: string, background: string, foreground = '#ffffff', width = 3.0) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );
  sprite.scale.set(width, width * 0.37, 1);

  const update = (text: string) => {
    ctx.clearRect(0, 0, 512, 192);
    ctx.fillStyle = background;
    roundRect(ctx, 22, 29, 468, 134, 40);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.52)';
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
  spin: THREE.Vector3;
  life: number;
};

const particles: Particle[] = [];
const particleGeometry = new THREE.BoxGeometry(0.14, 0.14, 0.14);

function burst(x: number, y: number, z: number, color: number, count: number, force = 4) {
  const material = new THREE.MeshBasicMaterial({ color });
  const random = seeded(Math.floor((x + 11) * 131 + z * 29 + performance.now()));

  for (let i = 0; i < count && particles.length < 280; i++) {
    const mesh = new THREE.Mesh(particleGeometry, material);
    mesh.position.set(
      x + (random() - 0.5) * 1.1,
      y + random() * 0.55,
      z + (random() - 0.5) * 0.85
    );
    scene.add(mesh);

    particles.push({
      mesh,
      velocity: new THREE.Vector3(
        (random() - 0.5) * force,
        1.3 + random() * force,
        (random() - 0.5) * force
      ),
      spin: new THREE.Vector3(random() * 7, random() * 7, random() * 7),
      life: 0.36 + random() * 0.5
    });
  }
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.velocity.y -= 9 * dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.rotation.x += p.spin.x * dt;
    p.mesh.rotation.y += p.spin.y * dt;
    p.mesh.rotation.z += p.spin.z * dt;
    p.mesh.scale.setScalar(Math.max(0.03, p.life * 1.65));

    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

const bodyGeometry = new THREE.CapsuleGeometry(0.17, 0.38, 3, 6);
const headGeometry = new THREE.SphereGeometry(0.15, 7, 6);

const blueBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x087cff, roughness: 0.5 });
const blueHeadMaterial = new THREE.MeshStandardMaterial({ color: 0xc9ebff, roughness: 0.42 });

const blueBodies = new THREE.InstancedMesh(bodyGeometry, blueBodyMaterial, MAX_BLUE);
const blueHeads = new THREE.InstancedMesh(headGeometry, blueHeadMaterial, MAX_BLUE);
blueBodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
blueHeads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
blueBodies.castShadow = true;
blueHeads.castShadow = true;
scene.add(blueBodies, blueHeads);

let army = 8 + Math.floor((level - 1) * 1.3);
let damageMultiplier = 1;
let fireRateMultiplier = 1;
let pierce = 0;

let squadX = 0;
let targetX = 0;
let squadZ = 0;
let targetZ = 0;
let pointerDown = false;
let pointerStartX = 0;
let pointerStartTargetX = 0;
let shootTimer = 0;
let toastTimer = 0;
let cameraShake = 0;
let running = true;
let won = false;

type Phase = 'choice' | 'advance' | 'battle' | 'boss' | 'finished';
let phase: Phase = 'advance';

function displayedPower() {
  return damageMultiplier * fireRateMultiplier * (1 + pierce * 0.18);
}

function syncHud() {
  armyEl.textContent = Math.max(0, Math.floor(army)).toLocaleString();
  powerEl.textContent = `${displayedPower().toFixed(1)}×`;
}

function setPhase(next: Phase) {
  phase = next;
  const text =
    next === 'choice' ? 'BREAK A LANE' :
    next === 'advance' ? 'PUSHING FORWARD' :
    next === 'battle' ? 'HOLD THE LINE' :
    next === 'boss' ? 'COMMANDER' :
    '';
  phaseBadgeEl.textContent = text;
  phaseBadgeEl.classList.toggle('quiet', next === 'advance');
}

function setArmy(next: number) {
  army = Math.max(0, Math.floor(next));
  syncHud();
  if (army <= 0 && running) finish(false, 'The red line overwhelmed your squad.');
}

function toast(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimer = 1.15;
}

function updateBlueFormation(time: number) {
  const count = Math.min(MAX_BLUE, army);
  blueBodies.count = count;
  blueHeads.count = count;

  const columns = Math.max(3, Math.min(22, Math.ceil(Math.sqrt(Math.max(count, 1) * 1.75))));
  const spacingX = Math.min(0.41, 7.5 / columns);
  const spacingZ = 0.4;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const rowCount = Math.min(columns, count - row * columns);
    const noise = ((i * 83) % 97) / 97;

    const x =
      squadX +
      (col - (rowCount - 1) / 2) * spacingX +
      (noise - 0.5) * 0.065;

    const z =
      squadZ -
      row * spacingZ +
      Math.sin(time * 7.5 + i * 0.53) * 0.022;

    const marching = phase === 'advance' ? 1 : 0.38;
    const bob = Math.sin(time * (8.5 + marching * 2.5) + i * 0.71) * (0.018 + marching * 0.022);

    dummy.position.set(x, 0.47 + bob, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    blueBodies.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, 0.91 + bob, z + 0.01);
    dummy.updateMatrix();
    blueHeads.setMatrixAt(i, dummy.matrix);
  }

  blueBodies.instanceMatrix.needsUpdate = true;
  blueHeads.instanceMatrix.needsUpdate = true;
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
    color: 0x9d58ff,
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
  readonly z: number;
  readonly width = 3.3;
  readonly maxHealth: number;
  health: number;
  destroyed = false;
  hidden = false;
  group = new THREE.Group();
  label: ReturnType<typeof makeLabel>;
  material: THREE.MeshStandardMaterial;

  constructor(lane: number, x: number, z: number, health: number, hard: boolean) {
    this.lane = lane;
    this.x = x;
    this.z = z;
    this.maxHealth = Math.max(1, Math.floor(health));
    this.health = this.maxHealth;

    this.material = new THREE.MeshStandardMaterial({
      color: hard ? 0x353946 : 0x4f5664,
      roughness: 0.52,
      metalness: 0.46,
      emissive: 0x000000
    });

    for (let i = 0; i < 5; i++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.61, 1.48, 0.42), this.material);
      block.position.set((i - 2) * 0.65, 0.73, 0);
      block.castShadow = true;
      block.receiveShadow = true;
      this.group.add(block);
    }

    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.2, 0.52), this.material);
    cap.position.y = 1.5;
    cap.castShadow = true;
    this.group.add(cap);

    this.group.position.set(x, 0, z);
    scene.add(this.group);

    this.label = makeLabel(
      this.health.toLocaleString(),
      hard ? 'rgba(92,27,32,.96)' : 'rgba(24,29,38,.96)',
      '#ffffff',
      2.75
    );
    this.label.sprite.position.set(x, 2.28, z - 0.28);
    scene.add(this.label.sprite);
  }

  hit(amount: number) {
    if (this.destroyed || this.hidden) return;

    this.health = Math.max(0, this.health - Math.max(1, Math.floor(amount)));
    this.label.update(this.health.toLocaleString());

    const ratio = this.health / this.maxHealth;
    tempColor.setHex(0x4f5664).lerp(new THREE.Color(0xff5a48), 1 - ratio);
    this.material.color.copy(tempColor);
    this.material.emissive.setHex(0x4b100d);
    this.material.emissiveIntensity = (1 - ratio) * 0.4;

    if (this.health <= 0) this.breakOpen();
  }

  breakOpen() {
    if (this.destroyed) return;
    this.destroyed = true;
    scene.remove(this.group, this.label.sprite);
    burst(this.x, 0.8, this.z, 0x697281, 20, 5.2);
    cameraShake = Math.max(cameraShake, 0.16);
    onBarrierBroken(this);
  }

  hide() {
    if (this.hidden || this.destroyed) return;
    this.hidden = true;
    scene.remove(this.group, this.label.sprite);
  }
}

class RewardGate {
  readonly lane: number;
  readonly x: number;
  readonly z: number;
  readonly reward: Reward;
  hidden = false;
  used = false;
  group = new THREE.Group();
  label: ReturnType<typeof makeLabel>;

  constructor(lane: number, x: number, z: number, reward: Reward) {
    this.lane = lane;
    this.x = x;
    this.z = z;
    this.reward = reward;

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: reward.color,
      emissive: reward.color,
      emissiveIntensity: 0.2,
      roughness: 0.34
    });

    const paneMaterial = new THREE.MeshBasicMaterial({
      color: reward.color,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.14), frameMaterial);
    const right = left.clone();
    left.position.x = -1.5;
    right.position.x = 1.5;

    const top = new THREE.Mesh(new THREE.BoxGeometry(3.12, 0.14, 0.14), frameMaterial);
    top.position.y = 1.17;

    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.15), paneMaterial);
    pane.position.y = 0.02;
    pane.rotation.y = Math.PI;

    this.group.add(left, right, top, pane);
    this.group.position.set(x, 1.18, z);
    scene.add(this.group);

    this.label = makeLabel(reward.label, reward.bg, '#ffffff', 2.95);
    this.label.sprite.position.set(x, 3.14, z - 0.08);
    scene.add(this.label.sprite);
  }

  apply() {
    if (this.used || this.hidden) return;
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

    burst(this.x, 1.15, this.z, this.reward.color, 24, 4.2);
    this.hide();
  }

  hide() {
    if (this.hidden) return;
    this.hidden = true;
    scene.remove(this.group, this.label.sprite);
  }
}

class EnemyHorde {
  readonly startZ: number;
  x = 0;
  z: number;
  count: number;
  active = false;
  dead = false;
  contact = 0;
  readonly speed: number;
  readonly body: THREE.InstancedMesh;
  readonly head: THREE.InstancedMesh;
  readonly label: ReturnType<typeof makeLabel>;

  constructor(z: number, count: number, speed: number) {
    this.startZ = z;
    this.z = z;
    this.count = Math.max(1, Math.floor(count));
    this.speed = speed;

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xef334e, roughness: 0.49 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x781628, roughness: 0.44 });

    this.body = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, MAX_RED);
    this.head = new THREE.InstancedMesh(headGeometry, headMaterial, MAX_RED);
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.head.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.castShadow = true;
    this.head.castShadow = true;
    scene.add(this.body, this.head);

    this.label = makeLabel(this.count.toLocaleString(), 'rgba(171,23,45,.95)', '#ffffff', 2.65);
    scene.add(this.label.sprite);
    this.refresh(0);
  }

  hit(amount: number) {
    if (!this.active || this.dead) return;

    this.count = Math.max(0, this.count - Math.max(1, Math.floor(amount)));
    if (this.count <= 0) this.destroy();
  }

  refresh(time: number) {
    if (this.dead) return;

    const renderCount = Math.min(MAX_RED, this.count);
    this.body.count = renderCount;
    this.head.count = renderCount;

    const columns = Math.max(5, Math.min(25, Math.ceil(Math.sqrt(Math.max(renderCount, 1) * 1.9))));
    const spacingX = Math.min(0.43, 9.8 / columns);
    const spacingZ = 0.41;

    for (let i = 0; i < renderCount; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const rowCount = Math.min(columns, renderCount - row * columns);
      const noise = ((i * 43) % 101) / 101;
      const x = (col - (rowCount - 1) / 2) * spacingX + (noise - 0.5) * 0.07;
      const z = this.z + row * spacingZ + Math.sin(time * 8 + i * 0.49) * 0.02;
      const bob = Math.sin(time * 10.2 + i * 0.67) * 0.027;

      dummy.position.set(x, 0.47 + bob, z);
      dummy.rotation.set(0, Math.PI, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.body.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, 0.91 + bob, z - 0.01);
      dummy.updateMatrix();
      this.head.setMatrixAt(i, dummy.matrix);
    }

    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.label.update(this.count.toLocaleString());
    this.label.sprite.position.set(0, 3.0, this.z + 0.8);
  }

  update(dt: number, time: number) {
    if (!this.active || this.dead) {
      this.refresh(time);
      return;
    }

    const gap = this.z - squadZ;

    if (gap > 1.55) {
      this.z -= this.speed * dt;
    } else {
      this.contact += dt * Math.max(7, Math.min(48, this.count * 0.3));
      const losses = Math.floor(this.contact);

      if (losses > 0) {
        this.contact -= losses;
        const actual = Math.min(losses, this.count, army);
        this.count -= actual;
        setArmy(army - actual);
        cameraShake = Math.max(cameraShake, 0.09);

        if (this.count <= 0) this.destroy();
      }
    }

    this.refresh(time);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    burst(0, 0.8, this.z, 0xef334e, 34, 5.7);
    scene.remove(this.body, this.head, this.label.sprite);
    onHordeDestroyed(this);
  }
}

class Commander {
  x = 0;
  z: number;
  readonly maxHealth: number;
  health: number;
  active = false;
  dead = false;
  contact = 0;
  group = new THREE.Group();

  constructor(z: number, health: number) {
    this.z = z;
    this.maxHealth = Math.max(1, Math.floor(health));
    this.health = this.maxHealth;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x7b1f37,
      roughness: 0.34,
      metalness: 0.18
    });
    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x252b36,
      roughness: 0.34,
      metalness: 0.65
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 1.85, 6, 12), bodyMaterial);
    body.position.y = 1.5;
    body.castShadow = true;

    const chest = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.78, 0.95), armorMaterial);
    chest.position.set(0, 1.82, 0);
    chest.castShadow = true;

    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.28, 2.35, 10), armorMaterial);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 2.38, -1.0);

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
    this.group.position.set(0, 0, z);
    scene.add(this.group);

    bossHpEl.textContent = this.health.toLocaleString();
  }

  hit(amount: number) {
    if (!this.active || this.dead) return;

    this.health = Math.max(0, this.health - Math.max(1, Math.floor(amount)));
    bossHpEl.textContent = this.health.toLocaleString();
    bossBarEl.style.width = `${(this.health / this.maxHealth) * 100}%`;

    if (this.health <= 0) {
      this.dead = true;
      burst(0, 1.5, this.z, 0xff4b4b, 58, 7.4);
      scene.remove(this.group);
      finish(true, `${army.toLocaleString()} troops survived the battle.`);
    }
  }

  update(dt: number, time: number) {
    if (!this.active || this.dead) return;

    this.group.rotation.y = Math.sin(time * 1.8) * 0.07;
    const gap = this.z - squadZ;

    if (gap > 2.5) {
      this.z -= 0.82 * dt;
      this.group.position.z = this.z;
    } else {
      this.contact += dt * (8.5 + level * 0.45);
      const losses = Math.floor(this.contact);

      if (losses > 0) {
        this.contact -= losses;
        setArmy(army - losses);
        cameraShake = Math.max(cameraShake, 0.12);
      }
    }
  }
}

class BattleSection {
  readonly index: number;
  readonly wallZ: number;
  readonly holdZ: number;
  readonly gateZ: number;
  readonly battleZ: number;
  readonly barriers: Barrier[];
  readonly gates: RewardGate[];
  readonly horde: EnemyHorde;
  selectedLane: number | null = null;
  rewardApplied = false;

  constructor(index: number, wallZ: number, wallHp: number[], rewards: Reward[], enemyCount: number) {
    this.index = index;
    this.wallZ = wallZ;
    this.holdZ = wallZ - 10;
    this.gateZ = wallZ + 3.9;
    this.battleZ = wallZ + 10.7;

    this.barriers = LANE_X.map(
      (x, lane) => new Barrier(lane, x, wallZ, wallHp[lane], lane === 2)
    );

    this.gates = LANE_X.map(
      (x, lane) => new RewardGate(lane, x, this.gateZ, rewards[lane])
    );

    this.horde = new EnemyHorde(
      wallZ + 21.5,
      enemyCount,
      1.0 + index * 0.075 + level * 0.015
    );
  }

  chooseLane(lane: number) {
    if (this.selectedLane !== null) return;
    this.selectedLane = lane;

    this.barriers.forEach((barrier, i) => {
      if (i !== lane) barrier.hide();
    });

    this.gates.forEach((gate, i) => {
      if (i !== lane) gate.hide();
    });
  }

  updateAdvance() {
    if (this.selectedLane === null) return;

    const gate = this.gates[this.selectedLane];
    if (!this.rewardApplied && squadZ >= this.gateZ - 0.15) {
      this.rewardApplied = true;
      gate.apply();
    }
  }
}

const sections: BattleSection[] = [];
const sectionCount = Math.min(7, 5 + Math.floor((level - 1) / 4));

let expectedArmy = 8 + (level - 1) * 1.3;
let expectedWeapon = 1;

for (let i = 0; i < sectionCount; i++) {
  const wallZ = 28 + i * 43;
  const baseWall = Math.round((20 + i * 14) * LEVEL_SCALE * (0.9 + expectedWeapon * 0.1));
  const safeTroops = Math.max(5, Math.round(5 + expectedArmy * 0.16));
  const mediumTroops = Math.max(9, Math.round(8 + expectedArmy * 0.3));
  const jackpotTroops = Math.max(22, Math.round(20 + expectedArmy * 0.68));

  let rewards: Reward[];
  if (i % 4 === 0) {
    rewards = [troopReward(safeTroops), damageReward(1.28), troopReward(jackpotTroops)];
  } else if (i % 4 === 1) {
    rewards = [troopReward(safeTroops), rateReward(1.25), i >= 3 ? multiplyReward(2) : troopReward(jackpotTroops)];
  } else if (i % 4 === 2) {
    rewards = [troopReward(mediumTroops), pierceReward(1), troopReward(jackpotTroops + Math.round(expectedArmy * 0.15))];
  } else {
    rewards = [damageReward(1.18), troopReward(mediumTroops), multiplyReward(2)];
  }

  const wallHp = [
    Math.max(7, Math.round(baseWall * 0.68)),
    Math.max(11, Math.round(baseWall * 1.06)),
    Math.max(20, Math.round(baseWall * 2.25))
  ];

  const expectedPick = rewards[i % 3 === 2 ? 1 : 0];

  if (expectedPick.kind === 'troops') expectedArmy += expectedPick.value;
  if (expectedPick.kind === 'multiply') expectedArmy *= expectedPick.value;
  if (expectedPick.kind === 'damage' || expectedPick.kind === 'rate') expectedWeapon *= expectedPick.value;
  if (expectedPick.kind === 'pierce') expectedWeapon *= 1.12;

  const enemyCount = Math.max(
    12,
    Math.round((13 + i * 8 + expectedArmy * 0.3) * Math.pow(LEVEL_SCALE, 0.52))
  );

  sections.push(new BattleSection(i, wallZ, wallHp, rewards, enemyCount));
}

let activeSectionIndex = 0;
const finalSection = sections[sections.length - 1];
const commanderZ = finalSection.wallZ + 39;
const commanderHealth = Math.round(
  (220 + expectedArmy * 3.4 + expectedWeapon * 125) * Math.pow(LEVEL_SCALE, 0.58)
);
const commander = new Commander(commanderZ, commanderHealth);

squadZ = sections[0].holdZ - 9;
targetZ = sections[0].holdZ;

function currentSection() {
  return sections[activeSectionIndex] ?? null;
}

function onBarrierBroken(barrier: Barrier) {
  if (!running || phase !== 'choice') return;
  const section = currentSection();
  if (!section || barrier !== section.barriers[barrier.lane]) return;

  section.chooseLane(barrier.lane);
  targetX = LANE_X[barrier.lane];
  targetZ = section.battleZ;
  setPhase('advance');
  toast('PATH OPEN');
}

function onHordeDestroyed(horde: EnemyHorde) {
  if (!running) return;
  const section = currentSection();
  if (!section || horde !== section.horde) return;

  activeSectionIndex += 1;

  if (activeSectionIndex < sections.length) {
    const next = sections[activeSectionIndex];
    targetZ = next.holdZ;
    targetX = 0;
    setPhase('advance');
    toast('FRONT CLEARED');
  } else {
    targetZ = commanderZ - 10.5;
    targetX = 0;
    setPhase('advance');
    toast('COMMANDER AHEAD');
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
const bulletGeometry = new THREE.BoxGeometry(0.075, 0.075, 0.72);
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffec69 });

function fireVolley() {
  if (!running || army <= 0) return;

  const shots = Math.min(16, Math.max(1, Math.ceil(Math.sqrt(army) / 1.45)));
  const unitWeight = Math.max(1, army / Math.max(1, shots));
  const damage = Math.max(1, Math.round(unitWeight * 0.34 * damageMultiplier));
  const spread = Math.min(2.45, 0.34 * (shots - 1));

  for (let i = 0; i < shots && bullets.length < 180; i++) {
    const t = shots === 1 ? 0.5 : i / (shots - 1);
    const x = squadX - spread / 2 + spread * t;

    const mesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    mesh.position.set(x, 0.78, squadZ + 0.95);
    scene.add(mesh);

    bullets.push({
      mesh,
      x,
      z: squadZ + 0.95,
      damage,
      pierceLeft: pierce
    });
  }
}

function removeBullet(index: number) {
  scene.remove(bullets[index].mesh);
  bullets.splice(index, 1);
}

function updateBullets(dt: number) {
  const section = currentSection();

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const previousZ = bullet.z;
    bullet.z += 30 * dt;
    bullet.mesh.position.z = bullet.z;

    let hit = false;

    if (section && phase === 'choice') {
      for (const barrier of section.barriers) {
        if (barrier.destroyed || barrier.hidden) continue;
        if (Math.abs(bullet.x - barrier.x) > barrier.width / 2) continue;

        if (previousZ <= barrier.z + 0.32 && bullet.z >= barrier.z - 0.32) {
          barrier.hit(bullet.damage);
          hit = true;
          break;
        }
      }
    }

    if (
      !hit &&
      section &&
      section.horde.active &&
      !section.horde.dead &&
      Math.abs(bullet.x) < 5.4
    ) {
      if (previousZ <= section.horde.z + 4.2 && bullet.z >= section.horde.z - 0.55) {
        section.horde.hit(bullet.damage);
        hit = true;
      }
    }

    if (
      !hit &&
      commander.active &&
      !commander.dead &&
      Math.abs(bullet.x - commander.x) < 1.75 &&
      previousZ <= commander.z + 1.4 &&
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

    if (bullet.z > squadZ + 62) removeBullet(i);
  }
}

function updateAdvance(dt: number) {
  if (phase !== 'advance') return;

  const distance = targetZ - squadZ;
  const speed = Math.abs(distance) > 10 ? 12.5 : 8.5;
  squadZ += Math.sign(distance) * Math.min(Math.abs(distance), speed * dt);

  const section = currentSection();
  if (section) section.updateAdvance();

  if (Math.abs(targetZ - squadZ) > 0.08) return;
  squadZ = targetZ;

  if (activeSectionIndex < sections.length) {
    const current = sections[activeSectionIndex];

    if (current.selectedLane === null) {
      setPhase('choice');
      targetX = 0;
      hintEl.classList.remove('hidden');
    } else {
      current.horde.active = true;
      setPhase('battle');
      hintEl.classList.add('hidden');
      toast('ENEMY WAVE');
    }
  } else {
    commander.active = true;
    bossWrapEl.classList.add('show');
    setPhase('boss');
    hintEl.classList.add('hidden');
    toast('COMMANDER ENGAGED');
  }
}

function finish(success: boolean, message: string) {
  if (!running) return;

  running = false;
  won = success;
  setPhase('finished');

  resultKickerEl.textContent = success ? `BATTLE ${level} COMPLETE` : `BATTLE ${level} LOST`;
  resultTitleEl.textContent = success ? 'VICTORY' : 'LINE BROKEN';
  resultTextEl.textContent = message;
  restartButton.textContent = success ? 'NEXT BATTLE' : 'RETRY';
  overlayEl.classList.add('show');
  hintEl.classList.add('hidden');
}

function updateCamera(dt: number) {
  const targetCameraX = squadX * 0.18;
  const targetCameraZ = squadZ - 16.2;
  const targetCameraY = 16.8;

  camera.position.x += (targetCameraX - camera.position.x) * Math.min(1, dt * 6.2);
  camera.position.z += (targetCameraZ - camera.position.z) * Math.min(1, dt * 6.8);
  camera.position.y += (targetCameraY - camera.position.y) * Math.min(1, dt * 5.2);

  if (cameraShake > 0) {
    camera.position.x += (Math.random() - 0.5) * cameraShake;
    camera.position.y += (Math.random() - 0.5) * cameraShake * 0.45;
    cameraShake = Math.max(0, cameraShake - dt * 2.2);
  }

  camera.lookAt(squadX * 0.1, 0.55, squadZ + 15.5);
}

renderer.domElement.addEventListener('pointerdown', (event: PointerEvent) => {
  if (!running) return;

  pointerDown = true;
  pointerStartX = event.clientX;
  pointerStartTargetX = targetX;
  renderer.domElement.setPointerCapture(event.pointerId);
  hintEl.classList.add('hidden');
});

renderer.domElement.addEventListener('pointermove', (event: PointerEvent) => {
  if (!pointerDown || !running || phase === 'advance') return;

  const delta = (event.clientX - pointerStartX) / Math.max(280, window.innerWidth);
  targetX = THREE.MathUtils.clamp(pointerStartTargetX + delta * 13.2, -5.35, 5.35);
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

    updateAdvance(dt);

    shootTimer -= dt;
    if (shootTimer <= 0 && phase !== 'advance') {
      fireVolley();
      shootTimer = Math.max(0.075, 0.22 / fireRateMultiplier);
    }

    updateBullets(dt);

    const section = currentSection();
    if (section) section.horde.update(dt, time);
    commander.update(dt, time);

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.remove('show');
    }
  }

  updateParticles(dt);
  updateBlueFormation(time);
  updateCamera(dt);
  renderer.render(scene, camera);
}

syncHud();
setPhase('advance');
requestAnimationFrame(frame);
