import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

const demoContainer = document.getElementById('interactive-pond-demo');


// ---------- Scene setup ----------
const container = demoContainer.querySelector('#renderContainer');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, demoContainer.clientWidth / demoContainer.clientHeight, 0.1, 200);
camera.position.set(8, 6, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0); // 0 alpha = fully transparent

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(demoContainer.clientWidth, demoContainer.clientHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.1, 0);

// lights
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(10, 12, 6);
scene.add(dir);
scene.add(new THREE.HemisphereLight(0x88aaff, 0x082033, 0.35));

// ---------- Materials ----------
const topsoilMat = new THREE.MeshStandardMaterial({ color: 0x85532d, roughness: 0.85 });
const subsoilMat = new THREE.MeshStandardMaterial({ color: 0xc38a3a, roughness: 0.85 });
const rockMat = new THREE.MeshStandardMaterial({ color: 0x65400c, roughness: 1.0 });
const waterMat = new THREE.MeshPhysicalMaterial({
  color: 0x4fc3f7,
  roughness: 0.1,
  metalness: 0.03,
  transparent: true,
  opacity: 0.7,
  transmission: 0.75,
  ior: 1.33,
  clearcoat: 0.05,
  clearcoatRoughness: 0.02,
});
const algaeMat = new THREE.MeshStandardMaterial({ color: 0x6fcf97, roughness: 0.6, transparent: true, opacity: 0.85 });
const deadFishMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.45 });
const clownfishOrangeMat = new THREE.MeshStandardMaterial({ color: 0xff7f00, roughness: 0.45 });
const clownfishWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
const clownfishBlackMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.45 });

// ---------- Groups ----------
const pondGroup = new THREE.Group();
scene.add(pondGroup);
const grassGroup = new THREE.Group();
scene.add(grassGroup);
const interactiveMeshes = [];
const simplex = new SimplexNoise();

