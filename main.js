import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';

// ------------------------------------------------------------------
// DOM
// ------------------------------------------------------------------
const app = document.getElementById('app');
const blocker = document.getElementById('blocker');
const startBtn = document.getElementById('startBtn');
const loading = document.getElementById('loading');
const crosshair = document.getElementById('crosshair');
const hud = document.getElementById('hud');
const hpFill = document.getElementById('hpFill');
const ammoText = document.getElementById('ammoText');
const weaponNameEl = document.getElementById('weaponName');
const spinBarWrap = document.getElementById('spinBarWrap');
const spinBar = document.getElementById('spinBar');
const centerMsg = document.getElementById('centerMsg');
const roundBanner = document.getElementById('roundBanner');
const moneyBadge = document.getElementById('moneyBadge');
const scoreRedEl = document.getElementById('scoreRed');
const scoreBlueEl = document.getElementById('scoreBlue');
const scoreBoardEl = document.getElementById('scoreBoard');
const touchLayer = document.getElementById('touchLayer');
const blockerDesktopText = document.getElementById('blockerDesktopText');
const blockerTouchText = document.getElementById('blockerTouchText');
const joyZoneL = document.getElementById('joyZoneL');
const joyStickL = document.getElementById('joyStickL');
const fireBtn = document.getElementById('fireBtn');
const jumpBtn = document.getElementById('jumpBtn');
const crouchBtn = document.getElementById('crouchBtn');
const reloadBtnTouch = document.getElementById('reloadBtnTouch');
const sprintBtn = document.getElementById('sprintBtn');
const lookHint = document.getElementById('lookHint');
const teamSelect = document.getElementById('teamSelect');
const sizeSelect = document.getElementById('sizeSelect');
const sizeChoicesEl = document.getElementById('sizeChoices');
const readyScreen = document.getElementById('readyScreen');
const teamRedBtn = document.getElementById('teamRed');
const teamBlueBtn = document.getElementById('teamBlue');
const teamChosenBadge = document.getElementById('teamChosenBadge');
const weaponMenuBtn = document.getElementById('weaponMenuBtn');
const weaponMenu = document.getElementById('weaponMenu');

const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;

// ------------------------------------------------------------------
// THREE SETUP
// ------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb4d9);
scene.fog = new THREE.Fog(0x8fb4d9, 35, 140);

const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 500);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

function handleResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', handleResize);
addEventListener('orientationchange', () => setTimeout(handleResize, 250));
addEventListener('contextmenu', (e) => e.preventDefault());

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x445033, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4d6, 1.6);
sun.position.set(30, 45, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 160;
sun.shadow.bias = -0.0015;
scene.add(sun);

// Weapon viewmodel rig: bir grup kameraya bağlanır, silahlar bu grubun altında değişir
const weaponRig = new THREE.Group();
camera.add(weaponRig);
scene.add(camera);

// ------------------------------------------------------------------
// PHYSICS (RAPIER)
// ------------------------------------------------------------------
await RAPIER.init();
const gravity = { x: 0, y: -22.0, z: 0 };
const world = new RAPIER.World(gravity);
const obstacleMeshes = []; // duvar/kutu gibi engeller — bot'ların görüş hattı kontrolü için

function makeCanvasTexture(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  draw(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Çivili ahşap sandık dokusu
const woodTexture = makeCanvasTexture((ctx) => {
  ctx.fillStyle = '#8a5a34'; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 46; i++) {
    const y = Math.random() * 256;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(80, y + 8, 170, y - 8, 256, y); ctx.stroke();
  }
  const rows = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 3;
  for (let i = 1; i < rows; i++) { ctx.beginPath(); ctx.moveTo(0, i * 256 / rows); ctx.lineTo(256, i * 256 / rows); ctx.stroke(); }
  ctx.fillStyle = '#231609';
  for (let i = 0; i < rows; i++) {
    for (const x of [14, 242]) { ctx.beginPath(); ctx.arc(x, i * 256 / rows + 256 / rows / 2, 5, 0, 7); ctx.fill(); }
  }
});

// Tuğla/beton duvar dokusu
const wallTexture = makeCanvasTexture((ctx) => {
  ctx.fillStyle = '#8f8f95'; ctx.fillRect(0, 0, 256, 256);
  const rowH = 28;
  for (let row = 0; row * rowH < 256; row++) {
    const offset = (row % 2) * 32;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, row * rowH); ctx.lineTo(256, row * rowH); ctx.stroke();
    for (let x = -offset; x < 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, row * rowH); ctx.lineTo(x, row * rowH + rowH); ctx.stroke(); }
  }
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
});

function addStaticBox(x, y, z, sx, sy, sz, color, castShadow = true, texType = null) {
  let material;
  if (texType === 'wood' || texType === 'wall') {
    const tex = (texType === 'wood' ? woodTexture : wallTexture).clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(0.6, sx / 1.6), Math.max(0.6, sy / 1.6));
    material = new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.95, metalness: 0.02 });
  } else {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 });
  }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacleMeshes.push(mesh);

  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2), rb);
  return mesh;
}

// ---- HARİTA: "Yayla" — büyütülmüş, detaylandırılmış taktik harita ----
// Zemin
addStaticBox(0, -0.5, 0, 110, 1, 110, 0xb79d6f, false);
// Dış duvarlar (tuğla/beton doku)
addStaticBox(0, 3.5, -55, 110, 7, 1, 0x8f8f95, true, 'wall');
addStaticBox(0, 3.5, 55, 110, 7, 1, 0x8f8f95, true, 'wall');
addStaticBox(-55, 3.5, 0, 1, 7, 110, 0x8f8f95, true, 'wall');
addStaticBox(55, 3.5, 0, 1, 7, 110, 0x8f8f95, true, 'wall');

// Orta koridor ve siper yapıları (ahşap sandıklar)
addStaticBox(-8, 1, -6, 3, 2, 3, 0xc89968, true, 'wood');
addStaticBox(8, 1.1, 4, 3, 2.2, 3, 0xc89968, true, 'wood');
addStaticBox(0, 0.8, -18, 5, 1.6, 2, 0xc89968, true, 'wood');
addStaticBox(-3, 0.8, 20, 4, 1.6, 2, 0xc89968, true, 'wood');
addStaticBox(3, 0.75, -30, 3, 1.5, 2, 0xc89968, true, 'wood');

