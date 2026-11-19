import * as THREE from 'three';
import type { ColliderBox } from '../worldBuilder';

/** Ponto secreto da missão da Oráculo; mantido estável para o GPS e os saves. */
export const HIDDEN_NEW_YORK_SANCTUARY = Object.freeze({ x: -45, y: 0, z: -190 });

export const METROPOLIS_BOUNDS = Object.freeze({ minX: -248, maxX: 248, minZ: -248, maxZ: 248 });
export const METROPOLIS_POPULATION = 850_000;
export const METROPOLIS_DISTRICTS = [
  'Distrito Financeiro', 'Centro Cívico', 'Bairro das Artes',
  'Parque Central', 'Distrito Portuário', 'Bairro Residencial',
] as const;

/**
 * Metrópole fictícia de grande escala, comprimida na escala navegável do jogo.
 * A cidade usa instancing para manter edifícios, pedestres e tráfego baratos
 * em GPU mobile. A população estatística não é confundida com NPCs renderizados.
 */
export function buildHiddenNewYorkDistrict(root: THREE.Group): ColliderBox[] {
  const colliders: ColliderBox[] = [];
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x252d3a, roughness: 0.94 });
  const avenue = new THREE.MeshStandardMaterial({ color: 0x343c48, roughness: 0.9 });
  const sidewalk = new THREE.MeshStandardMaterial({ color: 0x8a929c, roughness: 0.96 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x173e59, roughness: 0.2, metalness: 0.7, emissive: 0x06243a, emissiveIntensity: 0.38 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x657080, roughness: 0.82, metalness: 0.18 });
  const parkMat = new THREE.MeshStandardMaterial({ color: 0x244d3b, roughness: 1 });
  const riverMat = new THREE.MeshStandardMaterial({ color: 0x0b526d, roughness: 0.18, metalness: 0.3, transparent: true, opacity: 0.94 });
  const neon = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0891b2, emissiveIntensity: 1.35 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(496, 496), asphalt);
  ground.name = 'metropolis-ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.04, 0);
  ground.receiveShadow = true;
  root.add(ground);

  // Malha viária ortogonal com avenidas largas e calçadas.
  const roadPositions: Array<{x:number;z:number;w:number;d:number}> = [];
  for (let p = -240; p <= 240; p += 48) {
    roadPositions.push({ x: p, z: 0, w: 13, d: 492 });
    roadPositions.push({ x: 0, z: p, w: 492, d: 13 });
  }
  const roads = new THREE.Group();
  roads.name = 'metropolis-road-network';
  for (const r of roadPositions) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), avenue);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(r.x, 0.012, r.z);
    roads.add(mesh);
  }
  root.add(roads);

  // Waterfront, canal secundário e parques públicos.
  const river = new THREE.Mesh(new THREE.PlaneGeometry(38, 496), riverMat);
  river.name = 'metropolis-river';
  river.rotation.x = -Math.PI / 2;
  river.position.set(218, -0.18, 0);
  root.add(river);
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(18, 190), riverMat);
  canal.name = 'metropolis-canal';
  canal.rotation.x = -Math.PI / 2;
  canal.position.set(-145, -0.13, 65);
  root.add(canal);
  const parks = [
    { x: -70, z: -150, w: 62, d: 112 },
    { x: 118, z: 95, w: 66, d: 72 },
    { x: -188, z: -35, w: 34, d: 58 },
  ];
  for (const [index, p] of parks.entries()) {
    const park = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), parkMat);
    park.name = index === 0 ? 'central-park' : `metropolis-park-${index}`;
    park.rotation.x = -Math.PI / 2;
    park.position.set(p.x, 0.025, p.z);
    root.add(park);
    const treeGeometry = new THREE.ConeGeometry(1.35, 5.5, 6);
    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x286348, roughness: 1 });
    const treeCount = Math.floor((p.w * p.d) / 105);
    const trees = new THREE.InstancedMesh(treeGeometry, treeMaterial, treeCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeCount; i++) {
      const cols = Math.max(1, Math.floor(p.w / 7));
      dummy.position.set(p.x - p.w/2 + 3 + (i % cols) * 7, 2.7, p.z - p.d/2 + 3 + Math.floor(i / cols) * 7);
      dummy.scale.setScalar(0.7 + (i % 4) * 0.12);
      dummy.updateMatrix();
      trees.setMatrixAt(i, dummy.matrix);
    }
    trees.name = `park-trees-${index}`;
    root.add(trees);
  }

  // Quadras com alturas e fachadas variadas; uma única chamada por família.
  const specs: Array<{x:number;z:number;w:number;d:number;h:number}> = [];
  const buildingColors = [0x667487, 0x526579, 0x8a8178, 0x3e596b, 0x777b86];
  for (let z = -216; z <= 216; z += 24) {
    for (let x = -216; x <= 192; x += 24) {
      const inPark = parks.some(p => Math.abs(x-p.x) < p.w/2-4 && Math.abs(z-p.z) < p.d/2-4);
      const inWater = x > 196 || (x < -132 && z > -30 && z < 160);
      const nearSanctuary = Math.hypot(x-HIDDEN_NEW_YORK_SANCTUARY.x, z-HIDDEN_NEW_YORK_SANCTUARY.z) < 18;
      if (inPark || inWater || nearSanctuary || Math.abs(x % 48) < 8 || Math.abs(z % 48) < 8) continue;
      const seed = Math.abs((x * 17 + z * 31) % 997);
      const districtBoost = x > 24 && x < 168 && z > -120 && z < 120 ? 1.45 : 1;
      const h = (13 + (seed % 11) * 4.2) * districtBoost;
      specs.push({ x, z, w: 12 + (seed % 5), d: 12 + ((seed >> 2) % 5), h });
    }
  }
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.28 });
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, specs.length);
  const dummy = new THREE.Object3D();
  specs.forEach((b, i) => {
    dummy.position.set(b.x, b.h/2, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    buildings.setMatrixAt(i, dummy.matrix);
    buildings.setColorAt(i, new THREE.Color(buildingColors[i % buildingColors.length]));
    colliders.push({ minX:b.x-b.w/2, maxX:b.x+b.w/2, minZ:b.z-b.d/2, maxZ:b.z+b.d/2, minY:0, topY:b.h, climbable:true });
  });
  buildings.name = 'metropolis-building-instances';
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  root.add(buildings);

  // Torres emblemáticas, antenas e telhados iluminados.
  const tower = new THREE.Group();
  tower.name = 'metropolis-observation-tower';
  const towerBase = new THREE.Mesh(new THREE.BoxGeometry(17, 54, 17), glass);
  towerBase.position.y = 27;
  towerBase.castShadow = true;
  tower.add(towerBase);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(3, 7, 13, 8), concrete);
  crown.position.y = 60;
  tower.add(crown);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1, 22, 8), neon);
  spire.position.y = 77;
  tower.add(spire);
  tower.position.set(72, 0, -72);
  root.add(tower);
  colliders.push({ minX:63.5,maxX:80.5,minZ:-80.5,maxZ:-63.5,minY:0,topY:54,climbable:true });

  // Ponte suspensa atravessando o rio, com pilares e cabos.
  const bridge = new THREE.Group();
  bridge.name = 'metropolis-suspension-bridge';
  const deck = new THREE.Mesh(new THREE.BoxGeometry(76, 1, 8), concrete);
  deck.position.set(205, 9, 12);
  bridge.add(deck);
  for (const x of [174, 236]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(3.5, 24, 4), concrete);
    pylon.position.set(x, 12, 12);
    bridge.add(pylon);
  }
  const cable = new THREE.Mesh(new THREE.TorusGeometry(33, 0.24, 6, 64, Math.PI), neon);
  cable.rotation.z = Math.PI;
  cable.position.set(205, 22, 12);
  bridge.add(cable);
  root.add(bridge);

  // População urbana de fundo: pedestres agrupados em instâncias para GPU mobile.
  const pedestrianMaterial = new THREE.MeshStandardMaterial({ color: 0xd6b58c, roughness: 0.9 });
  const pedestrianBody = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 0.55, 3, 6), pedestrianMaterial, 180);
  const pedestrianHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8c9aa }), 180);
  const pedestrianDummy = new THREE.Object3D();
  let pedestrianIndex = 0;
  for (let z = -220; z <= 220 && pedestrianIndex < 180; z += 22) {
    for (let x = -210; x <= 190 && pedestrianIndex < 180; x += 28) {
      if (Math.abs(x % 48) < 8 || Math.abs(z % 48) < 8) continue;
      const offset = ((pedestrianIndex * 13) % 7) - 3;
      const px = x + offset;
      const pz = z + ((pedestrianIndex * 7) % 5) - 2;
      pedestrianDummy.position.set(px, 0.55, pz);
      pedestrianDummy.rotation.y = (pedestrianIndex % 2) * Math.PI;
      pedestrianDummy.updateMatrix();
      pedestrianBody.setMatrixAt(pedestrianIndex, pedestrianDummy.matrix);
      pedestrianDummy.position.set(px, 1.08, pz);
      pedestrianDummy.scale.setScalar(1);
      pedestrianDummy.updateMatrix();
      pedestrianHeads.setMatrixAt(pedestrianIndex, pedestrianDummy.matrix);
      pedestrianIndex++;
    }
  }
  pedestrianBody.name = 'metropolis-resident-crowd';
  pedestrianHeads.name = 'metropolis-resident-heads';
  pedestrianBody.count = pedestrianIndex;
  pedestrianHeads.count = pedestrianIndex;
  root.add(pedestrianBody, pedestrianHeads);

  // Tráfego cenográfico estacionado em faixas; variedade de cores por veículo.
  const carMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.25 });
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(3.2, 1.15, 1.7), carMaterial, 54);
  const carDummy = new THREE.Object3D();
  const carColors = [0xcbd5e1, 0x1d4ed8, 0xb91c1c, 0x1f2937, 0xeab308];
  let carIndex = 0;
  for (let z = -216; z <= 216 && carIndex < 54; z += 32) {
    carDummy.position.set(-5.5, 0.62, z);
    carDummy.rotation.y = Math.PI/2;
    carDummy.updateMatrix();
    cars.setMatrixAt(carIndex, carDummy.matrix);
    cars.setColorAt(carIndex++, new THREE.Color(carColors[carIndex % carColors.length]));
  }
  cars.name = 'metropolis-traffic';
  cars.count = carIndex;
  root.add(cars);

  // Santuário secreto. O destino e as coordenadas permanecem compatíveis com o GPS atual.
  const sanctuary = new THREE.Group();
  sanctuary.name = 'hidden-oracle-sanctuary';
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8.2, 0.8, 32), concrete);
  dais.position.y = 0.35;
  sanctuary.add(dais);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.16, 10, 64), neon);
  ring.rotation.x = Math.PI/2;
  ring.position.y = 1.05;
  sanctuary.add(ring);
  for (let i=0;i<8;i++) {
    const angle = i/8*Math.PI*2;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.62,5.5,8),concrete);
    pillar.position.set(Math.cos(angle)*6.6,2.75,Math.sin(angle)*6.6);
    sanctuary.add(pillar);
  }
  const beacon = new THREE.PointLight(0x22d3ee,2.6,24);
  beacon.position.y=4.5;
  sanctuary.add(beacon);
  sanctuary.position.set(HIDDEN_NEW_YORK_SANCTUARY.x,0,HIDDEN_NEW_YORK_SANCTUARY.z);
  root.add(sanctuary);

  const portal = new THREE.Mesh(new THREE.TorusGeometry(2.4,0.12,8,40),neon);
  portal.name='oracle-gateway-marker';
  portal.position.set(-45,3.2,-202);
  root.add(portal);

  return colliders;
}

/** Nome de bairro para HUD; a posição do santuário continua secreta para terceiros. */
export function getMetropolisDistrictName(x: number, z: number): string | null {
  if (x < METROPOLIS_BOUNDS.minX || x > METROPOLIS_BOUNDS.maxX || z < METROPOLIS_BOUNDS.minZ || z > METROPOLIS_BOUNDS.maxZ) return null;
  if (x > 185) return 'Distrito Portuário';
  if (x < -155) return 'Bairro das Artes';
  if (z < -105 && x > -115 && x < -25) return 'Parque Central';
  if (x > 24 && x < 168 && z > -120 && z < 120) return 'Centro Financeiro';
  if (z > 120) return 'Bairro Residencial';
  return 'Centro Cívico';
}