// ---------- Helpers ----------
function makeLopsidedBowl(outerRadius = 6, innerRadius = 3, depth = 1.6, segments = 128) {
  const pts = [];
  pts.push(new THREE.Vector2(outerRadius, 0.12));
  pts.push(new THREE.Vector2(outerRadius * 0.85, 0.07));
  pts.push(new THREE.Vector2((outerRadius + innerRadius) * 0.5, -depth * 0.15));
  pts.push(new THREE.Vector2(innerRadius * 0.95, -depth * 0.5));
  pts.push(new THREE.Vector2(innerRadius * 0.5, -depth * 0.85));
  pts.push(new THREE.Vector2(0, -depth));
  let geom = new THREE.LatheGeometry(pts, segments);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const angle = Math.atan2(v.z, v.x);
    v.y += Math.cos(angle * 3) * 0.2 + (Math.random() - 0.5) * 0.02;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

// ---------- Create pond ----------
let waterSurface, algaePatch, fishes = [],
  bubbleGroup;
let waterVolume = new THREE.Mesh(
  new THREE.CylinderGeometry(3.5, 3.5, 1.0, 32),
  waterMat.clone()
);
waterVolume.position.y = -0.75;
pondGroup.add(waterVolume);

function createLopsidedPond() {
  const outerR = 6;
  const innerR = 3;
  pondGroup.clear();
  interactiveMeshes.length = 0;

  const topGeom = makeLopsidedBowl(6, 3, 1.6, 256);
  const topMesh = new THREE.Mesh(topGeom, topsoilMat);
  topMesh.name = 'Topsoil';
  topMesh.position.y = -0.5;
  pondGroup.add(topMesh);
  interactiveMeshes.push(topMesh);

  const subGeom = makeLopsidedBowl(6 * 0.97, 3 * 0.95, 1.7, 256);
  const subMesh = new THREE.Mesh(subGeom, subsoilMat);
  subMesh.name = 'Subsoil';
  subMesh.position.y = -0.9;
  pondGroup.add(subMesh);
  interactiveMeshes.push(subMesh);

  const rockGeom = makeLopsidedBowl(6 * 0.99, 3 * 0.6, 2.0, 256);
  const rockMesh = new THREE.Mesh(rockGeom, rockMat);
  rockMesh.name = 'Bedrock';
  rockMesh.position.y = -1.25;
  pondGroup.add(rockMesh);
  interactiveMeshes.push(rockMesh);

  const waterRadius = 3.7;
  const waterGeom = new THREE.CircleGeometry(waterRadius, 128);
  waterGeom.rotateX(-Math.PI / 2);
  waterSurface = new THREE.Mesh(waterGeom, waterMat.clone());
  waterSurface.name = 'Water';
  waterSurface.position.y = -0.75;
  pondGroup.add(waterSurface);
  interactiveMeshes.push(waterSurface);
  waterSurface.userData.originalPositions = waterGeom.attributes.position.array.slice();

  const volHeight = 0.9;
  const volRadius = waterRadius * 0.98;
  waterVolume = new THREE.Mesh(
    new THREE.CylinderGeometry(volRadius, volRadius, volHeight, 48),
    waterMat.clone()
  );
  waterVolume.material.opacity = 0.35;
  waterVolume.material.transparent = true;
  waterVolume.material.depthWrite = false;
  waterVolume.position.y = waterSurface.position.y - volHeight / 2 + 0.02;
  pondGroup.add(waterVolume);

  const algaeRadius = 1.2;
  const algaeGeom = new THREE.CircleGeometry(algaeRadius, 64);
  algaeGeom.rotateX(-Math.PI / 2);
  algaePatch = new THREE.Mesh(algaeGeom, algaeMat.clone());
  algaePatch.name = 'Algae';
  algaePatch.position.y = waterSurface.position.y + 0.01;
  pondGroup.add(algaePatch);
  interactiveMeshes.push(algaePatch);

  const fishCount = 14;
  for (let i = 0; i < fishCount; i++) {
    const fg = makeFish(i);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * (waterRadius * 0.88);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = waterSurface.position.y - (Math.random() * 0.45 + 0.05);
    fg.position.set(x, y, z);
    fg.rotation.y = Math.random() * Math.PI * 2;
    fg.userData = {
      isDead: false,
      swimSpeed: 0.03 + Math.random() * 0.06,
      deathTime: Math.random() * 0.85 + 0.15,
      id: i,
    };
    pondGroup.add(fg);
    fg.name = 'Fish';
    fishes.push(fg);
    interactiveMeshes.push(fg);
  }

  bubbleGroup = new THREE.Group();
  const bubbleGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xcfe9ff,
    transparent: true,
    opacity: 0.75,
    roughness: 0.2,
  });
  for (let i = 0; i < 60; i++) {
    const b = new THREE.Mesh(bubbleGeo, bubbleMat.clone());
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * (waterRadius * 0.8);
    b.position.set(Math.cos(a) * r, waterSurface.position.y - Math.random() * 0.5, Math.sin(a) * r);
    b.scale.setScalar(0.6 + Math.random() * 1.4);
    b.userData.vy = 0.002 + Math.random() * 0.005;
    bubbleGroup.add(b);
  }
  pondGroup.add(bubbleGroup);
}

// ---------- Riparian plants with roots ----------
const plantGroup = new THREE.Group();
scene.add(plantGroup);
const roots = [];