// Duvar parçaları (siper hattı, beton doku)
addStaticBox(-18, 1.5, 12, 3, 3, 1, 0x9a9aa0, true, 'wall');
addStaticBox(18, 1.5, -12, 3, 3, 1, 0x9a9aa0, true, 'wall');
addStaticBox(-30, 1.6, -6, 1, 3.2, 8, 0x9a9aa0, true, 'wall');
addStaticBox(30, 1.6, 6, 1, 3.2, 8, 0x9a9aa0, true, 'wall');
addStaticBox(0, 2, 0, 1, 4, 14, 0x9a9aa0, true, 'wall');

// Köşe yapı kümeleri (bina blokları)
addStaticBox(-20, 1.4, -34, 2.5, 2.8, 2.5, 0x76694f, true, 'wall');
addStaticBox(20, 1.4, 34, 2.5, 2.8, 2.5, 0x76694f, true, 'wall');
addStaticBox(-34, 1.4, 20, 2.5, 2.8, 2.5, 0x76694f, true, 'wall');
addStaticBox(34, 1.4, -20, 2.5, 2.8, 2.5, 0x76694f, true, 'wall');

// Dağınık ahşap sandıklar (detay + siper)
addStaticBox(14, 0.6, 22, 1.4, 1.2, 1.4, 0xc89968, true, 'wood');
addStaticBox(15.5, 0.6, 22, 1.4, 1.2, 1.4, 0xc89968, true, 'wood');
addStaticBox(-14, 0.6, -22, 1.4, 1.2, 1.4, 0xc89968, true, 'wood');
addStaticBox(-15.5, 0.6, -22, 1.4, 1.2, 1.4, 0xc89968, true, 'wood');
addStaticBox(-6, 0.6, 30, 1.4, 1.2, 1.4, 0xc89968, true, 'wood');
addStaticBox(6, 0.6, -34, 1.4, 1.2, 1.4, 0xc89968, true, 'wood');

// İki "bölge" alkovu (doğuş bölgeleri)
addStaticBox(-42, 2, -42, 16, 4, 1, 0x59575a, true, 'wall');
addStaticBox(-42, 2, -34, 1, 4, 10, 0x59575a, true, 'wall');
addStaticBox(42, 2, 42, 16, 4, 1, 0x59575a, true, 'wall');
addStaticBox(42, 2, 34, 1, 4, 10, 0x59575a, true, 'wall');

// Merkez kule (landmark + yükseklik avantajı)
addStaticBox(0, 4.5, 0, 3, 9, 3, 0x555a60, true, 'wall');
// Yan gözetleme platformları
addStaticBox(-38, 3.2, 0, 4, 0.4, 4, 0x555a60, true, 'wall');
addStaticBox(38, 3.2, 0, 4, 0.4, 4, 0x555a60, true, 'wall');

// ------------------------------------------------------------------
// TAKIMLAR VE DOĞUŞ BÖLGELERİ
// ------------------------------------------------------------------
const TEAMS = {
  red: { name: 'KIRMIZI', color: 0xff4757, spawn: new THREE.Vector3(-42, 2, -38) },
  blue: { name: 'MAVİ', color: 0x3b8ef0, spawn: new THREE.Vector3(42, 2, 38) }
};
let playerTeam = null;
let enemyTeam = null;

function hexStr(n) { return '#' + n.toString(16).padStart(6, '0'); }

function createZoneMarker(pos, color, label) {
  const decal = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false })
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(pos.x, 0.03, pos.z);
  scene.add(decal);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.9, 4.3, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.04, pos.z);
  scene.add(ring);

  // birkaç rastgele "sprey lekesi" ile daha organik bir görünüm
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2, d = 1 + Math.random() * 3.3;
    const blot = new THREE.Mesh(
      new THREE.CircleGeometry(0.3 + Math.random() * 0.5, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false })
    );
    blot.rotation.x = -Math.PI / 2;
    blot.position.set(pos.x + Math.cos(a) * d, 0.035, pos.z + Math.sin(a) * d);
    scene.add(blot);
  }

  // yazı: tuvale çizilip sprite olarak asılan pankart
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const c2d = canvas.getContext('2d');
  c2d.font = 'bold 60px Arial';
  c2d.textAlign = 'center'; c2d.textBaseline = 'middle';
  c2d.shadowColor = '#000000'; c2d.shadowBlur = 14;
  c2d.fillStyle = hexStr(color);
  c2d.fillText(label, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(8, 2, 1);
  sprite.position.set(pos.x, 4.3, pos.z);
  scene.add(sprite);
}

createZoneMarker(TEAMS.red.spawn, TEAMS.red.color, 'KIRMIZI ÜS');
createZoneMarker(TEAMS.blue.spawn, TEAMS.blue.color, 'MAVİ ÜS');

// ------------------------------------------------------------------
// KARAKTER CONTROLLER
// ------------------------------------------------------------------
const player = {
  pos: new THREE.Vector3(0, 2, 12),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: 0,
  hp: 100,
  maxHp: 100,
  speed: 6.2,
  sprintMul: 1.7,
  crouchMul: 0.5,
  crouching: false,
  jumpSpeed: 8.2,
  grounded: false,
  height: 1.7,
  radius: 0.35,
  money: 800
};

const capsuleDesc = RAPIER.ColliderDesc.capsule((player.height - player.radius * 2) / 2, player.radius)
  .setFriction(0.1);
const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(player.pos.x, player.pos.y, player.pos.z);
const playerBody = world.createRigidBody(playerBodyDesc);
world.createCollider(capsuleDesc, playerBody);
const characterController = world.createCharacterController(0.02);
characterController.setApplyImpulsesToDynamicBodies(true);
characterController.setSlideEnabled(true);
characterController.enableAutostep(0.4, 0.2, true);
characterController.enableSnapToGround(0.4);
characterController.setMaxSlopeClimbAngle(50 * Math.PI / 180);

// ------------------------------------------------------------------
// TAKIM SEÇİMİ VE BOYUTU
// ------------------------------------------------------------------
let teamSize = 1; // taraf başına oyuncu sayısı (1-1 .. 5-5)

function chooseTeam(team) {
  if (playerTeam) return; // sadece bir kere seçilebilir
  playerTeam = team;
  enemyTeam = team === 'red' ? 'blue' : 'red';
  const t = TEAMS[team];

  teamChosenBadge.textContent = t.name + ' TAKIM SEÇİLDİ';
  teamChosenBadge.style.background = hexStr(t.color) + '33';
  teamChosenBadge.style.color = hexStr(t.color);
  teamSelect.classList.add('hidden');
  sizeSelect.classList.remove('hidden');
}
function bindTeamBtn(el, team) {
  el.addEventListener('click', () => chooseTeam(team));
  el.addEventListener('touchstart', (e) => { e.preventDefault(); chooseTeam(team); }, { passive: false });
}
bindTeamBtn(teamRedBtn, 'red');
bindTeamBtn(teamBlueBtn, 'blue');

