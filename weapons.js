import * as THREE from 'three';

// ---- SİLAH VERİ TABANI --------------------------------------------------
// NOT: Quaternius "Ultimate Guns Pack" GLB dosyaları geldiğinde tek yapılması
// gereken şey her silahın `buildModel()` fonksiyonunu GLTFLoader ile yüklenen
// gerçek modeli döndürecek şekilde değiştirmek. Geri kalan tüm oyun mantığı
// (ateş etme, hasar, mermi, spin-up, bomba fiziği) modelden bağımsız çalışır.

export const WEAPON_ORDER = ['knife', 'pistol', 'lmg', 'hmg', 'minigun', 'bomb'];

function mat(color, metalness = 0.6, roughness = 0.4) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

// Silahı "tutuyormuş" hissi veren basit el+kol modeli. Her silaha kendi
// tutuş noktasına göre eklenir (Quaternius modelleri gelince pozisyonlar
// yeniden ince ayarlanabilir, ama sistem aynı kalır).
function buildHand(pos = new THREE.Vector3(0, -0.1, 0.12), rot = new THREE.Euler(-0.15, 0, 0)) {
  const g = new THREE.Group();
  const skin = mat(0xcf9a6c, 0.1, 0.85);
  const sleeve = mat(0x3a4a3a, 0.1, 0.9);

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.09), skin);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.05, 3, 5), skin);
  thumb.position.set(0.045, 0.01, -0.02);
  thumb.rotation.z = 0.9;
  const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.05), skin);
  fingers.position.set(0, -0.006, -0.06);
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.16, 8), sleeve);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0, 0, 0.13);

  g.add(palm, thumb, fingers, wrist);
  g.position.copy(pos);
  g.rotation.copy(rot);
  return g;
}

// Basit ama silah siluetine sadık placeholder modeller (kutu/silindir kombinasyonu).
// Gerçek Quaternius modeli gelince buildModel() içinden GLTF sahnesi döndürülecek.
function buildPistolModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.32), mat(0x2b2f33));
  body.position.set(0, 0, 0);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 10), mat(0x1c1f22));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.22);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.16, 0.09), mat(0x151719));
  grip.position.set(0, -0.13, 0.09);
  grip.rotation.x = -0.25;
  g.add(body, barrel, grip);
  g.add(buildHand(new THREE.Vector3(0, -0.15, 0.11), new THREE.Euler(-0.2, 0, 0)));
  return g;
}

function buildKnifeModel() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.28, 4), mat(0xc9d3da, 0.9, 0.2));
  blade.rotation.x = Math.PI / 2;
  blade.position.set(0, 0, -0.22);
  blade.scale.set(1.6, 1, 1);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8), mat(0x3b2a1e, 0.2, 0.8));
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0, 0.02);
  g.add(blade, handle);
  g.add(buildHand(new THREE.Vector3(0, -0.02, 0.03), new THREE.Euler(-0.1, 0, 0)));
  return g;
}

function buildLmgModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.62), mat(0x2e3a2e));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 10), mat(0x1a1a1a));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -0.44);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), mat(0x1f2a1f));
  mag.position.set(0, -0.12, -0.05);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.2), mat(0x24291f));
  stock.position.set(0, 0, 0.38);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.08), mat(0x151719));
  grip.position.set(0, -0.11, 0.14);
  grip.rotation.x = -0.2;
  g.add(body, barrel, mag, stock, grip);
  g.add(buildHand(new THREE.Vector3(0, -0.14, 0.16), new THREE.Euler(-0.2, 0, 0)));
  g.add(buildHand(new THREE.Vector3(0.03, -0.1, -0.28), new THREE.Euler(0, 0.3, -0.3)));
  return g;
}

function buildHmgModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.72), mat(0x35322c));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.4, 10), mat(0x161513));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.5);
  const bipod1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), mat(0x111));
  bipod1.position.set(-0.06, -0.14, -0.36); bipod1.rotation.z = 0.3;
  const bipod2 = bipod1.clone(); bipod2.position.x = 0.06; bipod2.rotation.z = -0.3;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.12), mat(0x201f1c));
  mag.position.set(0, -0.16, -0.02);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.24), mat(0x2b2822));
  stock.position.set(0, 0, 0.44);
  g.add(body, barrel, bipod1, bipod2, mag, stock);
  g.add(buildHand(new THREE.Vector3(0, -0.17, 0.22), new THREE.Euler(-0.2, 0, 0)));
  g.add(buildHand(new THREE.Vector3(0.03, -0.08, -0.3), new THREE.Euler(0, 0.3, -0.3)));
  return g;
}

function buildMinigunModel() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8), mat(0x24272b));
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 0, -0.05);
  const barrelGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), mat(0x131414));
    b.rotation.x = Math.PI / 2;
    b.position.set(Math.cos(a) * 0.055, Math.sin(a) * 0.055, -0.32);
    barrelGroup.add(b);
  }
  barrelGroup.name = 'spinningBarrels';
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.3), mat(0x2e2e2e));
  housing.position.set(0, -0.05, 0.14);
  g.add(core, barrelGroup, housing);
  g.userData.barrelGroup = barrelGroup;
  g.add(buildHand(new THREE.Vector3(0, -0.15, 0.2), new THREE.Euler(-0.2, 0, 0)));
  g.add(buildHand(new THREE.Vector3(0.03, -0.06, -0.1), new THREE.Euler(0, 0.3, -0.3)));
  return g;
}

function buildBombModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat(0x2b2f33, 0.3, 0.6));
  const pin = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 10), mat(0xd0d0d0, 0.8, 0.2));
  pin.position.set(0, 0.075, 0);
  pin.rotation.x = Math.PI / 2;
  g.add(body, pin);
  g.add(buildHand(new THREE.Vector3(0, -0.03, 0.02), new THREE.Euler(-0.05, 0, 0)));
  return g;
}

export const WEAPONS = {
  knife: {
    key: '1', name: 'BIÇAK', kind: 'melee', dmg: 55, range: 2.1, fireDelay: 420,
    infiniteAmmo: true, mag: null, buildModel: buildKnifeModel, price: 0, alwaysOwned: true,
    viewOffset: new THREE.Vector3(0.22, -0.16, -0.34), swingArc: true
  },
  pistol: {
    key: '2', name: 'TABANCA', kind: 'hitscan', dmg: 24, range: 60, fireDelay: 220,
    mag: 12, reloadMs: 1000, spread: 0.012, buildModel: buildPistolModel, price: 0, alwaysOwned: true,
    viewOffset: new THREE.Vector3(0.22, -0.18, -0.36)
  },
  lmg: {
    key: '3', name: 'HAFİF MAKİNELİ', kind: 'hitscan', dmg: 15, range: 75, fireDelay: 100,
    mag: 40, reloadMs: 1700, spread: 0.028, buildModel: buildLmgModel, price: 650,
    viewOffset: new THREE.Vector3(0.23, -0.19, -0.42)
  },
  hmg: {
    key: '4', name: 'AĞIR MAKİNELİ', kind: 'hitscan', dmg: 34, range: 90, fireDelay: 160,
    mag: 60, reloadMs: 2600, spread: 0.02, buildModel: buildHmgModel, price: 1400,
    viewOffset: new THREE.Vector3(0.24, -0.2, -0.46)
  },
  minigun: {
    key: '5', name: 'TÜRBİNLİ MİNİGUN', kind: 'hitscan', dmg: 11, range: 70, fireDelay: 45,
    mag: 180, reloadMs: 3200, spread: 0.05, buildModel: buildMinigunModel, price: 2200,
    viewOffset: new THREE.Vector3(0.22, -0.2, -0.32),
    spinUpMs: 900, spinDownMs: 700
  },
  bomb: {
    key: '6', name: 'BOMBA', kind: 'throwable', dmg: 140, radius: 5.5, fuseMs: 1800,
    count: 3, throwSpeed: 16, fireDelay: 650, buildModel: buildBombModel, price: 300,
    viewOffset: new THREE.Vector3(0.16, -0.17, -0.28)
  }
};