function createPlantsAroundPond(count = 25) {
  plantGroup.clear();
  roots.length = 0;

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a5d2b, roughness: 0.9 });
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 2 });
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.9 });

  const waterRadius = waterSurface.geometry.parameters.radius || 3.7;
  const plantOuterRadius = waterRadius + 0.3;
  const leafGroup = new THREE.Group();
  scene.add(leafGroup);
  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = plantOuterRadius + (Math.random() * 0.3);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    const stemHeight = 0.2 + Math.random() * 0.3;
    const stemRadius = 0.05 + Math.random() * 0.05;
    const stemGeo = new THREE.CylinderGeometry(stemRadius, stemRadius, stemHeight, 6);
    const stem = new THREE.Mesh(stemGeo, stemMat.clone());
    stem.position.set(x, -0.5 + stemHeight / 2, z);
    plantGroup.add(stem);
    stem.name = 'Grass';
    interactiveMeshes.push(stem);

    const leafRadius = 0.15 + Math.random() * 0.1;
    const leafGeo = new THREE.IcosahedronGeometry(leafRadius, 1);
    const leaves = new THREE.Mesh(leafGeo, leavesMat.clone());
    leaves.position.set(x, -0.5 + stemHeight + leafRadius / 2, z);
    plantGroup.add(leaves);
    leaves.name = 'Grass';
    interactiveMeshes.push(leaves);
    leafGroup.add(leaves); 

    const rootLength = 0.2 + Math.random() * 0.2;
    const rootGeo = new THREE.CylinderGeometry(0.03, 0.03, rootLength, 6);
    const root = new THREE.Mesh(rootGeo, rootMat.clone());
    root.position.set(x, -0.5 - rootLength / 2, z);
    plantGroup.add(root);
    root.name = 'Grass';
    interactiveMeshes.push(root);
    rootGroup.add(root);

    roots.push(root);
  }
}

// ---------- Nitrate particles ----------
function createNitrateMolecule() {
  const group = new THREE.Group();
  group.userData.type = "Nitrate";
  const nitrogen = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x0000ff })
  );
  group.add(nitrogen);
  const oxyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const radius = 0.2;
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const oxygen = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      oxyMat
    );
    oxygen.position.set(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );
    group.add(oxygen);
  }
  return group;
}

const nitrates = [];

function createNitrates(count) {
  nitrates.forEach(n => scene.remove(n));
  nitrates.length = 0;
  for (let i = 0; i < count; i++) {
    const nitrate = createNitrateMolecule();
    const angle = Math.random() * Math.PI * 2;
    const r = 3.7 + Math.random() * 0.3;
    nitrate.position.set(
      Math.cos(angle) * r,
      Math.random() * 0.1 - 0.6,
      Math.sin(angle) * r
    );
    nitrate.userData.speedY = -(0.002 + Math.random() * 0.002);
    nitrate.userData.driftX = -(nitrate.position.x) * 0.0005;
    nitrate.userData.driftZ = -(nitrate.position.z) * 0.0005;
    scene.add(nitrate);
    nitrates.push(nitrate);
  }
}

function updateNitrates() {
  nitrates.forEach(n => {
    n.position.y += n.userData.speedY;
    n.position.x += n.userData.driftX;
    n.position.z += n.userData.driftZ;
    if (bacteriaEnabled) {
      const distFromCenter = Math.sqrt(n.position.x ** 2 + n.position.z ** 2);
      if (distFromCenter > 3.5 && distFromCenter < 4.1 && Math.random() < 0.002) {
        scene.remove(n);
        nitrates.splice(nitrates.indexOf(n), 1);
        createAmmonium(n.position.clone());
        return;
      }
    }
    if (n.position.y < -1) {
      const angle = Math.random() * Math.PI * 2;
      const r = 3.7 + Math.random() * 0.3;
      n.position.set(
        Math.cos(angle) * r,
        Math.random() * 0.2 - 0.6,
        Math.sin(angle) * r
      );
      n.userData.speedY = -(0.002 + Math.random() * 0.002);
      n.userData.driftX = -(n.position.x) * 0.0005;
      n.userData.driftZ = -(n.position.z) * 0.0005;
    }
  });
}

// ---------- DNRA conversion (nitrate -> ammonium) ----------
const ammoniumGroup = new THREE.Group();
scene.add(ammoniumGroup);

function createAmmoniumMolecule() {
  const group = new THREE.Group();
  group.userData.type = "Ammonium";
  const nitrogen = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x0000ff })
  );
  group.add(nitrogen);
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const radius = 0.2;
  const positions = [
    new THREE.Vector3(radius, 0, 0),
    new THREE.Vector3(-radius, 0, 0),
    new THREE.Vector3(0, radius, 0),
    new THREE.Vector3(0, -radius, 0),
  ];
  positions.forEach(pos => {
    const hydrogen = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      hydMat
    );
    hydrogen.position.copy(pos);
    group.add(hydrogen);
  });

  interactiveMeshes.push(group);

  return group;
}