for (let n = 1; n <= 5; n++) {
  const btn = document.createElement('div');
  btn.className = 'sizeBtn';
  btn.textContent = n + '-' + n;
  function pick() {
    teamSize = n;
    sizeSelect.classList.add('hidden');
    readyScreen.classList.remove('hidden');

    const t = TEAMS[playerTeam];
    player.pos.set(t.spawn.x, t.spawn.y, t.spawn.z);
    playerBody.setNextKinematicTranslation({ x: t.spawn.x, y: t.spawn.y, z: t.spawn.z });

    setupBots();
    startRound(true);
  }
  btn.addEventListener('click', pick);
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); pick(); }, { passive: false });
  sizeChoicesEl.appendChild(btn);
}

// ------------------------------------------------------------------
// INPUT
// ------------------------------------------------------------------
const keys = new Set();
let pointerLocked = false; // sadece masaüstü fare kilidi durumu
let gameActive = false;    // hem masaüstü hem mobilde oyun döngüsünün çalışıp çalışmadığı
let verticalVel = 0;

function activateGame() {
  gameActive = true;
  blocker.classList.add('hidden');
  crosshair.classList.remove('hidden');
  hud.classList.remove('hidden');
  weaponMenuBtn.classList.remove('hidden');
  moneyBadge.classList.remove('hidden');
  scoreBoardEl.classList.remove('hidden');
  if (IS_TOUCH) {
    touchLayer.classList.remove('hidden');
    setTimeout(() => { lookHint.style.opacity = 0; }, 2600);
  }
}
function deactivateGame() {
  gameActive = false;
  blocker.classList.remove('hidden');
  crosshair.classList.add('hidden');
  hud.classList.add('hidden');
  touchLayer.classList.add('hidden');
  weaponMenuBtn.classList.add('hidden');
  weaponMenu.classList.add('hidden');
}

if (IS_TOUCH) {
  blockerDesktopText.classList.add('hidden');
  blockerTouchText.classList.remove('hidden');
  startBtn.textContent = 'DOKUN VE BAŞLA';
  startBtn.addEventListener('click', () => {
    // Mümkünse tam ekrana geç (daha sürükleyici mobil deneyim)
    const el = document.documentElement;
    if (el.requestFullscreen) { el.requestFullscreen().catch(() => {}); }
    activateGame();
  });
} else {
  startBtn.addEventListener('click', () => renderer.domElement.requestPointerLock());
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
    if (pointerLocked) activateGame(); else deactivateGame();
  });
}

addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') tryReload();
  if (e.code === 'KeyG') { setWeapon('bomb'); }
  const numMap = { Digit1: 'knife', Digit2: 'pistol', Digit3: 'lmg', Digit4: 'hmg', Digit5: 'minigun', Digit6: 'bomb' };
  if (numMap[e.code]) setWeapon(numMap[e.code]);
});
addEventListener('keyup', (e) => keys.delete(e.code));

addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch));
});

let mouseDown = false;
addEventListener('mousedown', (e) => { if (pointerLocked && e.button === 0) mouseDown = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });

// ------------------------------------------------------------------
// MOBİL DOKUNMATİK KONTROLLER
// ------------------------------------------------------------------
const touchMoveVec = { x: 0, y: 0 }; // x: sağ-sol, y: ileri(-1)/geri(+1)

// ---- Sol joystick: hareket ----
(function setupMoveJoystick() {
  let active = false, id = null, cx = 0, cy = 0;
  const maxDist = 42;

  function start(e) {
    const t = e.changedTouches[0];
    active = true; id = t.identifier;
    const rect = joyZoneL.getBoundingClientRect();
    cx = rect.left + rect.width / 2; cy = rect.top + rect.height / 2;
    handle(t);
    e.preventDefault(); e.stopPropagation();
  }
  function handle(t) {
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) { dx = dx / dist * maxDist; dy = dy / dist * maxDist; }
    joyStickL.style.left = (33 + dx) + 'px';
    joyStickL.style.top = (33 + dy) + 'px';
    touchMoveVec.x = dx / maxDist;
    touchMoveVec.y = dy / maxDist;
  }
  function move(e) {
    if (!active) return;
    for (const t of e.changedTouches) if (t.identifier === id) { handle(t); e.preventDefault(); e.stopPropagation(); }
  }
  function end(e) {
    for (const t of e.changedTouches) if (t.identifier === id) {
      active = false; id = null;
      touchMoveVec.x = 0; touchMoveVec.y = 0;
      joyStickL.style.left = '33px'; joyStickL.style.top = '33px';
    }
  }
  joyZoneL.addEventListener('touchstart', start, { passive: false });
  joyZoneL.addEventListener('touchmove', move, { passive: false });
  joyZoneL.addEventListener('touchend', end);
  joyZoneL.addEventListener('touchcancel', end);
})();

// ---- Ekranın geri kalanı: sürükleyerek bakış (kamera) ----
(function setupLookDrag() {
  let lookId = null, lastX = 0, lastY = 0;
  const SENS = 0.0045;

  function isUiControl(target) {
    return target.closest && target.closest('.touchBtn, #joyZoneL, #weaponSlots, .slot, #weaponMenuBtn, #weaponMenu, .weaponMenuItem, #teamChoices, .teamBtn');
  }

  window.addEventListener('touchstart', (e) => {
    if (!gameActive) return;
    for (const t of e.changedTouches) {
      if (lookId !== null) continue;
      if (isUiControl(t.target)) continue;
      lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (lookId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      const dx = t.clientX - lastX, dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
      player.yaw -= dx * SENS;
      player.pitch -= dy * SENS;
      player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch));
    }
  }, { passive: true });

  function release(e) {
    for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
  }
  window.addEventListener('touchend', release);
  window.addEventListener('touchcancel', release);
})();

// ---- Ateş / zıpla / doldur / koş düğmeleri ----
function bindHoldButton(el, onDown, onUp) {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('pressed'); onDown(); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('pressed'); onUp && onUp(); }, { passive: false });
  el.addEventListener('touchcancel', (e) => { el.classList.remove('pressed'); onUp && onUp(); });
}

bindHoldButton(fireBtn, () => { mouseDown = true; }, () => { mouseDown = false; });
bindHoldButton(jumpBtn, () => { keys.add('Space'); }, () => { keys.delete('Space'); });
bindHoldButton(reloadBtnTouch, () => { tryReload(); }, null);
bindHoldButton(crouchBtn, () => { keys.add('KeyC'); }, () => { keys.delete('KeyC'); });

