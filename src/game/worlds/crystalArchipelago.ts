import * as THREE from 'three';
import type { BuiltWorld, ColliderBox } from '../worldBuilder';

/** Cena procedural original do Arquipélago; geometria estática e posições determinísticas. */
export function buildCrystalArchipelago(root: THREE.Group): BuiltWorld {
  const colliders: ColliderBox[] = [];
  const neonMaterials: THREE.MeshStandardMaterial[] = [];
  const waterMeshes: THREE.Mesh[] = [];
  const interactables: BuiltWorld['interactables'] = [];
  const predators: BuiltWorld['predators'] = [];
  const phaseGates: BuiltWorld['phaseGates'] = [];
  const indoorZones: BuiltWorld['indoorZones'] = [];

  const oceanMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b6478,
    emissive: 0x063b50,
    emissiveIntensity: 0.55,
    roughness: 0.22,
    metalness: 0.28,
    transparent: true,
    opacity: 0.94,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(440, 440, 1, 1), oceanMaterial);
  ocean.name = 'crystal-ocean';
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -1.15;
  ocean.receiveShadow = true;
  root.add(ocean);
  waterMeshes.push(ocean);

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(340, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x8bc9e8, side: THREE.BackSide, fog: false }),
  );
  skyDome.name = 'archipelago-sky';
  root.add(skyDome);

  const islandMaterial = new THREE.MeshStandardMaterial({
    color: 0x536d67,
    roughness: 0.94,
    metalness: 0.02,
  });
  const islandTopMaterial = new THREE.MeshStandardMaterial({
    color: 0x819b82,
    roughness: 1,
  });
  const bridgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b9e9b,
    roughness: 0.76,
    metalness: 0.12,
  });
  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: 0x65e7f2,
    emissive: 0x1aa9cf,
    emissiveIntensity: 1.65,
    roughness: 0.18,
    metalness: 0.34,
  });
  const violetCrystalMaterial = new THREE.MeshStandardMaterial({
    color: 0xa88cff,
    emissive: 0x6543c7,
    emissiveIntensity: 1.2,
    roughness: 0.2,
    metalness: 0.3,
  });
  neonMaterials.push(crystalMaterial, violetCrystalMaterial);

  const islands = [
    { id: 'sanctuary', x: 0, z: 18, rx: 38, rz: 34 },
    { id: 'west', x: -68, z: -30, rx: 23, rz: 21 },
    { id: 'east', x: 72, z: -22, rx: 25, rz: 22 },
    { id: 'north', x: 4, z: 91, rx: 22, rz: 19 },
    { id: 'south', x: -12, z: -82, rx: 19, rz: 18 },
  ] as const;

  for (const island of islands) {
    const base = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), islandMaterial);
    base.name = `island-base:${island.id}`;
    base.scale.set(island.rx, 2.8, island.rz);
    base.position.set(island.x, -2.8, island.z);
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const top = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      islandTopMaterial,
    );
    top.name = `island-ground:${island.id}`;
    top.scale.set(island.rx * 0.96, island.rz * 0.96, 1);
    top.rotation.x = -Math.PI / 2;
    top.position.set(island.x, 0.015, island.z);
    top.receiveShadow = true;
    root.add(top);
  }

  const bridgeLinks = [
    [{ x: -34, z: 0 }, { x: -49, z: -18 }],
    [{ x: 36, z: 3 }, { x: 54, z: -15 }],
    [{ x: 2, z: 49 }, { x: 4, z: 72 }],
    [{ x: -8, z: -16 }, { x: -10, z: -64 }],
  ] as const;
  for (const [a, b] of bridgeLinks) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.7, length), bridgeMaterial);
    bridge.name = 'ancient-stone-bridge';
    bridge.position.set((a.x + b.x) / 2, -0.05, (a.z + b.z) / 2);
    bridge.rotation.y = Math.atan2(dx, dz);
    bridge.castShadow = true;
    bridge.receiveShadow = true;
    root.add(bridge);
    colliders.push({
      minX: Math.min(a.x, b.x) - 2.8,
      maxX: Math.max(a.x, b.x) + 2.8,
      minZ: Math.min(a.z, b.z) - 2.8,
      maxZ: Math.max(a.z, b.z) + 2.8,
      minY: -0.4,
      topY: 0.3,
    });
  }

  const crystalSites = [
    { x: -12, z: 15, scale: 1.25, violet: false },
    { x: 13, z: 28, scale: 1.75, violet: true },
    { x: -73, z: -29, scale: 1.5, violet: true },
    { x: 77, z: -18, scale: 1.9, violet: false },
    { x: 2, z: 98, scale: 1.45, violet: false },
    { x: -15, z: -86, scale: 1.35, violet: true },
  ] as const;
  for (const site of crystalSites) {
    const material = site.violet ? violetCrystalMaterial : crystalMaterial;
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), material);
    crystal.name = 'resonant-crystal-spire';
    crystal.scale.set(1.05 * site.scale, 3.8 * site.scale, 1.05 * site.scale);
    crystal.position.set(site.x, 3.8 * site.scale, site.z);
    crystal.rotation.y = (site.x + site.z) * 0.013;
    crystal.castShadow = true;
    root.add(crystal);
    colliders.push({
      minX: site.x - 1.15 * site.scale,
      maxX: site.x + 1.15 * site.scale,
      minZ: site.z - 1.15 * site.scale,
      maxZ: site.z + 1.15 * site.scale,
      minY: 0,
      topY: 7.6 * site.scale,
    });
  }

  // Anel monumental no santuário central, composto por peças geométricas originais.
  const archMaterial = new THREE.MeshStandardMaterial({
    color: 0x9bb6b8,
    roughness: 0.55,
    metalness: 0.32,
  });
  const arch = new THREE.Group();
  arch.name = 'tide-observatory';
  arch.position.set(0, 0, 18);
  const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 12, 2.8), archMaterial);
  leftPillar.position.set(-7, 6, 0);
  const rightPillar = leftPillar.clone();
  rightPillar.position.x = 7;
  const lintel = new THREE.Mesh(new THREE.TorusGeometry(7, 0.8, 10, 48, Math.PI), crystalMaterial);
  lintel.position.y = 11.6;
  lintel.rotation.z = Math.PI;
  arch.add(leftPillar, rightPillar, lintel);
  arch.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  root.add(arch);
  colliders.push(
    { minX: -8.5, maxX: -5.5, minZ: 16.5, maxZ: 19.5, minY: 0, topY: 12 },
    { minX: 5.5, maxX: 8.5, minZ: 16.5, maxZ: 19.5, minY: 0, topY: 12 },
  );

  const getSectorName = (x: number, z: number): string => {
    if (z > 65) return 'Ilha do Observatório';
    if (z < -55) return 'Ilha das Marés';
    if (x < -45) return 'Jardins de Ametista';
    if (x > 45) return 'Falésias de Ciano';
    return 'Santuário das Correntes';
  };

  return {
    colliders,
    indoorZones,
    phaseGates,
    interactables,
    predators,
    neonMaterials,
    waterMeshes,
    waterBodies: [],
    rivers: [],
    skyDome,
    getSectorName,
  };
}