function createAmmonium(pos) {
  const ammonium = createAmmoniumMolecule();
  ammonium.position.copy(pos);
  ammonium.userData.vy = 0.001 + Math.random() * 0.002;
  ammonium.userData.life = 1.0;
  ammoniumGroup.add(ammonium);
}

function updateAmmonium() {
  for (let i = ammoniumGroup.children.length - 1; i >= 0; i--) {
    const ion = ammoniumGroup.children[i];
    if (!ion.userData.attached) {
      if (roots.length > 0) {
        let nearest = roots[0];
        let minDist = ion.position.distanceTo(nearest.position);
        for (let r of roots) {
          const d = ion.position.distanceTo(r.position);
          if (d < minDist) {
            nearest = r;
            minDist = d;
          }
        }
        const dir = new THREE.Vector3().subVectors(nearest.position, ion.position).normalize();
        ion.position.addScaledVector(dir, 0.01);
        if (minDist < 0.1) {
          ion.userData.attached = true;
          ion.userData.waitTime = 200 + Math.floor(Math.random() * 200);
          ion.position.copy(nearest.position.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.1, -0.05, (Math.random() - 0.5) * 0.1
          )));
        }
      }
    } else {
      ion.userData.waitTime--;
      if (ion.userData.waitTime <= 0) {
        ammoniumGroup.remove(ion);
        continue;
      }
    }
    ion.children.forEach(atom => {
      atom.material.opacity = ion.userData.attached ? 0.9 : ion.userData.life;
      atom.material.transparent = true;
    });
    if (!ion.userData.attached) {
      ion.userData.life -= 0.001;
      if (ion.userData.life <= 0) {
        ammoniumGroup.remove(ion);
      }
    }
  }
}

// ---------- Bacteria (around pond edge) ----------
const bacteriaGroup = new THREE.Group();
scene.add(bacteriaGroup);

function createBacterium(x, y, z) {
  const group = new THREE.Group();
  group.userData.isBacteria = true;
  group.name = 'Bacteria';
  const bodyGeo = new THREE.SphereGeometry(0.12, 12, 12);
  bodyGeo.scale(1.4, 0.7, 0.7);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x22aa22 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);
  const flagella = [];
  for (let i = 0; i < 3; i++) {
    const points = [
      new THREE.Vector3(0.07, 0, 0),
      new THREE.Vector3(0.20, 0, 0),
      new THREE.Vector3(0.35, 0, 0)
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.015, 6, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x006600 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.rotation.y = i / 10;
    group.add(tube);
    flagella.push({ mesh: tube, basePoints: points });
  }
  group.position.set(x, y, z);
  group.userData.flagella = flagella;
  group.userData.phase = Math.random() * Math.PI * 2;
  return group;
}

function createBacteriaRing(count = 40, minR = 3.7, maxR = 4.0) {
  bacteriaGroup.clear();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = minR + Math.random() * (maxR - minR);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = -0.75 - 0.05;
    const b = createBacterium(x, y, z);
    b.name = 'Bacteria';
    bacteriaGroup.add(b);
    interactiveMeshes.push(b);
  }
}

function updateBacteria(delta) {
  bacteriaGroup.children.forEach(b => {
    const phase = b.userData.phase;
    b.userData.phase += delta * 2;
    b.userData.flagella.forEach(f => {
      const newPoints = f.basePoints.map((p, i) => {
        const wiggle = Math.sin(phase + i) * 0.05 * i;
        return new THREE.Vector3(p.x + wiggle, p.y, p.z);
      });
      const curve = new THREE.CatmullRomCurve3(newPoints);
      f.mesh.geometry.dispose();
      f.mesh.geometry = new THREE.TubeGeometry(curve, 16, 0.015, 6, false);
    });
  });
}