let sprintToggled = false;
sprintBtn.addEventListener('touchstart', (e) => {
  e.preventDefault(); e.stopPropagation();
  sprintToggled = !sprintToggled;
  sprintBtn.classList.toggle('pressed', sprintToggled);
  if (sprintToggled) keys.add('ShiftLeft'); else keys.delete('ShiftLeft');
}, { passive: false });

// ------------------------------------------------------------------
// SİLAH SİSTEMİ
// ------------------------------------------------------------------
const weaponModels = {};
for (const key of WEAPON_ORDER) {
  const w = WEAPONS[key];
  const model = w.buildModel();
  model.position.copy(w.viewOffset);
  model.visible = false;
  weaponRig.add(model);
  weaponModels[key] = model;
}

const ownedWeapons = {};
WEAPON_ORDER.forEach((key) => { ownedWeapons[key] = !!WEAPONS[key].alwaysOwned || WEAPONS[key].kind === 'throwable'; });

function canAfford(key) { return player.money >= WEAPONS[key].price; }
function updateMoneyBadge() { moneyBadge.textContent = '$' + player.money; }

// ---- Üstten açılır silah menüsü (EKRANDAKİ TEK silah seçim arayüzü) ----
WEAPON_ORDER.forEach((key) => {
  const w = WEAPONS[key];
  const item = document.createElement('div');
  item.className = 'weaponMenuItem';
  item.id = 'menu-' + key;
  item.innerHTML = `<span>${w.name}</span><span class="k">${IS_TOUCH ? '' : ('Tuş ' + w.key)}</span><span class="price"></span>`;
  function pick() { buyOrEquip(key); }
  item.addEventListener('click', pick);
  item.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); pick(); }, { passive: false });
  weaponMenu.appendChild(item);
});

function refreshWeaponMenuAffordability() {
  WEAPON_ORDER.forEach((key) => {
    const w = WEAPONS[key];
    const item = document.getElementById('menu-' + key);
    if (!item) return;
    const priceEl = item.querySelector('.price');
    item.classList.remove('locked');
    if (w.kind === 'throwable') {
      priceEl.textContent = (ammoState[key] ?? 0) + ' adet · +1 $' + w.price;
      priceEl.classList.toggle('cant', !canAfford(key));
    } else if (w.alwaysOwned) {
      priceEl.textContent = 'DAHİL'; priceEl.classList.remove('cant');
    } else if (ownedWeapons[key]) {
      priceEl.textContent = 'SAHİP'; priceEl.classList.remove('cant');
    } else {
      priceEl.textContent = '$' + w.price;
      const cant = !canAfford(key);
      priceEl.classList.toggle('cant', cant);
      item.classList.toggle('locked', cant);
    }
  });
}

function buyOrEquip(key) {
  const w = WEAPONS[key];
  if (w.kind === 'throwable') {
    if (currentWeaponKey !== key) { setWeapon(key); }
    else if (ammoState[key] < 5 && canAfford(key)) {
      player.money -= w.price; ammoState[key]++;
      updateMoneyBadge(); updateHudWeapon(); refreshWeaponMenuAffordability();
    }
    weaponMenu.classList.add('hidden');
    return;
  }
  if (ownedWeapons[key]) { setWeapon(key); weaponMenu.classList.add('hidden'); return; }
  if (!canAfford(key)) { centerMessage('YETERSİZ PARA'); return; }
  player.money -= w.price;
  ownedWeapons[key] = true;
  updateMoneyBadge();
  refreshWeaponMenuAffordability();
  setWeapon(key);
  weaponMenu.classList.add('hidden');
}

function toggleWeaponMenu() { weaponMenu.classList.toggle('hidden'); }
weaponMenuBtn.addEventListener('click', toggleWeaponMenu);
weaponMenuBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); toggleWeaponMenu(); }, { passive: false });

const ammoState = {};
for (const key of WEAPON_ORDER) {
  const w = WEAPONS[key];
  if (w.mag != null) ammoState[key] = w.mag;
  if (w.count != null) ammoState[key] = w.count;
}

let currentWeaponKey = 'pistol';
let lastShotTime = 0;
let reloading = false;
let reloadEndsAt = 0;
let spinUp = 0; // 0..1 minigun spin durumu

function setWeapon(key) {
  if (!ownedWeapons[key]) return;
  if (key === currentWeaponKey) return;
  weaponModels[currentWeaponKey].visible = false;
  currentWeaponKey = key;
  weaponModels[currentWeaponKey].visible = true;
  reloading = false;
  spinUp = 0;
  document.querySelectorAll('.weaponMenuItem').forEach((el) => el.classList.remove('active'));
  const menuItem = document.getElementById('menu-' + key);
  if (menuItem) menuItem.classList.add('active');
  updateHudWeapon();
}
weaponModels[currentWeaponKey].visible = true;
document.getElementById('menu-' + currentWeaponKey).classList.add('active');
updateMoneyBadge();
refreshWeaponMenuAffordability();

function tryReload() {
  const w = WEAPONS[currentWeaponKey];
  if (w.kind === 'melee' || w.kind === 'throwable') return;
  if (reloading || ammoState[currentWeaponKey] === w.mag) return;
  reloading = true;
  reloadEndsAt = performance.now() + w.reloadMs;
  centerMessage('DOLDURULUYOR');
}

function centerMessage(text) {
  centerMsg.textContent = text;
  centerMsg.style.opacity = 1;
  clearTimeout(centerMessage._t);
  centerMessage._t = setTimeout(() => (centerMsg.style.opacity = 0), 700);
}

function updateHudWeapon() {
  const w = WEAPONS[currentWeaponKey];
  weaponNameEl.textContent = w.name;
  if (w.kind === 'melee') ammoText.textContent = '—';
  else if (w.kind === 'throwable') ammoText.textContent = ammoState[currentWeaponKey] + ' ADET';
  else ammoText.textContent = (reloading ? '…' : ammoState[currentWeaponKey]) + ' / ' + w.mag;
  spinBarWrap.classList.toggle('hidden', w.kind !== 'hitscan' || !w.spinUpMs);
}

// ---- mermi/hasar efektleri ----
const tracerGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 5);
function spawnTracer(from, to, color) {
  const dist = from.distanceTo(to);
  const mesh = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
  mesh.scale.set(1, dist, 1);
  mesh.position.copy(from).lerp(to, 0.5);
  mesh.lookAt(to);
  mesh.rotateX(Math.PI / 2);
  scene.add(mesh);
  const start = performance.now();
  function fade() {
    const t = (performance.now() - start) / 120;
    if (t >= 1) { scene.remove(mesh); return; }
    mesh.material.opacity = 0.85 * (1 - t);
    requestAnimationFrame(fade);
  }
  fade();
}

