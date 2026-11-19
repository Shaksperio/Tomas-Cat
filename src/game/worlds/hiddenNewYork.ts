import * as THREE from 'three';
import type { ColliderBox } from '../worldBuilder';

/** Destino secreto da missão da Oráculo, dentro do distrito oculto de Manhattan. */
export const HIDDEN_NEW_YORK_SANCTUARY = Object.freeze({ x: -45, y: 0, z: -190 });

/**
 * Manhattan compacta e procedural: malha urbana leve, avenidas, parque,
 * East River, ponte e marcos originais. Não carrega os enormes arquivos CityGML.
 */
export function buildHiddenNewYorkDistrict(root: THREE.Group): ColliderBox[] {
  const colliders: ColliderBox[] = [];
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x252d3a, roughness: 0.92 });
  const avenue = new THREE.MeshStandardMaterial({ color: 0x343c48, roughness: 0.9 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x596575, roughness: 0.88, metalness: 0.12 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x173e59, roughness: 0.22, metalness: 0.72, emissive: 0x06243a, emissiveIntensity: 0.45 });
  const parkMat = new THREE.MeshStandardMaterial({ color: 0x244d3b, roughness: 1 });
  const riverMat = new THREE.MeshStandardMaterial({ color: 0x0b526d, roughness: 0.2, metalness: 0.35, transparent: true, opacity: 0.92 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0891b2, emissiveIntensity: 1.8, metalness: 0.45, roughness: 0.2 });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 145), asphalt);
  ground.name = 'hidden-nyc-ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.035, -150);
  ground.receiveShadow = true;
  root.add(ground);

  const roadNorthSouth = new THREE.Mesh(new THREE.PlaneGeometry(13, 142), avenue);
  roadNorthSouth.rotation.x = -Math.PI / 2;
  roadNorthSouth.position.set(0, 0.012, -150);
  const roadEastWest = new THREE.Mesh(new THREE.PlaneGeometry(215, 12), avenue);
  roadEastWest.rotation.x = -Math.PI / 2;
  roadEastWest.position.set(0, 0.014, -150);
  root.add(roadNorthSouth, roadEastWest);

  const river = new THREE.Mesh(new THREE.PlaneGeometry(32, 145), riverMat);
  river.name = 'east-river';
  river.rotation.x = -Math.PI / 2;
  river.position.set(94, -0.24, -150);
  root.add(river);

  const park = new THREE.Mesh(new THREE.PlaneGeometry(28, 72), parkMat);
  park.name = 'central-park';
  park.rotation.x = -Math.PI / 2;
  park.position.set(-45, 0.025, -157);
  root.add(park);

  // Árvores compactas em uma única malha instanciada.
  const treeGeometry = new THREE.ConeGeometry(1.2, 5.2, 6);
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x286348, roughness: 1 });
  const trees = new THREE.InstancedMesh(treeGeometry, treeMaterial, 28);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 28; i++) {
    const row = Math.floor(i / 7);
    const col = i % 7;
    dummy.position.set(-57 + col * 4, 2.6, -184 + row * 17);
    dummy.scale.setScalar(0.72 + (i % 3) * 0.16);
    dummy.updateMatrix();
    trees.setMatrixAt(i, dummy.matrix);
  }
  trees.name = 'central-park-trees';
  root.add(trees);

  // Quadras de Manhattan. Instancing mantém baixo o número de draw calls.
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x667487, roughness: 0.72, metalness: 0.32 });
  const buildings: Array<{ x: number; z: number; w: number; d: number; h: number; id: string }> = [];
  const xs = [-82, -58, -18, 20, 56, 82];
  const zs = [-105, -132, -160, -187, -211];
  for (let zi = 0; zi < zs.length; zi++) {
    for (let xi = 0; xi < xs.length; xi++) {
      const x = xs[xi];
      const z = zs[zi];
      if (x < -28 && x > -64 && z > -194 && z < -119) continue; // parque
      if (Math.hypot(x - HIDDEN_NEW_YORK_SANCTUARY.x, z - HIDDEN_NEW_YORK_SANCTUARY.z) < 19) continue;
      const h = 15 + ((xi * 13 + zi * 17) % 7) * 5;
      buildings.push({ x, z, w: 13 + (xi % 2) * 3, d: 17, h, id: `manhattan-block-${zi}-${xi}` });
    }
  }
  const instances = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, buildings.length);
  buildings.forEach((b, i) => {
    dummy.position.set(b.x, b.h / 2, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    instances.setMatrixAt(i, dummy.matrix);
    colliders.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, minY: 0, topY: b.h, climbable: true });
  });
  instances.name = 'manhattan-procedural-buildings';
  instances.castShadow = true;
  instances.receiveShadow = true;
  root.add(instances);

  // Empire State Building estilizado: silhueta reconhecível, geometria original.
  const empire = new THREE.Group();
  empire.name = 'empire-state-landmark';
  const tiers = [
    { y: 11, w: 13, d: 13, h: 22 },
    { y: 27, w: 9, d: 9, h: 12 },
    { y: 39, w: 5, d: 5, h: 12 },
  ];
  for (const tier of tiers) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(tier.w, tier.h, tier.d), glass);
    mesh.position.y = tier.y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    empire.add(mesh);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1, 13, 8), cyan);
  spire.position.y = 51;
  empire.add(spire);
  empire.position.set(20, 0, -145);
  root.add(empire);
  colliders.push({ minX: 13.5, maxX: 26.5, minZ: -151.5, maxZ: -138.5, minY: 0, topY: 46, climbable: true });

  // Ponte suspensa sobre o East River.
  const bridge = new THREE.Group();
  bridge.name = 'brooklyn-bridge-landmark';
  const deck = new THREE.Mesh(new THREE.BoxGeometry(42, 0.8, 5), concrete);
  deck.position.set(75, 8, -150);
  deck.castShadow = true;
  bridge.add(deck);
  for (const x of [57, 93]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 18, 3), concrete);
    tower.position.set(x, 9, -150);
    bridge.add(tower);
  }
  const cable = new THREE.Mesh(new THREE.TorusGeometry(19, 0.22, 6, 48, Math.PI), cyan);
  cable.rotation.z = Math.PI;
  cable.position.set(75, 17, -150);
  bridge.add(cable);
  root.add(bridge);

  // Santuário discreto: círculo de pedra, monólitos e anel luminoso.
  const sanctuary = new THREE.Group();
  sanctuary.name = 'hidden-oracle-sanctuary';
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8.2, 0.8, 32), concrete);
  dais.position.y = 0.35;
  dais.receiveShadow = true;
  sanctuary.add(dais);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.16, 10, 64), cyan);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.05;
  sanctuary.add(ring);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 5.5, 8), concrete);
    pillar.position.set(Math.cos(angle) * 6.6, 2.75, Math.sin(angle) * 6.6);
    pillar.castShadow = true;
    sanctuary.add(pillar);
  }
  const beacon = new THREE.PointLight(0x22d3ee, 2.6, 24);
  beacon.position.y = 4.5;
  sanctuary.add(beacon);
  sanctuary.position.set(HIDDEN_NEW_YORK_SANCTUARY.x, 0, HIDDEN_NEW_YORK_SANCTUARY.z);
  root.add(sanctuary);

  // Letreiro holográfico no acesso ao distrito secreto.
  const sign = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 8, 40), cyan);
  sign.name = 'oracle-gateway-marker';
  sign.position.set(-45, 3.2, -202);
  root.add(sign);

  return colliders;
}