// ---------- fish maker ----------
function makeFish(id) {
  const g = new THREE.Group();
  const bodySegment1 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), clownfishOrangeMat);
  bodySegment1.scale.set(1.4, 0.8, 0.7);
  bodySegment1.position.x = 0.1;
  g.add(bodySegment1);
  const bodySegment2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), clownfishWhiteMat);
  bodySegment2.scale.set(1.3, 0.75, 0.65);
  bodySegment2.position.x = -0.05;
  g.add(bodySegment2);
  const bodySegment3 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), clownfishOrangeMat);
  bodySegment3.scale.set(1.1, 0.6, 0.5);
  bodySegment3.position.x = -0.2;
  g.add(bodySegment3);
  const stripeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.3, 6);
  stripeGeo.rotateZ(Math.PI / 2);
  const stripe1 = new THREE.Mesh(stripeGeo, clownfishBlackMat);
  stripe1.position.set(0.2, 0, 0);
  stripe1.scale.y = 0.8;
  g.add(stripe1);
  const stripe2 = new THREE.Mesh(stripeGeo, clownfishBlackMat);
  stripe2.position.set(-0.05, 0, 0);
  g.add(stripe2);
  const stripe3 = new THREE.Mesh(stripeGeo, clownfishBlackMat);
  stripe3.position.set(-0.25, 0, 0);
  stripe3.scale.y = 0.6;
  g.add(stripe3);
  const dorsalFinGeo = new THREE.BufferGeometry();
  const dorsalVertices = new Float32Array([
    0.1, 0.18, 0,
    0.2, 0.08, 0,
    0.0, 0.08, 0,
  ]);
  const dorsalIndices = new Uint16Array([0, 1, 2]);
  dorsalFinGeo.setAttribute('position', new THREE.BufferAttribute(dorsalVertices, 3));
  dorsalFinGeo.setIndex(new THREE.BufferAttribute(dorsalIndices, 1));
  dorsalFinGeo.computeVertexNormals();
  const dorsalFin = new THREE.Mesh(dorsalFinGeo, clownfishOrangeMat);
  dorsalFin.position.y = 0.05;
  g.add(dorsalFin);
  const pecFinGeo = new THREE.BufferGeometry();
  const pecVertices = new Float32Array([
    0, 0, 0,
    0.08, 0.08, 0,
    0.12, -0.02, 0,
  ]);
  const pecIndices = new Uint16Array([0, 1, 2]);
  pecFinGeo.setAttribute('position', new THREE.BufferAttribute(pecVertices, 3));
  pecFinGeo.setIndex(new THREE.BufferAttribute(pecIndices, 1));
  pecFinGeo.computeVertexNormals();
  const pecFin1 = new THREE.Mesh(pecFinGeo, clownfishOrangeMat);
  pecFin1.position.set(0.08, 0, 0.08);
  pecFin1.rotation.y = Math.PI / 2;
  pecFin1.rotation.z = -Math.PI / 8;
  g.add(pecFin1);
  const pecFin2 = new THREE.Mesh(pecFinGeo, clownfishOrangeMat);
  pecFin2.position.set(0.08, 0, -0.08);
  pecFin2.rotation.y = -Math.PI / 2;
  pecFin2.rotation.z = -Math.PI / 8;
  g.add(pecFin2);
  const analFinGeo = new THREE.BufferGeometry();
  const analVertices = new Float32Array([
    -0.15, -0.15, 0,
    -0.05, -0.05, 0,
    -0.25, -0.05, 0,
  ]);
  const analIndices = new Uint16Array([0, 1, 2]);
  analFinGeo.setAttribute('position', new THREE.BufferAttribute(analVertices, 3));
  analFinGeo.setIndex(new THREE.BufferAttribute(analIndices, 1));
  analFinGeo.computeVertexNormals();
  const analFin = new THREE.Mesh(analFinGeo, clownfishOrangeMat);
  analFin.position.y = -0.05;
  g.add(analFin);
  const tailGeo = new THREE.BufferGeometry();
  const tailVertices = new Float32Array([
    -0.3, 0.12, 0,
    -0.4, 0, 0,
    -0.3, -0.12, 0,
    -0.25, 0, 0,
  ]);
  const tailIndices = new Uint16Array([
    0, 3, 1,
    1, 3, 2,
  ]);
  tailGeo.setAttribute('position', new THREE.BufferAttribute(tailVertices, 3));
  tailGeo.setIndex(new THREE.BufferAttribute(tailIndices, 1));
  tailGeo.computeVertexNormals();
  const tail = new THREE.Mesh(tailGeo, clownfishOrangeMat);
  tail.position.x = -0.22;
  g.add(tail);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: false });
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: false });
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), scleraMat);
  sclera.position.set(0.25, 0.03, 0.08);
  g.add(sclera);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), eyeMat);
  pupil.position.set(0.28, 0.03, 0.08);
  g.add(pupil);
  const sclera2 = sclera.clone();
  sclera2.position.z = -0.08;
  g.add(sclera2);
  const pupil2 = pupil.clone();
  pupil2.position.z = -0.08;
  g.add(pupil2);
  return g;
}