// Vurulan yüzeyde bırakılan mermi izi (2-3 sn sonra silinir)
const bulletHoleGeo = new THREE.CircleGeometry(1, 10);
function spawnBulletDecal(pos, normal) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x161616, transparent: true, opacity: 0.85, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
  });
  const decal = new THREE.Mesh(bulletHoleGeo, mat);
  const scale = 0.05 + Math.random() * 0.035;
  decal.scale.set(scale, scale, scale);
  decal.position.copy(pos).addScaledVector(normal, 0.015);
  decal.lookAt(pos.clone().add(normal));
  scene.add(decal);

  const life = 2000 + Math.random() * 1000; // 2-3 sn
  const start = performance.now();
  function fade() {
    const t = performance.now() - start;
    if (t >= life) { scene.remove(decal); return; }
    if (t > life - 400) mat.opacity = 0.85 * (1 - (t - (life - 400)) / 400);
    requestAnimationFrame(fade);
  }
  fade();
}

const particles = [];
function spawnBurst(pos, color, count = 10) {
  const geo = new THREE.SphereGeometry(0.05, 5, 5);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    m.position.copy(pos);
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
    const speed = 2 + Math.random() * 5;
    scene.add(m);
    particles.push({
      mesh: m,
      vel: new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e) + 1, Math.sin(a) * Math.cos(e)).multiplyScalar(speed),
      life: 0.5 + Math.random() * 0.3
    });
  }
}

// ------------------------------------------------------------------
// DÜŞMAN (insansı, fizik tabanlı, duvarlardan geçemez)
// ------------------------------------------------------------------
function buildHumanoid(teamColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xcf9a6c, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x272b31, roughness: 0.85 });
  const boots = new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.6 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), skin);
  head.position.y = 1.48;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.24), shirt);
  torso.position.y = 1.07;
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), pants);
  hips.position.y = 0.72;

  function buildLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.62, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.17), pants);
    upper.position.y = -0.26;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.25), boots);
    foot.position.set(0, -0.565, 0.05);
    pivot.add(upper, foot);
    return pivot;
  }
  function buildArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.27, 1.3, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.15), shirt);
    upper.position.y = -0.23;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), skin);
    hand.position.y = -0.48;
    pivot.add(upper, hand);
    return pivot;
  }

  const legL = buildLeg(-1), legR = buildLeg(1);
  const armL = buildArm(-1), armR = buildArm(1);

  g.add(head, torso, hips, legL, legR, armL, armR);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.baseColor = o.material.color.clone(); } });
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

const BOT_HEIGHT = 1.7, BOT_RADIUS = 0.35;
const BOT_FOOT_OFFSET = BOT_RADIUS + (BOT_HEIGHT - BOT_RADIUS * 2) / 2; // kapsül merkezi -> ayak

let bots = [];

function createBot(team) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -200, 0));
  world.createCollider(
    RAPIER.ColliderDesc.capsule((BOT_HEIGHT - BOT_RADIUS * 2) / 2, BOT_RADIUS).setFriction(0.1),
    body
  );
  const controller = world.createCharacterController(0.02);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setSlideEnabled(true);
  controller.enableAutostep(0.4, 0.2, true);
  controller.enableSnapToGround(0.4);
  controller.setMaxSlopeClimbAngle(50 * Math.PI / 180);

  const mesh = buildHumanoid(TEAMS[team].color);
  mesh.visible = false;
  scene.add(mesh);

  return {
    team, body, controller, mesh,
    hp: 100, maxHp: 100, alive: false,
    verticalVel: 0, grounded: false, walkPhase: 0,
    speedMode: 'walk', crouching: false, actionTimer: 2, jumpCooldown: 0,
    lastHitFlash: 0, fireTimer: 0.6 + Math.random(), preferredRange: 9 + Math.random() * 8, blockedTime: 0
  };
}

function setupBots() {
  for (const b of bots) { scene.remove(b.mesh); world.removeRigidBody(b.body); }
  bots = [];
  for (let i = 0; i < teamSize - 1; i++) bots.push(createBot(playerTeam));   // takım arkadaşları
  for (let i = 0; i < teamSize; i++) bots.push(createBot(enemyTeam));        // rakip takım
}

function respawnAllBots() {
  for (const b of bots) {
    const spawn = TEAMS[b.team].spawn;
    const ox = (Math.random() - 0.5) * 6, oz = (Math.random() - 0.5) * 6;
    b.body.setNextKinematicTranslation({ x: spawn.x + ox, y: spawn.y, z: spawn.z + oz });
    b.hp = b.maxHp; b.alive = true; b.verticalVel = 0;
    b.speedMode = 'walk'; b.crouching = false;
    b.actionTimer = 1 + Math.random() * 2; b.fireTimer = 0.6 + Math.random();
    b.mesh.visible = true; b.mesh.scale.y = 1;
  }
}

function damageBot(bot, amount, hitPos) {
  if (!bot.alive) return;
  bot.hp -= amount;
  bot.lastHitFlash = performance.now();
  spawnBurst(hitPos, 0xff5c5c, 8);
  if (bot.hp <= 0) {
    bot.alive = false;
    spawnBurst(bot.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xffb703, 22);
    bot.mesh.visible = false;
    bot.body.setNextKinematicTranslation({ x: 0, y: -200, z: 0 });
    checkRoundEnd();
  }
}

function getNearestTarget(bot) {
  let best = null, bestDist = Infinity;
  if (bot.team !== playerTeam && player.hp > 0) {
    const d = bot.mesh.position.distanceTo(player.pos);
    best = { pos: player.pos, isPlayer: true }; bestDist = d;
  }
  for (const other of bots) {
    if (other === bot || !other.alive || other.team === bot.team) continue;
    const d = bot.mesh.position.distanceTo(other.mesh.position);
    if (d < bestDist) { bestDist = d; best = { pos: other.mesh.position, isPlayer: false, bot: other }; }
  }
  return best;
}

// ------------------------------------------------------------------
// TUR / SKOR / EKONOMİ
// ------------------------------------------------------------------
const WIN_SCORE = 10;
const score = { red: 0, blue: 0 };
let roundActive = false;

function updateScoreboard() {
  scoreRedEl.textContent = score.red;
  scoreBlueEl.textContent = score.blue;
}

function showRoundBanner(text) {
  roundBanner.textContent = text;
  roundBanner.style.opacity = 1;
  clearTimeout(showRoundBanner._t);
  showRoundBanner._t = setTimeout(() => (roundBanner.style.opacity = 0), 2000);
}

