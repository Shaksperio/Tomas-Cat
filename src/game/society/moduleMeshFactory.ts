/**
 * Fábrica de meshes low-poly para módulos do catálogo aprovado.
 * Só apresenta geometria; não altera a simulação nem inventa assets.
 */
import * as THREE from 'three';
import {
  type ConstructionAssetId,
  isApprovedConstructionAsset,
  pickModuleAssetIdFromTaskId,
} from './constructionCatalog';

function mat(color: number, roughness = 0.88): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  y = h / 2,
  x = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildShelter(): THREE.Group {
  const g = new THREE.Group();
  const stone = mat(0x87939d, 0.92);
  const timber = mat(0x79543a, 0.88);
  const roofMat = mat(0x344b5b, 0.82);
  g.add(box(2.3, 0.22, 2.1, stone, 0.11));
  for (const x of [-0.92, 0.92]) {
    for (const z of [-0.78, 0.78]) {
      g.add(box(0.16, 1.55, 0.16, timber, 0.98, x, z));
    }
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.72, 0.82, 4), roofMat);
  roof.position.y = 2.08;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.82;
  roof.castShadow = true;
  g.add(roof);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.3, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x082f49, emissiveIntensity: 0.45 }),
  );
  sign.position.set(0, 1.05, 0.91);
  g.add(sign);
  return g;
}

function buildWarehouse(): THREE.Group {
  const g = new THREE.Group();
  const wall = mat(0x6b7280, 0.9);
  const roofMat = mat(0x1e293b, 0.8);
  g.add(box(3.0, 1.8, 2.6, wall, 0.9));
  g.add(box(3.2, 0.18, 2.8, roofMat, 1.9));
  g.add(box(0.9, 1.4, 0.12, mat(0x334155), 0.7, 0, 1.35));
  return g;
}

function buildWorkshop(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.6, 1.5, 2.2, mat(0xa16207, 0.85), 0.75));
  g.add(box(2.8, 0.2, 2.4, mat(0x78350f), 1.6));
  g.add(box(1.2, 0.5, 0.8, mat(0x57534e), 0.4, 0.6, 0.2));
  return g;
}

function buildFarmPlot(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(3.0, 0.12, 3.0, mat(0x3f6212, 0.95), 0.06));
  const soil = mat(0x44403c, 0.98);
  for (let i = -1; i <= 1; i++) {
    g.add(box(2.6, 0.08, 0.35, soil, 0.12, 0, i * 0.85));
  }
  const crop = mat(0x65a30d, 0.7);
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 5), crop);
    c.position.set(-1 + (i % 3) * 1, 0.35, -0.7 + Math.floor(i / 3) * 1.2);
    g.add(c);
  }
  return g;
}

function buildWatchtower(): THREE.Group {
  const g = new THREE.Group();
  const timber = mat(0x92400e, 0.85);
  g.add(box(0.35, 3.2, 0.35, timber, 1.6, -0.55, -0.55));
  g.add(box(0.35, 3.2, 0.35, timber, 1.6, 0.55, -0.55));
  g.add(box(0.35, 3.2, 0.35, timber, 1.6, -0.55, 0.55));
  g.add(box(0.35, 3.2, 0.35, timber, 1.6, 0.55, 0.55));
  g.add(box(1.5, 0.2, 1.5, mat(0x78350f), 3.3));
  g.add(box(1.3, 0.9, 1.3, mat(0xa16207, 0.8), 3.85));
  return g;
}

function buildMarketStall(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.8, 0.15, 1.4, mat(0x92400e), 0.9));
  g.add(box(0.12, 0.9, 0.12, mat(0x78350f), 0.45, -0.8, -0.55));
  g.add(box(0.12, 0.9, 0.12, mat(0x78350f), 0.45, 0.8, -0.55));
  g.add(box(0.12, 0.9, 0.12, mat(0x78350f), 0.45, -0.8, 0.55));
  g.add(box(0.12, 0.9, 0.12, mat(0x78350f), 0.45, 0.8, 0.55));
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.08, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.75 }),
  );
  canopy.position.y = 1.15;
  g.add(canopy);
  return g;
}

function buildBridgeSegment(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(4.0, 0.2, 1.4, mat(0x78716c, 0.9), 0.5));
  g.add(box(0.15, 0.7, 0.15, mat(0x57534e), 0.35, -1.8, 0.55));
  g.add(box(0.15, 0.7, 0.15, mat(0x57534e), 0.35, 1.8, 0.55));
  g.add(box(0.15, 0.7, 0.15, mat(0x57534e), 0.35, -1.8, -0.55));
  g.add(box(0.15, 0.7, 0.15, mat(0x57534e), 0.35, 1.8, -0.55));
  return g;
}

function buildRoadSegment(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(4.0, 0.12, 2.0, mat(0x57534e, 0.98), 0.06));
  g.add(box(3.6, 0.02, 0.12, mat(0xfbbf24, 0.6), 0.13));
  return g;
}

const BUILDERS: Record<ConstructionAssetId, () => THREE.Group> = {
  module_shelter_basic: buildShelter,
  module_warehouse: buildWarehouse,
  module_workshop: buildWorkshop,
  module_farm_plot: buildFarmPlot,
  module_watchtower: buildWatchtower,
  module_market_stall: buildMarketStall,
  module_bridge_segment: buildBridgeSegment,
  module_road_segment: buildRoadSegment,
};

/**
 * Cria o grupo 3D de um asset aprovado.
 * Assets desconhecidos caem no abrigo básico (nunca geometria arbitrária inventada).
 */
export function createModuleMesh(assetId: string): THREE.Group {
  const id = (isApprovedConstructionAsset(assetId)
    ? assetId
    : 'module_shelter_basic') as ConstructionAssetId;
  const group = BUILDERS[id]();
  group.userData.assetId = id;
  return group;
}

/** Conveniência: mesh a partir do id de tarefa (sem asset explícito). */
export function createModuleMeshForTask(taskId: string): THREE.Group {
  return createModuleMesh(pickModuleAssetIdFromTaskId(taskId));
}