// ---------- Interactivity ----------
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = demoContainer.querySelector('#tooltip');
const infoBox = demoContainer.querySelector('#infoBox');
const infoData = {
  'Water': { 
    title: 'Pond Water', 
    text: 'Water receives runoff containing nutrients. High nitrate and phosphate levels can lead to algal blooms, oxygen depletion, and harm aquatic life.' 
  },
  'Topsoil': { 
    title: 'Topsoil', 
    text: 'The upper layer of soil where plants grow. It intercepts and temporarily stores runoff, affecting nutrient availability.' 
  },
  'Subsoil': { 
    title: 'Subsoil', 
    text: 'Layer beneath topsoil that stores water and nutrients. It influences nutrient leaching into deeper layers or groundwater.' 
  },
  'Bedrock': { 
    title: 'Bedrock', 
    text: 'The underlying rock layer. Cracks or porous sections can allow groundwater movement and transport dissolved nutrients.' 
  },
  'Algae': { 
    title: 'Algal Bloom', 
    text: 'Excess nutrients, especially nitrogen and phosphorus, cause rapid algal growth, which reduces oxygen levels and harms aquatic organisms.' 
  },
  'Grass': { 
    title: 'Riparian Vegetation', 
    text: 'Vegetation along water bodies filters runoff, stabilizes banks, and reduces nutrient input into the pond.' 
  },
  'Fish': { 
    title: 'Fish', 
    text: 'Fish require oxygen-rich water. Eutrophication and algal blooms can reduce oxygen, leading to stress or die-offs.' 
  },
  'Bacteria': { 
    title: 'Bacteria', 
    text: 'Bacteria are crucial in the nitrogen cycle. They can convert nitrates into nitrogen gas through denitrification, reducing nutrient loads.' 
  },
  'Ammonium': {
    title: 'Ammonium (NH₄⁺)',
    text: 'Ammonium is a nitrogen compound produced by bacterial conversion of nitrates. Plants can absorb it, and it can also convert back to nitrate under certain conditions.'
  },
  'Nitrate': {
    title: 'Nitrate (NO₃⁻)',
    text: 'Nitrate is a soluble nitrogen form that can leach into groundwater or be taken up by plants. Bacteria can convert it into ammonium or nitrogen gas.'
  }
};


let hovered = null;

function getTopLevel(object) {
  let o = object;
  while (o && !o.name && o.parent) o = o.parent;
  return o;
}

function onMove(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(interactiveMeshes, true);
  if (hits.length > 0) {
    let mesh = getTopLevel(hits[0].object);
    if (hovered !== mesh) {
      if (hovered) clearHighlight(hovered);
      hovered = mesh;
      setHighlight(mesh, 0.1);
    }
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX) + 'px';
    tooltip.style.top = (e.clientY - 10) + 'px';
    const key = infoData[mesh.name] ? mesh.name : (mesh.userData && mesh.userData.isDead !== undefined ? 'Fish' : (mesh.parent.userData.isBacteria ? 'Bacteria' : mesh.name));
    tooltip.innerText = (infoData[key] && infoData[key].title) ? infoData[key].title : mesh.name;
  } else {
    if (hovered) clearHighlight(hovered);
    hovered = null;
    tooltip.style.display = 'none';
  }
}