function startRound(first) {
  roundActive = true;
  respawnAllBots();
  const t = TEAMS[playerTeam];
  player.hp = player.maxHp;
  player.pos.set(t.spawn.x, t.spawn.y, t.spawn.z);
  playerBody.setNextKinematicTranslation({ x: t.spawn.x, y: t.spawn.y, z: t.spawn.z });
  if (!first) showRoundBanner('YENİ TUR — HERKES BÖLGESİNDEN DOĞDU');
}

function endRound(winnerTeam) {
  if (!roundActive) return;
  roundActive = false;
  score[winnerTeam]++;
  updateScoreboard();

  const won = winnerTeam === playerTeam;
  player.money += won ? 500 : 200;
  updateMoneyBadge();
  refreshWeaponMenuAffordability();

  showRoundBanner(TEAMS[winnerTeam].name + ' TAKIM TURU KAZANDI');

  if (score[winnerTeam] >= WIN_SCORE) {
    setTimeout(() => endGame(winnerTeam), 1800);
    return;
  }
  setTimeout(() => startRound(false), 2400);
}

function checkRoundEnd() {
  if (!roundActive) return;
  const enemyAlive = bots.some((b) => b.team === enemyTeam && b.alive);
  if (!enemyAlive) endRound(playerTeam);
}

function endGame(winnerTeam) {
  gameActive = false;
  const overlay = document.getElementById('endScreen');
  document.getElementById('endTitle').textContent = TEAMS[winnerTeam].name + ' TAKIM KAZANDI!';
  document.getElementById('endSub').textContent = 'Skor: ' + score.red + ' — ' + score.blue;
  overlay.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
document.getElementById('restartBtn').addEventListener('click', () => location.reload());
document.getElementById('restartBtn').addEventListener('touchstart', (e) => { e.preventDefault(); location.reload(); }, { passive: false });

// ------------------------------------------------------------------
// BOMBA (fizik tabanlı fırlatma + patlama)
// ------------------------------------------------------------------
const activeBombs = [];
function throwBomb() {
  const w = WEAPONS.bomb;
  if (ammoState.bomb <= 0) { centerMessage('BOMBA YOK'); return; }
  ammoState.bomb--;
  updateHudWeapon();

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const startPos = camera.getWorldPosition(new THREE.Vector3()).add(dir.clone().multiplyScalar(0.6));

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), new THREE.MeshStandardMaterial({ color: 0x2b2f33 }));
  mesh.castShadow = true;
  mesh.position.copy(startPos);
  scene.add(mesh);

  const rbDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(startPos.x, startPos.y, startPos.z)
    .setLinvel(dir.x * w.throwSpeed, dir.y * w.throwSpeed + 3, dir.z * w.throwSpeed)
    .setAngularDamping(0.4).setLinearDamping(0.05);
  const rb = world.createRigidBody(rbDesc);
  world.createCollider(RAPIER.ColliderDesc.ball(0.12).setRestitution(0.35).setFriction(0.6), rb);

  activeBombs.push({ mesh, rb, spawnedAt: performance.now(), fuseMs: w.fuseMs, exploded: false });
}

function explodeBomb(bomb) {
  bomb.exploded = true;
  const pos = bomb.mesh.position.clone();
  spawnBurst(pos, 0xffa640, 30);
  for (const b of bots) {
    if (!b.alive || b.team === playerTeam) continue;
    const dist = pos.distanceTo(b.mesh.position);
    if (dist < WEAPONS.bomb.radius) {
      const falloff = 1 - dist / WEAPONS.bomb.radius;
      damageBot(b, WEAPONS.bomb.dmg * falloff, b.mesh.position);
    }
  }
  const distToPlayer = pos.distanceTo(player.pos);
  if (distToPlayer < WEAPONS.bomb.radius) {
    const falloff = 1 - distToPlayer / WEAPONS.bomb.radius;
    player.hp = Math.max(0, player.hp - WEAPONS.bomb.dmg * 0.5 * falloff);
  }
  scene.remove(bomb.mesh);
  world.removeRigidBody(bomb.rb);
}

// ------------------------------------------------------------------
// ATEŞ ETME MANTIĞI
// ------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
function fireHitscan(w) {
  const spread = w.spread || 0;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.x += (Math.random() - 0.5) * spread;
  dir.y += (Math.random() - 0.5) * spread;
  dir.z += (Math.random() - 0.5) * spread;
  dir.normalize();

  const origin = camera.getWorldPosition(new THREE.Vector3());
  raycaster.set(origin, dir);
  raycaster.far = w.range;

  let hitPoint = origin.clone().add(dir.clone().multiplyScalar(w.range));
  let bestDist = Infinity, bestBot = null, bestHitPoint = null;
  for (const b of bots) {
    if (!b.alive || b.team === playerTeam) continue;
    const hits = raycaster.intersectObject(b.mesh, true);
    if (hits.length && hits[0].distance < bestDist) {
      bestDist = hits[0].distance; bestBot = b; bestHitPoint = hits[0].point;
    }
  }
  if (bestBot) {
    hitPoint = bestHitPoint;
    damageBot(bestBot, w.dmg, hitPoint);
  } else {
    const wallHits = raycaster.intersectObjects(obstacleMeshes, false);
    if (wallHits.length && wallHits[0].face) {
      hitPoint = wallHits[0].point;
      const normal = wallHits[0].face.normal.clone().transformDirection(wallHits[0].object.matrixWorld);
      spawnBulletDecal(hitPoint, normal);
    }
  }
  spawnTracer(weaponModels[currentWeaponKey].getWorldPosition(new THREE.Vector3()), hitPoint, 0xffe08a);
}

