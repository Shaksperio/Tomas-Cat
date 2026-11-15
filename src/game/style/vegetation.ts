import * as THREE from 'three';
import { type Placement, PALETTE, createRng, scatterPlacements, type PlacementRules } from './artDirection';

/**
 * Natureza estilizada (instanciada: poucas chamadas de desenho): árvores
 * redondas, arbustos, flores, pedras e círculos de pedra ("santuários").
 * Modelos 100% originais, feitos de primitivas simples.
 */

export interface VegetationResult {
  group: THREE.Group;
  shrineSites: THREE.Vector3[];
}

function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  items: Placement[],
  place: (p: Placement, dummy: THREE.Object3D) => void,
  colorFor: ((p: Placement) => THREE.Color) | null,
  castShadow = false,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const dummy = new THREE.Object3D();
  items.forEach((p, i) => {
    place(p, dummy);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colorFor) mesh.setColorAt(i, colorFor(p));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}

const flat = (color: number) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, metalness: 0 });

export function buildVegetation(rules: PlacementRules, seed = 20261115): VegetationResult {
  const group = new THREE.Group();
  const shrineSites: THREE.Vector3[] = [];
  const treeGreens = [0x4aa83a, 0x3d963a, 0x6bbd45, 0x58b04a].map((c) => new THREE.Color(c));

  // Árvores: tronco + copa dupla de poliedros facetados.
  const trees = scatterPlacements(170, seed + 1, 3, rules, [0.9, 1.7]);
  const vcolor = (p: Placement) => treeGreens[Math.floor(p.variant * treeGreens.length) % treeGreens.length];
  group.add(
    instanced(
      new THREE.CylinderGeometry(0.22, 0.34, 2.4, 6),
      flat(0x7a5230),
      trees,
      (p, d) => {
        d.position.set(p.x, 1.2 * p.scale, p.z);
        d.rotation.set(0, p.rot, 0);
        d.scale.setScalar(p.scale);
      },
      null,
      true,
    ),
    instanced(
      new THREE.IcosahedronGeometry(1.7, 0),
      flat(0xffffff),
      trees,
      (p, d) => {
        d.position.set(p.x, 3.3 * p.scale, p.z);
        d.rotation.set(0, p.rot, 0);
        d.scale.set(p.scale, p.scale * 0.85, p.scale);
      },
      vcolor,
      true,
    ),
    instanced(
      new THREE.IcosahedronGeometry(1.05, 0),
      flat(0xffffff),
      trees,
      (p, d) => {
        d.position.set(p.x + 0.2 * p.scale, 4.7 * p.scale, p.z);
        d.rotation.set(0.4, p.rot, 0);
        d.scale.setScalar(p.scale);
      },
      (p) => vcolor(p).clone().offsetHSL(0, 0, 0.05),
    ),
  );

  // Arbustos.
  const bushes = scatterPlacements(260, seed + 2, 1.5, rules, [0.7, 1.3]);
  group.add(
    instanced(
      new THREE.IcosahedronGeometry(0.75, 0),
      flat(0xffffff),
      bushes,
      (p, d) => {
        d.position.set(p.x, 0.35 * p.scale, p.z);
        d.rotation.set(0, p.rot, 0);
        d.scale.set(p.scale * 1.2, p.scale * 0.8, p.scale);
      },
      (p) => treeGreens[Math.floor(p.variant * 4) % 4].clone().offsetHSL(0, 0, -0.04),
    ),
  );

  // Flores coloridas espalhadas em pequenos canteiros.
  const flowerColors = [0xffe14a, 0xff7ab8, 0xffffff, 0x7ab8ff, 0xff9a4a].map((c) => new THREE.Color(c));
  const patches = scatterPlacements(70, seed + 3, 1, rules, [1, 1]);
  const rng = createRng(seed + 4);
  const flowers: Placement[] = [];
  for (const patch of patches) {
    for (let i = 0; i < 9; i += 1) {
      flowers.push({
        x: patch.x + (rng() - 0.5) * 4,
        z: patch.z + (rng() - 0.5) * 4,
        scale: 0.7 + rng() * 0.6,
        rot: rng() * 6.28,
        variant: patch.variant,
      });
    }
  }
  group.add(
    instanced(
      new THREE.OctahedronGeometry(0.16, 0),
      flat(0xffffff),
      flowers,
      (p, d) => {
        d.position.set(p.x, 0.22 * p.scale, p.z);
        d.rotation.set(0, p.rot, 0);
        d.scale.setScalar(p.scale);
      },
      (p) => flowerColors[Math.floor(((p.variant * 7 + p.rot) % 1) * 5) % 5],
    ),
  );

  // Pedras com musgo.
  const rocks = scatterPlacements(110, seed + 5, 1.5, rules, [0.6, 1.8]);
  group.add(
    instanced(
      new THREE.DodecahedronGeometry(0.7, 0),
      flat(0xffffff),
      rocks,
      (p, d) => {
        d.position.set(p.x, 0.3 * p.scale, p.z);
        d.rotation.set(p.rot, p.rot * 0.7, 0);
        d.scale.set(p.scale, p.scale * 0.6, p.scale * 0.9);
      },
      (p) => new THREE.Color(p.variant > 0.5 ? 0xa8a493 : 0x8d9a7c),
      true,
    ),
  );

  // Santuários: círculo de pilares de pedra em volta de um altar com orbe quente.
  const siteCandidates: Array<[number, number]> = [
    [46, -34], [-44, 42], [100, 78], [-102, -88], [64, 112], [-70, 110], [112, -70], [-120, 40],
  ];
  const stoneMat = flat(0xb9b2a2);
  const slabMat = flat(0x8f897c);
  const orbMat = new THREE.MeshBasicMaterial({ color: PALETTE.lantern });
  let made = 0;
  for (const [sx, sz] of siteCandidates) {
    if (made >= 4) break;
    if (rules.isBlocked(sx, sz, 7)) continue;
    const shrine = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.35, 10), slabMat);
    base.position.y = 0.17;
    shrine.add(base);
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.9, 8), stoneMat);
    altar.position.y = 0.8;
    shrine.add(altar);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), orbMat);
    orb.position.y = 1.75;
    orb.userData.shrineOrb = true;
    shrine.add(orb);
    const light = new THREE.PointLight(PALETTE.lantern, 6, 14, 1.8);
    light.position.y = 1.9;
    shrine.add(light);
    const r = createRng(seed + 100 + made);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const h = 2.2 + r() * 1.6 - (i === 4 ? 1.2 : 0); // um pilar quebrado
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.7), stoneMat);
      pillar.position.set(Math.cos(a) * 3.4, 0.35 + h / 2, Math.sin(a) * 3.4);
      pillar.rotation.y = a;
      pillar.castShadow = true;
      shrine.add(pillar);
    }
    shrine.position.set(sx, 0, sz);
    group.add(shrine);
    shrineSites.push(new THREE.Vector3(sx, 0, sz));
    made += 1;
  }

  return { group, shrineSites };
}