// Part 2: Corrected onClick Function
function onClick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(interactiveMeshes, true);

    if (hits.length > 0) {
        let object = hits[0].object;
        let key = null;

        // Traverse up the parent hierarchy to find the main interactive object
        while (object) {
            if (object.name) {
                key = object.name;
                break;
            }
            object = object.parent;
        }

        const data = infoData[key] || { title: key || 'Unknown', text: 'No information available.' };
        infoBox.innerHTML = `<h3>${data.title}</h3><p>${data.text}</p>`;
        infoBox.style.display = 'block';

    } else {
        infoBox.style.display = 'none';
    }
}


function setHighlight(mesh, strength = 0.2) {
    if (!mesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
        const hoverColor = new THREE.Color(0xffffff);
        const highlightStrength = 0.01; // Change this value to reduce intensity

        mesh.material.forEach((mat) => {
            if (!mat.userData._orig) {
                mat.userData._orig = {
                    emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
                    emissiveIntensity: mat.emissiveIntensity || 0,
                };
            }
            if (mat.emissive) {
                mat.emissive.copy(mat.userData._orig.emissive);
                mat.emissive.addScaledColor(hoverColor, highlightStrength);
            }
            mat.emissiveIntensity = highlightStrength;
        });
    } else {
        if (!mesh.material.userData._orig) {
            mesh.material.userData._orig = {
                emissive: mesh.material.emissive ? mesh.material.emissive.clone() : new THREE.Color(0x000000),
                emissiveIntensity: mesh.material.emissiveIntensity || 0,
            };
        }
        if (mesh.material.emissive) mesh.material.emissive.set(0xffffff);
        mesh.material.emissiveIntensity = strength;
    }
}

function clearHighlight(mesh) {
  if (!mesh || !mesh.material) return;
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(mat => {
      if (mat.userData && mat.userData._orig) {
        if (mat.emissive) mat.emissive.copy(mat.userData._orig.emissive);
        mat.emissiveIntensity = mat.userData._orig.emissiveIntensity;
        delete mat.userData._orig;
      } else {
        if (mat.emissive) mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
      }
    });
  } else {
    if (mesh.material.userData && mesh.material.userData._orig) {
      if (mesh.material.emissive) mesh.material.emissive.copy(mesh.material.userData._orig.emissive);
      mesh.material.emissiveIntensity = mesh.material.userData._orig.emissiveIntensity;
      delete mesh.material.userData._orig;
    } else {
      if (mesh.material.emissive) mesh.material.emissive.set(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
  }
}

// ---------- Water wave update ----------
let time = 0;

function updateWater(dt) {
  if (!waterSurface) return;
  time += dt * 0.6;
  const pos = waterSurface.geometry.attributes.position;
  const arr = pos.array;
  const orig = waterSurface.userData.originalPositions;
  for (let i = 0; i < arr.length; i += 3) {
    const ox = orig[i],
      oy = orig[i + 1],
      oz = orig[i + 2];
    const n = simplex.noise3d(ox * 0.25, oz * 0.25, time * 0.6);
    arr[i + 1] = oy + n * 0.06;
  }
  pos.needsUpdate = true;
  waterSurface.geometry.computeVertexNormals();
}

// ---------- bubbles ----------
function updateBubbles() {
  if (!bubbleGroup) return;
  bubbleGroup.children.forEach(b => {
    b.position.y += b.userData.vy;
    b.material.opacity = 0.6 + 0.35 * Math.sin(performance.now() * 0.002 + (b.userData.vy * 1000));
    if (b.position.y > (waterSurface.position.y + 0.05)) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (waterSurface.geometry.parameters.radius || 2.8) * 0.8;
      b.position.set(Math.cos(a) * r, waterSurface.position.y - 0.5 - Math.random() * 0.15, Math.sin(a) * r);
    }
  });
}