function fireMelee(w) {
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  let bestDist = Infinity, bestBot = null;
  for (const b of bots) {
    if (!b.alive || b.team === playerTeam) continue;
    const d = origin.distanceTo(b.mesh.position);
    const toBot = b.mesh.position.clone().sub(origin).normalize();
    const angle = toBot.angleTo(dir);
    if (d < w.range && angle < 0.7 && d < bestDist) { bestDist = d; bestBot = b; }
  }
  if (bestBot) {
    damageBot(bestBot, w.dmg, bestBot.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
  }
  // bıçak sallama animasyonu
  const model = weaponModels.knife;
  const t0 = performance.now();
  function swing() {
    const t = (performance.now() - t0) / 220;
    if (t >= 1) { model.rotation.set(0, 0, 0); return; }
    model.rotation.z = Math.sin(t * Math.PI) * -1.1;
    model.rotation.x = Math.sin(t * Math.PI) * 0.4;
    requestAnimationFrame(swing);
  }
  swing();
}

function updateWeaponFiring(now) {
  const w = WEAPONS[currentWeaponKey];
  if (reloading) {
    if (now >= reloadEndsAt) {
      reloading = false;
      ammoState[currentWeaponKey] = w.mag;
      updateHudWeapon();
    }
    return;
  }

  if (w.kind === 'throwable') {
    if (mouseDown && now - lastShotTime > w.fireDelay) { lastShotTime = now; throwBomb(); }
    return;
  }

  if (w.kind === 'melee') {
    if (mouseDown && now - lastShotTime > w.fireDelay) { lastShotTime = now; fireMelee(w); }
    return;
  }

  // hitscan silahlar
  if (w.spinUpMs) {
    // türbinli minigun: tetik basılıyken spin artar, bırakılınca azalır
    const dt16 = 16 / 1000;
    if (mouseDown) spinUp = Math.min(1, spinUp + dt16 * (1000 / w.spinUpMs));
    else spinUp = Math.max(0, spinUp - dt16 * (1000 / w.spinDownMs));
    const barrelGroup = weaponModels.minigun.userData.barrelGroup;
    if (barrelGroup) barrelGroup.rotation.z += spinUp * 0.9;
    spinBar.style.width = (spinUp * 100).toFixed(0) + '%';
    if (mouseDown && spinUp >= 1 && ammoState[currentWeaponKey] > 0 && now - lastShotTime > w.fireDelay) {
      lastShotTime = now;
      ammoState[currentWeaponKey]--;
      fireHitscan(w);
      updateHudWeapon();
      if (ammoState[currentWeaponKey] <= 0) tryReload();
    }
    return;
  }

  if (mouseDown && now - lastShotTime > w.fireDelay) {
    if (ammoState[currentWeaponKey] <= 0) { tryReload(); return; }
    lastShotTime = now;
    ammoState[currentWeaponKey]--;
    fireHitscan(w);
    updateHudWeapon();
    if (ammoState[currentWeaponKey] <= 0) tryReload();
  }
}

// ------------------------------------------------------------------
// HAREKET GÜNCELLEME (Rapier karakter kontrolcüsü ile)
// ------------------------------------------------------------------
const moveDir = new THREE.Vector3();
function updateMovement(dt) {
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(-1);
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  moveDir.set(0, 0, 0);
  if (keys.has('KeyW')) moveDir.add(forward);
  if (keys.has('KeyS')) moveDir.sub(forward);
  if (keys.has('KeyD')) moveDir.add(right);
  if (keys.has('KeyA')) moveDir.sub(right);

  // Dokunmatik joystick katkısı (touchMoveVec.y: yukarı sürükleme = ileri, negatif)
  if (Math.abs(touchMoveVec.x) > 0.001 || Math.abs(touchMoveVec.y) > 0.001) {
    moveDir.addScaledVector(forward, -touchMoveVec.y);
    moveDir.addScaledVector(right, touchMoveVec.x);
  }
  if (moveDir.lengthSq() > 1) moveDir.normalize();

  player.crouching = keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight');

  const shiftHeld = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const sprint = (!player.crouching && shiftHeld && moveDir.lengthSq() > 0.05) ? player.sprintMul : 1;
  const crouchMul = player.crouching ? player.crouchMul : 1;
  const speed = player.speed * sprint * crouchMul;

  if (player.grounded && keys.has('Space') && !player.crouching) {
    verticalVel = player.jumpSpeed;
  }
  verticalVel += gravity.y * dt;

  const desired = new THREE.Vector3(moveDir.x * speed * dt, verticalVel * dt, moveDir.z * speed * dt);

  characterController.computeColliderMovement(playerBody.collider(0), desired);
  const corrected = characterController.computedMovement();
  player.grounded = characterController.computedGrounded();
  if (player.grounded && verticalVel < 0) verticalVel = 0;

  const cur = playerBody.translation();
  const next = { x: cur.x + corrected.x, y: cur.y + corrected.y, z: cur.z + corrected.z };
  playerBody.setNextKinematicTranslation(next);
  player.pos.set(next.x, next.y, next.z);
}

// ------------------------------------------------------------------
// BOT AI GÜNCELLEME (hem takım arkadaşları hem rakipler)
// ------------------------------------------------------------------
const botRaycaster = new THREE.Raycaster();

function hasLineOfSight(fromPos, toPos) {
  const dir = toPos.clone().sub(fromPos);
  const dist = dir.length();
  dir.normalize();
  botRaycaster.set(fromPos, dir);
  botRaycaster.far = dist;
  const hits = botRaycaster.intersectObjects(obstacleMeshes, false);
  return !(hits.length && hits[0].distance < dist - 0.6);
}

function updateBot(bot, dt, now) {
  if (!bot.alive || !bot.mesh) return;

  const curT = bot.body.translation();
  const feetPos = new THREE.Vector3(curT.x, curT.y - BOT_FOOT_OFFSET, curT.z);

  const target = getNearestTarget(bot);
  const targetPos = target ? target.pos : null;
  const toTarget = targetPos ? targetPos.clone().sub(feetPos) : new THREE.Vector3(0, 0, 1);
  toTarget.y = 0;
  const dist = targetPos ? toTarget.length() : 999;
  const dir = dist > 0.001 ? toTarget.clone().normalize() : new THREE.Vector3(0, 0, 1);

  // ---- Rastgele davranış durum makinesi: yürü/koş/zıpla/eğil ----
  bot.actionTimer -= dt;
  if (bot.actionTimer <= 0) {
    const roll = Math.random();
    if (roll < 0.4) { bot.speedMode = 'run'; bot.crouching = false; }
    else if (roll < 0.7) { bot.speedMode = 'walk'; bot.crouching = false; }
    else if (roll < 0.87) { bot.crouching = true; bot.speedMode = 'walk'; }
    else { bot.crouching = false; if (bot.grounded && bot.jumpCooldown <= 0) { bot.verticalVel = 7.2; bot.jumpCooldown = 1.2; } }
    bot.actionTimer = 1.3 + Math.random() * 2.2;
  }
  bot.jumpCooldown -= dt;

  const baseSpeed = bot.speedMode === 'run' ? 4.4 : 2.3;
  const speed = bot.crouching ? baseSpeed * 0.45 : baseSpeed;

  if (bot.grounded) bot.verticalVel = Math.max(bot.verticalVel, -0.1);
  bot.verticalVel += gravity.y * dt;

  // menzilli çatışma: tercih edilen mesafeye kadar yaklaş, çok yakınsa geri çekil
  const wantsToMove = dist > bot.preferredRange + 2 || dist < bot.preferredRange - 3;
  const approaching = dist > bot.preferredRange;
  const moveVec = approaching ? dir : dir.clone().multiplyScalar(-1);

  const desired = (targetPos && wantsToMove)
    ? new THREE.Vector3(moveVec.x * speed * dt, bot.verticalVel * dt, moveVec.z * speed * dt)
    : new THREE.Vector3(0, bot.verticalVel * dt, 0);

  bot.controller.computeColliderMovement(bot.body.collider(0), desired);
  const corrected = bot.controller.computedMovement();
  bot.grounded = bot.controller.computedGrounded();
  if (bot.grounded && bot.verticalVel < 0) bot.verticalVel = 0;

  const next = { x: curT.x + corrected.x, y: curT.y + corrected.y, z: curT.z + corrected.z };
  bot.body.setNextKinematicTranslation(next);

  bot.mesh.position.set(next.x, next.y - BOT_FOOT_OFFSET, next.z);
  if (targetPos) bot.mesh.lookAt(targetPos.x, bot.mesh.position.y, targetPos.z);

  // eğilme: grup Y ölçeği ayaktan itibaren küçültülür
  const targetScaleY = bot.crouching ? 0.62 : 1;
  bot.mesh.scale.y += (targetScaleY - bot.mesh.scale.y) * Math.min(1, dt * 8);

  // yürüme/koşma bacak-kol animasyonu
  const moving = wantsToMove && !!targetPos;
  bot.walkPhase += dt * (moving ? (bot.speedMode === 'run' ? 11 : 6.5) : 0);
  const swing = Math.sin(bot.walkPhase) * (bot.speedMode === 'run' ? 0.9 : 0.55);
  const { legL, legR, armL, armR } = bot.mesh.userData;
  legL.rotation.x = moving ? swing : 0;
  legR.rotation.x = moving ? -swing : 0;
  armL.rotation.x = moving ? -swing * 0.8 : 0;
  armR.rotation.x = moving ? swing * 0.8 : 0;

  // ---- menzilli saldırı ----
  bot.fireTimer -= dt;
  if (targetPos && dist < 55 && bot.fireTimer <= 0) {
    const eyePos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.35, 0));
    const aimPos = target.isPlayer ? player.pos.clone().add(new THREE.Vector3(0, 1, 0)) : targetPos.clone().add(new THREE.Vector3(0, 1, 0));
    const clearShot = hasLineOfSight(eyePos, aimPos);
    if (clearShot) bot.blockedTime = 0;
    else bot.blockedTime = (bot.blockedTime || 0) + (0.15 + bot.fireTimer < 0 ? 0.15 : 0.15);

    // görüş net değilse bile ~1.2sn üst üste engellendiyse baskı ateşi yap (isabet şansı düşük)
    const suppress = !clearShot && bot.blockedTime > 1.2;
    if (clearShot || suppress) {
      const dmg = clearShot ? (7 + Math.random() * 7) : (Math.random() < 0.25 ? 4 + Math.random() * 5 : 0);
      if (dmg > 0) {
        if (target.isPlayer) player.hp = Math.max(0, player.hp - dmg);
        else damageBot(target.bot, dmg, targetPos.clone().add(new THREE.Vector3(0, 1, 0)));
      }
      spawnTracer(eyePos, aimPos, bot.team === 'red' ? 0xff8a8a : 0x8ac4ff);
      bot.fireTimer = 0.5 + Math.random() * 0.55;
      if (suppress) bot.blockedTime = 0;
    } else {
      bot.fireTimer = 0.15; // engel var, kısa süre sonra tekrar dene
    }
  }

  // vuruş flaşı — tüm gövde parçalarına uygula
  const flash = now - bot.lastHitFlash < 90;
  bot.mesh.traverse((o) => {
    if (o.isMesh) {
      o.material.emissive = flash ? new THREE.Color(0xff2222) : new THREE.Color(0x000000);
      o.material.emissiveIntensity = flash ? 1 : 0;
    }
  });
}

