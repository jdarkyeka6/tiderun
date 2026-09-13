import * as THREE from 'three';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <div id="hud">
    <div class="hud-row">
      <div class="pill" id="armyCount">🌊 8</div>
      <div class="pill" id="distance">0m</div>
    </div>
    <div id="progressWrap"><div id="progress"></div></div>
    <div id="bossWrap">
      <div id="bossLabel">BOSS · 666</div>
      <div id="bossBarOuter"><div id="bossBar"></div></div>
    </div>
    <div id="hint">Drag left and right · your squad fires automatically</div>
    <div id="overlay">
      <div id="resultCard">
        <h1 id="resultTitle">TIDERUN</h1>
        <p id="resultText"></p>
        <button id="restart" type="button">RUN AGAIN</button>
      </div>
    </div>
  </div>
`;

const armyEl = document.querySelector<HTMLElement>('#armyCount')!;
const distanceEl = document.querySelector<HTMLElement>('#distance')!;
const progressEl = document.querySelector<HTMLElement>('#progress')!;
const hintEl = document.querySelector<HTMLElement>('#hint')!;
const bossWrapEl = document.querySelector<HTMLElement>('#bossWrap')!;
const bossLabelEl = document.querySelector<HTMLElement>('#bossLabel')!;
const bossBarEl = document.querySelector<HTMLElement>('#bossBar')!;
const overlayEl = document.querySelector<HTMLElement>('#overlay')!;
const resultTitleEl = document.querySelector<HTMLElement>('#resultTitle')!;
const resultTextEl = document.querySelector<HTMLElement>('#resultText')!;
const restartButton = document.querySelector<HTMLButtonElement>('#restart')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ed8ff);
scene.fog = new THREE.Fog(0x8ed8ff, 35, 95);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 350);
camera.position.set(0, 8.5, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x304050, 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(8, 16, -4);
sun.castShadow = true;
scene.add(sun);

const track = new THREE.Mesh(
  new THREE.BoxGeometry(10, 0.45, 320),
  new THREE.MeshStandardMaterial({ color: 0xd9dde5, roughness: 0.82 })
);
track.position.set(0, -0.32, 145);
track.receiveShadow = true;
scene.add(track);

const edgeMat = new THREE.MeshStandardMaterial({ color: 0x27314a, roughness: 0.8 });
for (const x of [-5.25, 5.25]) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 320), edgeMat);
  rail.position.set(x, 0.05, 145);
  rail.receiveShadow = true;
  scene.add(rail);
}

const MAX_SOLDIERS = 400;
const RUN_END_Z = 236;
const soldierGeo = new THREE.CapsuleGeometry(0.16, 0.42, 3, 7);
const soldierMat = new THREE.MeshStandardMaterial({ color: 0x168cff, roughness: 0.45 });
const soldiers = new THREE.InstancedMesh(soldierGeo, soldierMat, MAX_SOLDIERS);
soldiers.castShadow = true;
soldiers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(soldiers);

const dummy = new THREE.Object3D();
const bulletGeo = new THREE.SphereGeometry(0.07, 6, 6);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe665 });

type Bullet = { mesh: THREE.Mesh; x: number; z: number; damage: number };
const bullets: Bullet[] = [];

function makeLabel(initial: string, color = '#ffffff', background = 'rgba(10,16,30,.72)') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.5, 1.25, 1);

  const update = (text: string) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = background;
    roundRect(ctx, 16, 22, 224, 84, 30);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '900 48px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 65);
    texture.needsUpdate = true;
  };
  update(initial);
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

type GateKind = 'add' | 'multiply';

class Gate {
  x: number;
  z: number;
  kind: GateKind;
  value: number;
  maxValue: number;
  used = false;
  group = new THREE.Group();
  label: ReturnType<typeof makeLabel>;

  constructor(x: number, z: number, kind: GateKind, value: number, maxValue = value) {
    this.x = x;
    this.z = z;
    this.kind = kind;
    this.value = value;
    this.maxValue = maxValue;

    const frameMat = new THREE.MeshStandardMaterial({
      color: kind === 'add' ? 0x21a4ff : 0xffb31f,
      emissive: kind === 'add' ? 0x063a61 : 0x5a3000,
      emissiveIntensity: 0.35,
      roughness: 0.35
    });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.8, 0.16), frameMat);
    const right = left.clone();
    left.position.x = -1.3;
    right.position.x = 1.3;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.16, 0.16), frameMat);
    top.position.y = 1.35;
    this.group.add(left, right, top);
    this.group.position.set(x, 1.35, z);
    scene.add(this.group);

    this.label = makeLabel(this.text(), '#ffffff', kind === 'add' ? 'rgba(0,116,205,.88)' : 'rgba(199,115,0,.9)');
    this.label.sprite.position.set(x, 3.4, z);
    scene.add(this.label.sprite);
  }

  text() {
    return this.kind === 'add' ? `+${this.value}` : `×${this.value}`;
  }

  shoot() {
    if (this.used || this.kind !== 'add' || this.value >= this.maxValue) return;
    this.value += 1;
    this.label.update(this.text());
  }

  apply() {
    if (this.used) return;
    if (this.kind === 'add') setArmy(army + this.value);
    else setArmy(army * this.value);
    this.used = true;
    this.group.visible = false;
    this.label.sprite.visible = false;
  }

  miss() {
    if (this.used) return;
    this.used = true;
    this.group.visible = false;
    this.label.sprite.visible = false;
  }
}

class Horde {
  x: number;
  z: number;
  count: number;
  width: number;
  mesh: THREE.InstancedMesh;
  label: ReturnType<typeof makeLabel>;
  offsets: THREE.Vector3[] = [];
  dead = false;
  speed: number;

  constructor(x: number, z: number, count: number, width = 6.3, speed = 0.5) {
    this.x = x;
    this.z = z;
    this.count = count;
    this.width = width;
    this.speed = speed;

    const geo = new THREE.CapsuleGeometry(0.16, 0.38, 3, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf04458, roughness: 0.48 });
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(count, 1));
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    for (let i = 0; i < count; i++) {
      const columns = Math.max(4, Math.floor(width / 0.48));
      const row = Math.floor(i / columns);
      const col = i % columns;
      const rowCount = Math.min(columns, count - row * columns);
      const xx = (col - (rowCount - 1) / 2) * 0.48;
      const zz = row * 0.48 + (Math.random() - 0.5) * 0.08;
      this.offsets.push(new THREE.Vector3(xx, 0.48, zz));
    }

    this.label = makeLabel(String(count), '#ffffff', 'rgba(177,27,49,.9)');
    scene.add(this.label.sprite);
    this.refresh();
  }

  refresh() {
    this.mesh.count = Math.max(0, this.count);
    for (let i = 0; i < this.count; i++) {
      const o = this.offsets[i];
      dummy.position.set(this.x + o.x, o.y, this.z + o.z);
      dummy.rotation.set(0, Math.PI, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.label.update(String(Math.max(0, this.count)));
    this.label.sprite.position.set(this.x, 3.25, this.z);
  }

  hit(damage: number) {
    if (this.dead) return;
    this.count = Math.max(0, this.count - damage);
    if (this.count <= 0) this.destroy();
    else this.refresh();
  }

  update(dt: number) {
    if (this.dead) return;
    const gap = this.z - squadZ;
    if (gap < 20 && gap > 1.5) {
      this.z -= this.speed * dt;
      this.refresh();
    }
    if (gap <= 1.55) {
      const loss = Math.min(army, Math.max(1, Math.ceil(this.count * 0.62)));
      setArmy(army - loss);
      this.destroy();
      if (army <= 0) finish(false, 'The red wave swallowed the squad.');
    }
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    scene.remove(this.mesh, this.label.sprite);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    (this.label.sprite.material as THREE.SpriteMaterial).map?.dispose();
    (this.label.sprite.material as THREE.SpriteMaterial).dispose();
  }
}

class Boss {
  z = 224;
  x = 0;
  maxHealth = 666;
  health = 666;
  dead = false;
  group = new THREE.Group();

  constructor() {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.95, 1.75, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x8d1734, roughness: 0.35, metalness: 0.05 })
    );
    body.castShadow = true;
    body.position.y = 1.35;
    this.group.add(body);

    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 0.75, 5),
      new THREE.MeshStandardMaterial({ color: 0xffb522, metalness: 0.3, roughness: 0.35 })
    );
    crown.position.y = 3.25;
    crown.rotation.y = Math.PI / 5;
    this.group.add(crown);
    this.group.position.set(this.x, 0, this.z);
    scene.add(this.group);
  }

  hit(damage: number) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - damage);
    bossWrapEl.style.display = 'block';
    bossLabelEl.textContent = `BOSS · ${this.health}`;
    bossBarEl.style.width = `${(this.health / this.maxHealth) * 100}%`;
    if (this.health <= 0) {
      this.dead = true;
      scene.remove(this.group);
      finish(true, `${army} soldiers made it through.`);
    }
  }

  update(dt: number) {
    if (this.dead) return;
    const gap = this.z - squadZ;
    if (gap < 30 && gap > 2.2) {
      this.z -= 0.75 * dt;
      this.group.position.z = this.z;
      bossWrapEl.style.display = 'block';
    }
    if (gap <= 2.2) {
      setArmy(army - Math.max(1, Math.ceil(18 * dt)));
      if (army <= 0) finish(false, 'The 666 HP boss ended the run.');
    }
  }
}

let army = 8;
let squadX = 0;
let targetX = 0;
let squadZ = 0;
let running = true;
let shootTimer = 0;
let elapsed = 0;
let hintTimer = 0;
let pointerDown = false;
let pointerStartX = 0;
let targetAtPointerStart = 0;

const gates: Gate[] = [
  new Gate(-2.55, 30, 'add', 1, 25),
  new Gate(2.55, 30, 'add', 1, 40),
  new Gate(-2.55, 78, 'multiply', 2),
  new Gate(2.55, 78, 'add', 20, 45),
  new Gate(-2.55, 126, 'add', 1, 99),
  new Gate(2.55, 126, 'multiply', 2),
  new Gate(-2.55, 176, 'add', 35, 70),
  new Gate(2.55, 176, 'add', 1, 99)
];

const hordes: Horde[] = [
  new Horde(0, 51, 24, 6.4, 0.48),
  new Horde(0, 100, 58, 7.2, 0.58),
  new Horde(0, 151, 95, 7.8, 0.64),
  new Horde(0, 199, 135, 8.3, 0.72)
];

const boss = new Boss();

function setArmy(value: number) {
  army = THREE.MathUtils.clamp(Math.floor(value), 0, MAX_SOLDIERS);
  armyEl.textContent = `🌊 ${army}`;
  soldiers.count = army;
}

function updateSoldiers() {
  const columns = Math.max(2, Math.min(18, Math.ceil(Math.sqrt(Math.max(army, 1) * 1.35))));
  const spacingX = 0.43;
  const spacingZ = 0.46;
  for (let i = 0; i < army; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const rowCount = Math.min(columns, army - row * columns);
    const x = squadX + (col - (rowCount - 1) / 2) * spacingX;
    const z = squadZ - row * spacingZ;
    dummy.position.set(x, 0.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    soldiers.setMatrixAt(i, dummy.matrix);
  }
  soldiers.instanceMatrix.needsUpdate = true;
}

function fireVolley() {
  if (!running || army <= 0) return;
  const shots = Math.min(14, Math.max(1, Math.ceil(army / 7)));
  const damage = Math.max(1, Math.floor(army / shots / 2.4));
  const spread = Math.min(3.6, 0.34 * (shots - 1));
  for (let i = 0; i < shots; i++) {
    if (bullets.length >= 150) break;
    const t = shots === 1 ? 0.5 : i / (shots - 1);
    const x = squadX - spread / 2 + spread * t;
    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    mesh.position.set(x, 0.72, squadZ + 1.0);
    scene.add(mesh);
    bullets.push({ mesh, x, z: squadZ + 1.0, damage });
  }
}

function updateBullets(dt: number) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const previousZ = b.z;
    b.z += 24 * dt;
    b.mesh.position.z = b.z;
    let consumed = false;

    for (const gate of gates) {
      if (gate.used || b.x < gate.x - 1.35 || b.x > gate.x + 1.35) continue;
      if (previousZ <= gate.z && b.z >= gate.z) {
        gate.shoot();
        consumed = true;
        break;
      }
    }

    if (!consumed) {
      for (const h of hordes) {
        if (h.dead || Math.abs(b.x - h.x) > h.width / 2) continue;
        if (previousZ <= h.z + 1.0 && b.z >= h.z - 0.7) {
          h.hit(b.damage);
          consumed = true;
          break;
        }
      }
    }

    if (!consumed && !boss.dead && Math.abs(b.x - boss.x) < 1.35 && previousZ <= boss.z + 1.1 && b.z >= boss.z - 1.1) {
      boss.hit(b.damage);
      consumed = true;
    }

    if (consumed || b.z > squadZ + 48) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }
}

function updateGates() {
  const groups = new Map<number, Gate[]>();
  for (const gate of gates) {
    if (gate.used) continue;
    const arr = groups.get(gate.z) ?? [];
    arr.push(gate);
    groups.set(gate.z, arr);
  }
  for (const [z, pair] of groups) {
    if (squadZ < z) continue;
    let chosen: Gate | undefined;
    let best = Infinity;
    for (const gate of pair) {
      const d = Math.abs(squadX - gate.x);
      if (d < best && d < 1.75) {
        best = d;
        chosen = gate;
      }
    }
    for (const gate of pair) {
      if (gate === chosen) gate.apply();
      else gate.miss();
    }
  }
}

function finish(won: boolean, text: string) {
  if (!running) return;
  running = false;
  resultTitleEl.textContent = won ? 'RUN CLEARED 🌊' : 'WIPED OUT';
  resultTextEl.textContent = text;
  overlayEl.style.display = 'flex';
  hintEl.style.opacity = '0';
}

function updateCamera() {
  camera.position.x += (squadX * 0.34 - camera.position.x) * 0.08;
  camera.position.z += ((squadZ - 10.2) - camera.position.z) * 0.13;
  camera.position.y = 8.4;
  camera.lookAt(squadX * 0.22, 0.8, squadZ + 8.8);
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = true;
  pointerStartX = event.clientX;
  targetAtPointerStart = targetX;
  renderer.domElement.setPointerCapture(event.pointerId);
  hintTimer = 2;
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!pointerDown || !running) return;
  const delta = (event.clientX - pointerStartX) / Math.max(260, window.innerWidth);
  targetX = THREE.MathUtils.clamp(targetAtPointerStart + delta * 9.2, -3.7, 3.7);
});

const releasePointer = (event: PointerEvent) => {
  pointerDown = false;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
};
renderer.domElement.addEventListener('pointerup', releasePointer);
renderer.domElement.addEventListener('pointercancel', releasePointer);

restartButton.addEventListener('click', () => window.location.reload());

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

let previous = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;

  if (running) {
    elapsed += dt;
    squadX += (targetX - squadX) * Math.min(1, dt * 11);
    squadZ += 5.1 * dt;

    shootTimer -= dt;
    if (shootTimer <= 0) {
      fireVolley();
      shootTimer = 0.22;
    }

    updateBullets(dt);
    updateGates();
    for (const horde of hordes) horde.update(dt);
    boss.update(dt);

    if (squadZ >= RUN_END_Z && !boss.dead) finish(false, 'The boss survived the run.');

    distanceEl.textContent = `${Math.floor(squadZ)}m`;
    progressEl.style.width = `${THREE.MathUtils.clamp((squadZ / RUN_END_Z) * 100, 0, 100)}%`;

    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) hintEl.style.opacity = '0';
    }
  }

  updateSoldiers();
  updateCamera();
  renderer.render(scene, camera);
}

setArmy(8);
updateSoldiers();
requestAnimationFrame(frame);