// ---------- fish behaviour ----------
function updateFishes() {
  fishes.forEach(f => {
    if (!f.userData) return;
    if (!f.userData.isDead) {
      const t = performance.now() * 0.001 * f.userData.swimSpeed;
      f.position.x += Math.cos(t + f.userData.id) * 0.002 * (0.8 + f.userData.swimSpeed);
      f.position.z += Math.sin(t * 0.9 + f.userData.id) * 0.002 * (0.8 + f.userData.swimSpeed);
      const dist = Math.sqrt(f.position.x * f.position.x + f.position.z * f.position.z);
      const maxR = (waterSurface.geometry.parameters.radius || 2.9) - 0.08;
      if (dist > maxR) {
        const ang = Math.atan2(f.position.z, f.position.x);
        f.position.x = Math.cos(ang) * (maxR - 0.02);
        f.position.z = Math.sin(ang) * (maxR - 0.02);
      }
      f.rotation.y += Math.sin(performance.now() * 0.02 + f.userData.id) * 0.03;
    } else {
      f.position.y -= 0.002;
      f.traverse(node => {
        if (node.isMesh && node.material && node.material.opacity !== undefined) {
          node.material.opacity = Math.max(0, (node.material.opacity || 1) - 0.001);
          node.material.transparent = true;
        }
      });
    }
  });
}

// ---------- Pond state (timescale -> algae + fish die) ----------
function updatePondState(value) {
  if (!algaePatch) return;
  const algaeMaxOpacity = 0.95;
  const algaeMinOpacity = 0.5;
  algaePatch.material.opacity = Math.min(algaeMaxOpacity, algaeMinOpacity + value * (algaeMaxOpacity - algaeMinOpacity));
  const waterRadius = 3.7;
  const minR = 0.8;
  const maxR = waterRadius * 0.6;
  const scaleFactor = minR + (maxR - minR) * value;
  const uniformScale = scaleFactor / minR;
  algaePatch.scale.set(uniformScale, 1, uniformScale);
  fishes.forEach(f => {
    if (!f.userData.isDead && value >= f.userData.deathTime) {
      f.userData.isDead = true;
      f.name = 'Fish';
      f.traverse(node => {
        if (node.isMesh) {
          node.material = deadFishMat.clone();
        }
      });
    }
  });
}

// ---------- UI wiring ----------
let bacteriaEnabled = false;
demoContainer.querySelector('#timescale').addEventListener('input', e => {
  updatePondState(parseFloat(e.target.value));
});

demoContainer.querySelector('#resetBtn').addEventListener('click', () => {
    controls.reset();
    camera.position.set(8, 6, 10);
    controls.target.set(0, 0.1, 0);
    demoContainer.querySelector('#timescale').value = 0;
    createLopsidedPond();
    createPlantsAroundPond();
    createBacteriaRing(0);
    bacteriaEnabled = false;
    clearAmmonium();
    updatePondState(0);
    demoContainer.querySelector('#createBacteria').innerText = "Create Bacteria";
});

function clearAmmonium() {
  const children = [...ammoniumGroup.children];
  children.forEach(ion => {
    ammoniumGroup.remove(ion);
  });
}

demoContainer.querySelector('#createBacteria').addEventListener('click', (e) => {
  if (bacteriaGroup.children.length > 0) {
    createBacteriaRing(0);
    bacteriaEnabled = false;
    clearAmmonium();
    e.target.innerText = "Create Bacteria";
  } else {
    createBacteriaRing(10);
    bacteriaEnabled = true;
    e.target.innerText = "Remove Bacteria";
  }
});

renderer.domElement.addEventListener('mousemove', onMove, { passive: true });
renderer.domElement.addEventListener('click', onClick);

window.addEventListener('resize', () => {
  camera.aspect = demoContainer.clientWidth / demoContainer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(demoContainer.clientWidth, demoContainer.clientHeight);
});

// ---------- Make initial pond ----------
createLopsidedPond();
createPlantsAroundPond();
createNitrates(30);

// ---------- animation loop ----------
let last = performance.now();
(function loop() {
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  updateWater(dt);
  updateFishes();
  updateNitrates();
  if (bacteriaEnabled) {
    updateAmmonium();
    updateBacteria(dt);
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})();