function updateBots(dt, now) {
  for (const bot of bots) updateBot(bot, dt, now);
}

// ------------------------------------------------------------------
// HUD GÜNCELLEME
// ------------------------------------------------------------------
function updateHud() {
  hpFill.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
  updateHudWeapon();
}

// ------------------------------------------------------------------
// VIEWMODEL SALLANMA (bob) + ATEŞ GERİ TEPMESİ
// ------------------------------------------------------------------
let bobT = 0;
function updateViewmodel(dt) {
  const moving = moveDir.lengthSq() > 0.01 && player.grounded;
  bobT += dt * (moving ? 9 : 3);
  const model = weaponModels[currentWeaponKey];
  const bobX = moving ? Math.sin(bobT) * 0.012 : 0;
  const bobY = moving ? Math.abs(Math.sin(bobT)) * 0.01 : Math.sin(bobT) * 0.003;
  const base = WEAPONS[currentWeaponKey].viewOffset;
  model.position.x += (base.x + bobX - model.position.x) * Math.min(1, dt * 10);
  model.position.y += (base.y + bobY - model.position.y) * Math.min(1, dt * 10);
}

// ------------------------------------------------------------------
// ANA DÖNGÜ
// ------------------------------------------------------------------
loading.classList.add('hidden');
blocker.classList.remove('hidden');

let lastTime = performance.now();
let eyeHeight = player.height * 0.42;
function tick() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (gameActive) {
    if (player.hp > 0) {
      updateMovement(dt);
      updateWeaponFiring(now);
      updateViewmodel(dt);
    }
    updateBots(dt, now);
  }

  world.step();

  // bombalar
  for (let i = activeBombs.length - 1; i >= 0; i--) {
    const b = activeBombs[i];
    const t = b.rb.translation();
    b.mesh.position.set(t.x, t.y, t.z);
    if (!b.exploded && now - b.spawnedAt > b.fuseMs) explodeBomb(b);
    if (b.exploded) activeBombs.splice(i, 1);
  }

  // parçacıklar
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vel.y -= 9 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.life -= dt;
    p.mesh.scale.setScalar(Math.max(0, p.life));
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
  }

  const targetEye = player.height * (player.crouching ? 0.24 : 0.42);
  eyeHeight += (targetEye - eyeHeight) * Math.min(1, dt * 10);
  camera.position.set(player.pos.x, player.pos.y + eyeHeight, player.pos.z);
  camera.rotation.set(0, 0, 0);
  camera.rotateY(player.yaw);
  camera.rotateX(player.pitch);

  updateHud();
  if (player.hp <= 0 && roundActive) {
    centerMessage('ELENDİN');
    endRound(enemyTeam);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
