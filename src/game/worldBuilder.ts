import * as THREE from 'three';
import { CHAPTER_PHASES, InteractionKind, LoreLog } from '../types/game';
import { createPredatorMesh, PredatorActor } from './enemyModels';
import { ProceduralTextureSet } from './textures';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  topY: number;
  climbable?: boolean;
  isBarrier?: boolean;
}

export interface PhaseGate {
  phaseRequired: number; // Gate unlocks once boss of phaseRequired is defeated
  mesh: THREE.Group;
  collider: ColliderBox;
  unlocked: boolean;
}

export interface WorldInteractable {
  id: string;
  kind: InteractionKind;
  name: string;
  position: THREE.Vector3;
  mesh: THREE.Group;
  beaconRing: THREE.Mesh;
  active: boolean;
  respawnTimer: number;
  maxRespawn: number;
  amount: number;
  xpGain: number;
  shelterLevel?: number;
  shelterDome?: THREE.Mesh;
  shelterLight?: THREE.PointLight;
  homePos?: THREE.Vector3;
  wanderAngle?: number;
  lore?: LoreLog;
}

export interface IndoorZone {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  ceilingY: number;
}

export interface BuiltWorld {
  colliders: ColliderBox[];
  indoorZones: IndoorZone[];
  phaseGates: PhaseGate[];
  interactables: WorldInteractable[];
  predators: PredatorActor[];
  neonMaterials: THREE.MeshStandardMaterial[];
  waterMeshes: THREE.Mesh[];
  skyDome: THREE.Mesh;
  getSectorName: (x: number, z: number) => string;
}

export const WORLD_BOUNDS = 220;

export const LORE_LOGS: LoreLog[] = [
  {
    id: 'term-plaza',
    title: 'Diário #01 — Zona de Quarentena',
    sector: 'Rua da Quarentena',
    content:
      'Dia 14 pós-colapso. As cercas militares não seguraram a praga nem os saques. Os moradores abandonaram as casas às pressas. Só os gatos e os ratos mutantes restaram nos becos.',
  },
  {
    id: 'term-rooftops',
    title: 'Diário #02 — A Estrada dos Telhados',
    sector: 'Bairro dos Telhados',
    content:
      'Nas avenidas largas os predadores encurralam qualquer um. Quem aprendeu a escalar fachadas e disputar o topo dos edifícios conquistou respeito e soberania.',
  },
  {
    id: 'term-hospital',
    title: 'Diário #03 — Complexo Hospitalar',
    sector: 'Complexo Submerso',
    content:
      'Os cães de guarda cibernéticos do hospital ficaram presos em modo de proteção territorial. Só um felino evoluído e ágil consegue enfrentar o Cão Alfa.',
  },
  {
    id: 'term-stadium',
    title: 'Diário #04 — O Rei do Estádio',
    sector: 'Estádio Devastado',
    content:
      'Um leão geneticamente modificado escapou do bio-zoológico e tomou a arena sul. Quem o derrotar e dominar os telhados se tornará o Gato Líder & Alpha.',
  },
];

export function buildPostApocalypticWorld(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
): BuiltWorld {
  const colliders: ColliderBox[] = [];
  const indoorZones: IndoorZone[] = [];
  const phaseGates: PhaseGate[] = [];
  const interactables: WorldInteractable[] = [];
  const predators: PredatorActor[] = [];
  const neonMaterials: THREE.MeshStandardMaterial[] = [];
  const waterMeshes: THREE.Mesh[] = [];

  // Atmospheric Sky Dome with Horizon Gradient for real 3D expanse & depth
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4;
  skyCanvas.height = 128;
  const sctx = skyCanvas.getContext('2d')!;
  const sgrad = sctx.createLinearGradient(0, 0, 0, 128);
  sgrad.addColorStop(0.0, '#09111f');
  sgrad.addColorStop(0.45, '#1e3554');
  sgrad.addColorStop(0.68, '#426a8c');
  sgrad.addColorStop(1.0, '#132030');
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 4, 128);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(520, 24, 14),
    new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      color: 0xffffff,
    }),
  );
  scene.add(skyDome);

  // Vast open-world ground plane (580m x 580m)
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.92,
    metalness: 0.08,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(580, 580), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Main cross-city avenues & instanced dashed lane markings (single draw call!)
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x111824,
    roughness: 0.95,
    metalness: 0.05,
  });
  const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(14, 430), roadMat);
  roadNS.rotation.x = -Math.PI / 2;
  roadNS.position.y = 0.015;
  roadNS.receiveShadow = true;
  const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(430, 14), roadMat);
  roadEW.rotation.x = -Math.PI / 2;
  roadEW.position.y = 0.016;
  roadEW.receiveShadow = true;
  scene.add(roadNS, roadEW);

  const dashPositions: { x: number; z: number; rotY: number }[] = [];
  for (let i = -195; i <= 195; i += 14) {
    if (Math.abs(i) < 12) continue;
    dashPositions.push({ x: 0, z: i, rotY: 0 });
    dashPositions.push({ x: i, z: 0, rotY: Math.PI / 2 });
  }
  const dashInst = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.38, 5.5),
    new THREE.MeshBasicMaterial({ color: 0x94a3b8 }),
    dashPositions.length,
  );
  const dashDummy = new THREE.Object3D();
  dashPositions.forEach((p, idx) => {
    dashDummy.position.set(p.x, 0.025, p.z);
    dashDummy.rotation.set(-Math.PI / 2, 0, p.rotY);
    dashDummy.updateMatrix();
    dashInst.setMatrixAt(idx, dashDummy.matrix);
  });
  dashInst.instanceMatrix.needsUpdate = true;
  scene.add(dashInst);

  const buildingMat = new THREE.MeshStandardMaterial({
    map: textures.buildingConcrete,
    roughness: 0.86,
    metalness: 0.14,
  });
  const interiorFloorMat = new THREE.MeshStandardMaterial({
    color: 0x262e3d,
    roughness: 0.9,
    metalness: 0.05,
  });
  const containerRedMat = new THREE.MeshStandardMaterial({
    map: textures.rustedMetal,
    color: 0x9a3412,
    roughness: 0.72,
    metalness: 0.35,
  });
  const containerTealMat = new THREE.MeshStandardMaterial({
    map: textures.rustedMetal,
    color: 0x155e75,
    roughness: 0.68,
    metalness: 0.38,
  });
  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.78,
  });
  const woodPlankMat = new THREE.MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.9,
    metalness: 0.05,
  });
  const climbTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xb45309,
    emissiveIntensity: 0.45,
    roughness: 0.6,
  });
  const bioMossMat = new THREE.MeshStandardMaterial({
    color: 0x14532d,
    roughness: 0.9,
    metalness: 0.05,
  });

  // Helper: Solid climbable platform / crate / vehicle / rooftop bridge
  const addPlatformBox = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    baseY: number,
    mat: THREE.Material,
    climbable = true,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, baseY + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      minY: baseY,
      topY: baseY + h,
      climbable,
    });
    return mesh;
  };

  // Helper: 100% ACCESSIBLE Hollow Building (walk-in doorway + interior + climbable walls + walkable rooftop!)
  const addAccessibleBuilding = (
    cx: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    doorSide: 'north' | 'south' | 'east' | 'west',
    mat: THREE.Material = buildingMat,
  ) => {
    const wallT = 0.65;
    indoorZones.push({
      minX: cx - w / 2 + wallT,
      maxX: cx + w / 2 - wallT,
      minZ: cz - d / 2 + wallT,
      maxZ: cz + d / 2 - wallT,
      ceilingY: h - 0.5,
    });
    const doorW = Math.min(3.8, Math.min(w, d) * 0.42);
    const doorH = Math.min(3.0, h * 0.62);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(w - wallT, 0.08, d - wallT), interiorFloorMat);
    floor.position.set(cx, 0.04, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.45, d + 0.35), darkSteelMat);
    roof.position.set(cx, h - 0.225, cz);
    roof.castShadow = true;
    roof.receiveShadow = true;
    scene.add(roof);
    colliders.push({
      minX: cx - (w + 0.35) / 2,
      maxX: cx + (w + 0.35) / 2,
      minZ: cz - (d + 0.35) / 2,
      maxZ: cz + (d + 0.35) / 2,
      minY: h - 0.5,
      topY: h,
      climbable: false,
    });

    const buildSolidWall = (wx: number, wz: number, ww: number, wh: number, wd: number, addGrip = false) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), mat);
      m.position.set(wx, wh / 2, wz);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      colliders.push({
        minX: wx - ww / 2,
        maxX: wx + ww / 2,
        minZ: wz - wd / 2,
        maxZ: wz + wd / 2,
        minY: 0,
        topY: h,
        climbable: true,
      });

      if (addGrip) {
        const grip = new THREE.Mesh(
          new THREE.BoxGeometry(ww > wd ? 1.0 : ww + 0.16, wh - 0.5, wd > ww ? 1.0 : wd + 0.16),
          climbTrimMat,
        );
        grip.position.set(wx, wh / 2, wz);
        scene.add(grip);
      }
    };

    const buildDoorWall = (
      isHorizontal: boolean,
      fixedCoord: number,
      spanLen: number,
    ) => {
      const segLen = (spanLen - doorW) / 2;
      if (isHorizontal) {
        buildSolidWall(cx - (doorW / 2 + segLen / 2), fixedCoord, segLen, h, wallT);
        buildSolidWall(cx + (doorW / 2 + segLen / 2), fixedCoord, segLen, h, wallT);
        const lintelH = h - doorH;
        if (lintelH > 0.2) {
          const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, wallT), mat);
          lintel.position.set(cx, doorH + lintelH / 2, fixedCoord);
          lintel.castShadow = true;
          scene.add(lintel);
        }
      } else {
        buildSolidWall(fixedCoord, cz - (doorW / 2 + segLen / 2), wallT, h, segLen);
        buildSolidWall(fixedCoord, cz + (doorW / 2 + segLen / 2), wallT, h, segLen);
        const lintelH = h - doorH;
        if (lintelH > 0.2) {
          const lintel = new THREE.Mesh(new THREE.BoxGeometry(wallT, lintelH, doorW), mat);
          lintel.position.set(fixedCoord, doorH + lintelH / 2, cz);
          lintel.castShadow = true;
          scene.add(lintel);
        }
      }
    };

    if (doorSide === 'north') buildDoorWall(true, cz - d / 2, w);
    else buildSolidWall(cx, cz - d / 2, w, h, wallT, true);

    if (doorSide === 'south') buildDoorWall(true, cz + d / 2, w);
    else buildSolidWall(cx, cz + d / 2, w, h, wallT, true);

    if (doorSide === 'west') buildDoorWall(false, cx - w / 2, d);
    else buildSolidWall(cx - w / 2, cz, wallT, h, d, true);

    if (doorSide === 'east') buildDoorWall(false, cx + w / 2, d);
    else buildSolidWall(cx + w / 2, cz, wallT, h, d, true);
  };

  // Perimeter ruined megacity walls + distant towering skyline silhouettes for true 3D depth!
  const perimeterSpecs: [number, number, number, number][] = [
    [0, -226, 464, 10],
    [0, 226, 464, 10],
    [-226, 0, 10, 464],
    [226, 0, 10, 464],
  ];
  perimeterSpecs.forEach(([px, pz, pw, pd]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(pw, 16, pd), buildingMat);
    wall.position.set(px, 8, pz);
    scene.add(wall);
  });

  // Distant towering megacity skyline silhouettes with lit neon window bands (instanced!)
  const skylineCount = 48;
  const skylineBodyInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x172338,
      roughness: 0.85,
      metalness: 0.25,
    }),
    skylineCount,
  );
  const skylineWinMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.1,
  });
  neonMaterials.push(skylineWinMat);
  const skylineWinInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.02, 0.06, 1.02),
    skylineWinMat,
    skylineCount,
  );
  const skyDummy = new THREE.Object3D();
  for (let i = 0; i < skylineCount; i++) {
    const angle = (i / skylineCount) * Math.PI * 2;
    const r = 248 + (i % 4) * 22;
    const h = 34 + ((i * 17) % 62);
    const w = 14 + (i % 4) * 6;
    const sx = Math.cos(angle) * r;
    const sz = Math.sin(angle) * r;
    skyDummy.position.set(sx, h / 2, sz);
    skyDummy.rotation.set(0, angle, 0);
    skyDummy.scale.set(w, h, w);
    skyDummy.updateMatrix();
    skylineBodyInst.setMatrixAt(i, skyDummy.matrix);

    skyDummy.position.set(sx, h * 0.72, sz);
    skyDummy.scale.set(w, h, w);
    skyDummy.updateMatrix();
    skylineWinInst.setMatrixAt(i, skyDummy.matrix);
  }
  skylineBodyInst.instanceMatrix.needsUpdate = true;
  skylineWinInst.instanceMatrix.needsUpdate = true;
  scene.add(skylineBodyInst, skylineWinInst);

  // Instanced streetlamp poles & glowing bulbs along avenues (2 draw calls total!)
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.5,
  });
  neonMaterials.push(lampGlowMat);
  const lampCoords: [number, number][] = [];
  for (let d = -180; d <= 180; d += 36) {
    if (Math.abs(d) < 18) continue;
    lampCoords.push([8.5, d], [-8.5, d], [d, 8.5], [d, -8.5]);
  }
  const poleInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.16, 6.2, 6),
    darkSteelMat,
    lampCoords.length,
  );
  const bulbInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.7, 0.22, 0.35),
    lampGlowMat,
    lampCoords.length,
  );
  const lampDummy = new THREE.Object3D();
  lampCoords.forEach(([lx, lz], idx) => {
    lampDummy.position.set(lx, 3.1, lz);
    lampDummy.rotation.set(0, 0, 0);
    lampDummy.scale.set(1, 1, 1);
    lampDummy.updateMatrix();
    poleInst.setMatrixAt(idx, lampDummy.matrix);

    lampDummy.position.set(lx, 6.1, lz);
    lampDummy.updateMatrix();
    bulbInst.setMatrixAt(idx, lampDummy.matrix);
  });
  poleInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  scene.add(poleInst, bulbInst);

  // =========================================================================
  // FASE 1: SUBÚRBIO EM QUARENTENA (Centro & Norte, x: -42..42, z: -120..42)
  // =========================================================================
  addAccessibleBuilding(-22, -12, 11, 4.6, 11, 'east');
  addAccessibleBuilding(22, -14, 12, 5.2, 11, 'west');
  addAccessibleBuilding(-22, -38, 10, 4.4, 10, 'south');
  addAccessibleBuilding(22, -40, 11, 5.6, 10, 'west');
  addAccessibleBuilding(-24, -76, 12, 5.0, 11, 'east');
  addAccessibleBuilding(24, -76, 12, 5.0, 11, 'west');

  // Wrecked cars, buses & climbable containers along the quarantine avenue
  addPlatformBox(-6, -18, 4.2, 1.5, 2.4, 0, containerRedMat, true);
  addPlatformBox(8, -28, 5.5, 2.1, 2.8, 0, containerTealMat, true);
  addPlatformBox(-5, -45, 7.5, 2.6, 2.8, 0, containerRedMat, true);
  addPlatformBox(10, -86, 4.8, 1.8, 4.0, 0, containerTealMat, true);

  // Rooftop plank bridges in Phase 1
  addPlatformBox(-22, -25, 2.8, 0.28, 15, 4.4, woodPlankMat, false);
  addPlatformBox(22, -27, 2.8, 0.28, 15, 5.2, woodPlankMat, false);

  // =========================================================================
  // FASE 2: DISTRITO DOS PRÉDIOS & TELHADOS (Leste, x: +52..+205)
  // =========================================================================
  addAccessibleBuilding(64, -22, 14, 6.2, 14, 'south');
  addAccessibleBuilding(64, 22, 14, 5.8, 14, 'north');
  addAccessibleBuilding(96, -24, 15, 7.6, 15, 'west');
  addAccessibleBuilding(96, 24, 15, 6.8, 15, 'west');
  addAccessibleBuilding(148, -24, 16, 8.8, 16, 'south');
  addAccessibleBuilding(148, 22, 16, 7.4, 16, 'north');
  addAccessibleBuilding(178, 0, 14, 9.6, 20, 'west');

  // Connected rooftop skybridges & containers
  addPlatformBox(64, 0, 3.6, 0.35, 30, 5.8, woodPlankMat, false);
  addPlatformBox(80, -23, 18, 0.4, 3.6, 6.2, darkSteelMat, false);
  addPlatformBox(80, 23, 18, 0.4, 3.6, 5.8, darkSteelMat, false);
  addPlatformBox(122, -24, 36, 0.45, 4.0, 7.6, darkSteelMat, false);
  addPlatformBox(148, -1, 3.8, 0.4, 30, 7.4, darkSteelMat, false);
  addPlatformBox(54, 12, 4.5, 2.2, 6.5, 0, containerRedMat, true);
  addPlatformBox(132, 6, 5.0, 2.4, 7.0, 0, containerTealMat, true);

  const signMatB = new THREE.MeshStandardMaterial({
    map: textures.neonSignB,
    emissive: 0xd97706,
    emissiveMap: textures.neonSignB,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  neonMaterials.push(signMatB);
  const signEast = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 3.8), signMatB);
  signEast.position.set(64, 4.8, 29.4);
  scene.add(signEast);

  // =========================================================================
  // FASE 3: COMPLEXO HOSPITALAR & AQUEDUTO (Oeste, x: -52..-205)
  // =========================================================================
  addAccessibleBuilding(-68, -24, 15, 6.0, 13, 'south');
  addAccessibleBuilding(-68, 24, 15, 6.0, 13, 'north');
  addAccessibleBuilding(-104, 0, 16, 7.4, 22, 'east');
  addAccessibleBuilding(-154, -26, 16, 8.2, 16, 'south');
  addAccessibleBuilding(-154, 26, 16, 7.2, 16, 'north');

  // Walkable hospital skybridges & container ramps
  addPlatformBox(-86, 0, 22, 0.42, 4.6, 6.0, darkSteelMat, false);
  addPlatformBox(-129, -18, 34, 0.45, 4.2, 7.4, darkSteelMat, false);
  addPlatformBox(-154, 0, 4.2, 0.4, 36, 7.2, darkSteelMat, false);
  addPlatformBox(-54, -8, 4.5, 2.0, 6.5, 0, containerTealMat, true);
  addPlatformBox(-136, 16, 5.0, 2.2, 6.5, 0, containerRedMat, true);

  const signMatA = new THREE.MeshStandardMaterial({
    map: textures.neonSignA,
    emissive: 0x0891b2,
    emissiveMap: textures.neonSignA,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  neonMaterials.push(signMatA);
  const signWest = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 3.8), signMatA);
  signWest.position.set(-68, 4.6, -17.2);
  scene.add(signWest);

  // =========================================================================
  // FASE 4: MEGA ESTÁDIO DO BIO-DOMO (Sul, z: +56..+205)
  // =========================================================================
  const archMat = new THREE.MeshStandardMaterial({
    color: 0x065f46,
    roughness: 0.4,
    metalness: 0.65,
  });
  for (let a = 0; a < 5; a++) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(42, 0.85, 8, 32, Math.PI), archMat);
    arch.position.set(0, 0, 128);
    arch.rotation.y = (a * Math.PI) / 5;
    arch.castShadow = true;
    scene.add(arch);
  }
  // Huge climbable grandstands & arena buildings around the Apex Lion
  addPlatformBox(-38, 128, 8, 4.2, 48, 0, bioMossMat, true);
  addPlatformBox(38, 128, 8, 4.2, 48, 0, bioMossMat, true);
  addAccessibleBuilding(0, 174, 18, 6.2, 14, 'north', bioMossMat);
  addAccessibleBuilding(-48, 84, 13, 5.6, 13, 'east', bioMossMat);
  addAccessibleBuilding(48, 84, 13, 5.6, 13, 'west', bioMossMat);

  // =========================================================================
  // CHECKPOINT PHASE BARRICADE GATES (Unlock sequentially as Bosses fall!)
  // =========================================================================
  const createPhaseGate = (
    phaseRequired: number,
    gx: number,
    gz: number,
    gw: number,
    gd: number,
    colorHex: number,
  ) => {
    const group = new THREE.Group();
    group.position.set(gx, 0, gz);

    const beamMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.55,
    });
    const gateMesh = new THREE.Mesh(new THREE.BoxGeometry(gw, 5.6, gd), beamMat);
    gateMesh.position.y = 2.8;
    group.add(gateMesh);

    const postL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 6.5, 1.0), darkSteelMat);
    postL.position.set(gw > gd ? -gw / 2 : 0, 3.25, gw > gd ? 0 : -gd / 2);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(1.0, 6.5, 1.0), darkSteelMat);
    postR.position.set(gw > gd ? gw / 2 : 0, 3.25, gw > gd ? 0 : gd / 2);
    group.add(postL, postR);
    scene.add(group);

    const collider: ColliderBox = {
      minX: gx - gw / 2,
      maxX: gx + gw / 2,
      minZ: gz - gd / 2,
      maxZ: gz + gd / 2,
      minY: 0,
      topY: 10,
      climbable: false,
      isBarrier: true,
    };
    colliders.push(collider);
    phaseGates.push({ phaseRequired, mesh: group, collider, unlocked: false });
  };

  // Gate 1 -> Phase 2 East District (at x = 46)
  createPhaseGate(1, 46, 0, 1.6, 34, 0xf59e0b);
  // Gate 2 -> Phase 3 West Hospital (at x = -46)
  createPhaseGate(2, -46, 0, 1.6, 34, 0x06b6d4);
  // Gate 3 -> Phase 4 South Lion Arena (at z = 50)
  createPhaseGate(3, 0, 50, 36, 1.6, 0xef4444);

  // =========================================================================
  // INSTANCED WASTELAND RUBBLE ACROSS THE 440m CITY
  // =========================================================================
  const rockCount = 160;
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  const rockMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.08 });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  for (let i = 0; i < rockCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 190;
    dummy.position.set(Math.cos(a) * dist, 0.18, Math.sin(a) * dist);
    dummy.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    dummy.scale.set(0.8 + Math.random() * 1.6, 0.4 + Math.random() * 0.8, 0.8 + Math.random() * 1.5);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
    tmpColor.setHex(i % 3 === 0 ? 0x334155 : i % 3 === 1 ? 0x475569 : 0x3f3f46);
    rockInst.setColorAt(i, tmpColor);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  scene.add(rockInst);

  // Beacon ring helper
  const createBeaconRing = (colorHex: number): THREE.Mesh => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 24),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    return ring;
  };

  // =========================================================================
  // WATER SOURCES (across all 4 huge districts)
  // =========================================================================
  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.waterRipple,
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.55,
    roughness: 0.12,
    metalness: 0.3,
    transparent: true,
    opacity: 0.88,
  });
  const waterSpots: [string, number, number, number][] = [
    ['Poça da Quarentena', -10, 16, 2.4],
    ['Hidrante Norte', 12, -52, 2.2],
    ['Fonte da Torre Leste', 78, 36, 2.6],
    ['Reserva dos Arranha-Céus', 138, -2, 2.8],
    ['Pátio Inundado (Hospital)', -84, -30, 3.6],
    ['Aqueduto Oeste', -144, 10, 3.4],
    ['Fonte do Bio-Domo', -18, 92, 3.0],
    ['Lago da Arena Sul', 18, 152, 3.2],
  ];
  waterSpots.forEach(([name, x, z, r], idx) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 6, 20), darkSteelMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.09;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 24), waterMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.06;
    waterMeshes.push(pool);
    const beaconRing = createBeaconRing(0x06b6d4);
    group.add(rim, pool, beaconRing);
    scene.add(group);

    interactables.push({
      id: `water-${idx}`,
      kind: 'water',
      name,
      position: new THREE.Vector3(x, 0, z),
      mesh: group,
      beaconRing,
      active: true,
      respawnTimer: 0,
      maxRespawn: 24,
      amount: 45,
      xpGain: 22,
    });
  });

  // =========================================================================
  // FOOD CACHES (inside open houses, on rooftops, and alleys!)
  // =========================================================================
  const tinMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.75,
    roughness: 0.3,
    metalness: 0.65,
  });
  const foodSpots: [string, number, number, number, number][] = [
    ['Ração na Casa Oeste', -22, -12, 0.1, 40],
    ['Lata no Telhado Norte', -22, -38, 4.4, 50],
    ['Estoque na Casa Leste', 22, -14, 0.1, 42],
    ['Ração da Estrada Norte', 24, -76, 0.1, 48],
    ['Peixe no Telhado Leste', 64, -22, 6.2, 55],
    ['Ração no Beco Leste', 96, 24, 0.1, 52],
    ['Estoque da Torre Alta', 148, 22, 7.4, 62],
    ['Kit Médico Proteico', -68, -24, 0.1, 55],
    ['Suprimento do Heliponto', -104, 0, 7.4, 64],
    ['Ração do Laboratório', -154, -26, 0.1, 60],
    ['Cogumelo Bio-Luminoso', 22, 96, 0.1, 60],
    ['Fruto Mutante do Domo', 0, 174, 0.1, 68],
  ];
  foodSpots.forEach(([name, x, z, y, amount], idx) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 12), tinMat);
    can.position.y = 0.15;
    can.castShadow = true;
    const beaconRing = createBeaconRing(0x10b981);
    group.add(can, beaconRing);
    scene.add(group);

    interactables.push({
      id: `food-${idx}`,
      kind: 'food',
      name,
      position: new THREE.Vector3(x, y, z),
      mesh: group,
      beaconRing,
      active: true,
      respawnTimer: 0,
      maxRespawn: 35,
      amount,
      xpGain: 32,
    });
  });

  // =========================================================================
  // SCRAP NODES (inside rooms & rooftops)
  // =========================================================================
  const scrapMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.75,
    metalness: 0.85,
    roughness: 0.25,
  });
  const scrapCoords: [number, number, number][] = [
    [-6, -18, 1.5],
    [22, -14, 5.2],
    [64, 22, 5.8],
    [96, -24, 0.1],
    [148, -24, 8.8],
    [-68, 24, 6.0],
    [-104, 0, 0.1],
    [-154, 26, 7.2],
    [-38, 128, 4.2],
    [38, 128, 4.2],
  ];
  scrapCoords.forEach(([sx, sz, sy], idx) => {
    const group = new THREE.Group();
    group.position.set(sx, sy, sz);
    const gear = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 6, 10), scrapMat);
    gear.position.y = 0.28;
    const beaconRing = createBeaconRing(0xf59e0b);
    group.add(gear, beaconRing);
    scene.add(group);

    interactables.push({
      id: `scrap-${idx}`,
      kind: 'scrap',
      name: 'Sucata Tecnológica',
      position: new THREE.Vector3(sx, sy, sz),
      mesh: group,
      beaconRing,
      active: true,
      respawnTimer: 0,
      maxRespawn: 45,
      amount: 1,
      xpGain: 28,
    });
  });

  // =========================================================================
  // SHELTERS (6 safe refuges across the open city)
  // =========================================================================
  const shelterConfigs: [string, number, number][] = [
    ['Abrigo da Quarentena', 2, 18],
    ['Abrigo Norte', -4, -92],
    ['Refúgio dos Telhados', 66, 38],
    ['Posto dos Arranha-Céus', 162, 0],
    ['Bunker do Hospital', -72, -42],
    ['Santuário do Bio-Domo', 0, 74],
  ];
  shelterConfigs.forEach(([name, sx, sz], idx) => {
    const group = new THREE.Group();
    group.position.set(sx, 0, sz);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 0.22, 12), darkSteelMat);
    pad.position.y = 0.11;
    pad.receiveShadow = true;

    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.55,
      metalness: 0.5,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      domeMat,
    );
    dome.scale.set(1, 0.85, 1);
    dome.position.y = 0.15;

    const beaconRing = createBeaconRing(0xa855f7);
    group.add(pad, dome, beaconRing);
    scene.add(group);

    interactables.push({
      id: `shelter-${idx}`,
      kind: 'shelter',
      name,
      position: new THREE.Vector3(sx, 0, sz),
      mesh: group,
      beaconRing,
      active: true,
      respawnTimer: 0,
      maxRespawn: 0,
      amount: 100,
      xpGain: 25,
      shelterLevel: 1,
      shelterDome: dome,
    });
  });

  // =========================================================================
  // LORE TERMINALS (1 per district)
  // =========================================================================
  const termMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.6,
  });
  const termCoords: [number, number][] = [
    [-14, 8],
    [84, 34],
    [-86, -24],
    [22, 78],
  ];
  termCoords.forEach(([tx, tz], idx) => {
    const group = new THREE.Group();
    group.position.set(tx, 0, tz);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.2, 0.45), darkSteelMat);
    ped.position.y = 0.6;
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.4, 0.08), termMat);
    scr.position.set(0, 1.28, 0.08);
    scr.rotation.x = -0.35;
    const beaconRing = createBeaconRing(0x38bdf8);
    group.add(ped, scr, beaconRing);
    scene.add(group);

    interactables.push({
      id: LORE_LOGS[idx].id,
      kind: 'terminal',
      name: LORE_LOGS[idx].title,
      position: new THREE.Vector3(tx, 0, tz),
      mesh: group,
      beaconRing,
      active: true,
      respawnTimer: 0,
      maxRespawn: 0,
      amount: 1,
      xpGain: 45,
      lore: LORE_LOGS[idx],
    });
  });

  // =========================================================================
  // ROAMING PREDATORS + 4 PHASE BOSSES!
  // =========================================================================
  const addPredator = (
    id: string,
    name: string,
    kind: 'rat' | 'feral_cat' | 'hound' | 'lion',
    isBoss: boolean,
    phaseIndex: number,
    x: number,
    z: number,
    hp: number,
    damage: number,
    speed: number,
    isFriendly = false,
  ) => {
    const { group, bodyMesh, legs } = createPredatorMesh(kind, isBoss, false, isFriendly ? 0xb8a58a : undefined);
    group.position.set(x, 0, z);
    scene.add(group);
    predators.push({
      id,
      name,
      kind,
      isBoss,
      isFriendly,
      phaseIndex,
      group,
      bodyMesh,
      legs,
      homePos: new THREE.Vector3(x, 0, z),
      hp,
      maxHp: hp,
      damage,
      speed,
      aggroRange: isBoss ? 22 : 15,
      attackRange: isBoss ? 2.6 : 1.75,
      attackCooldown: 0,
      stunTimer: 0,
      distractTimer: 0,
      hitFlashTimer: 0,
      alive: true,
      respawnTimer: 0,
      xpReward: isBoss ? 160 + phaseIndex * 50 : 38 + phaseIndex * 10,
      scrapReward: isBoss ? 3 : 1,
    });
  };

  // Friendly strays: curious neighborhood cats that observe Tomas but never attack.
  addPredator('stray-cat-1', 'Mingau', 'feral_cat', false, 1, -34, -8, 60, 0, 2.2, true);
  addPredator('stray-cat-2', 'Canela', 'feral_cat', false, 1, 36, -54, 60, 0, 2.0, true);

  addPredator('mob-rat-1', 'Rato Mutante', 'rat', false, 1, -8, -32, 42, 8, 5.4);
  addPredator('mob-rat-2', 'Rato Mutante', 'rat', false, 1, 14, -44, 42, 8, 5.4);
  addPredator('mob-rat-3', 'Rato do Beco', 'rat', false, 1, -12, -72, 52, 9, 5.8);
  addPredator('mob-cat-1', 'Gato Feral', 'feral_cat', false, 2, 74, 6, 80, 13, 6.8);
  addPredator('mob-cat-2', 'Gato Feral', 'feral_cat', false, 2, 132, -10, 90, 14, 7.0);
  addPredator('mob-hound-1', 'Cão Selvagem', 'hound', false, 3, -78, -8, 115, 17, 7.2);
  addPredator('mob-hound-2', 'Cão Selvagem', 'hound', false, 3, -138, 12, 125, 18, 7.4);
  addPredator('mob-hound-3', 'Cão das Ruínas', 'hound', false, 4, -22, 102, 135, 19, 7.6);
  addPredator('mob-hound-4', 'Cão da Arena', 'hound', false, 4, 24, 108, 135, 19, 7.6);

  const bossStats: Record<number, { hp: number; dmg: number; spd: number }> = {
    1: { hp: 135, dmg: 14, spd: 5.8 },
    2: { hp: 220, dmg: 20, spd: 7.4 },
    3: { hp: 325, dmg: 26, spd: 7.8 },
    4: { hp: 480, dmg: 34, spd: 8.4 },
  };
  CHAPTER_PHASES.forEach((p) => {
    const st = bossStats[p.phase];
    addPredator(
      `boss-phase-${p.phase}`,
      p.bossName,
      p.bossKind,
      true,
      p.phase,
      p.bossPos[0],
      p.bossPos[1],
      st.hp,
      st.dmg,
      st.spd,
    );
  });

  // =========================================================================
  // 9 ROOFTOP TERRITORY RIVAL CATS (Disputa de Telhados por Estrelas & Status!)
  // =========================================================================
  const rooftopRivals: {
    id: string;
    name: string;
    rivalLevel: number;
    phaseIndex: number;
    cx: number;
    cz: number;
    y: number;
    halfW: number;
    halfD: number;
    hp: number;
    dmg: number;
    starReward: number;
    coat: number;
  }[] = [
    {
      id: 'rival-roof-1',
      name: 'Garra Cinza',
      rivalLevel: 8,
      phaseIndex: 1,
      cx: -22,
      cz: -12,
      y: 4.6,
      halfW: 4.8,
      halfD: 4.8,
      hp: 80,
      dmg: 10,
      starReward: 6,
      coat: 0x64748b,
    },
    {
      id: 'rival-roof-2',
      name: 'Sombra de Aço',
      rivalLevel: 18,
      phaseIndex: 1,
      cx: 22,
      cz: -14,
      y: 5.2,
      halfW: 5.2,
      halfD: 4.8,
      hp: 115,
      dmg: 14,
      starReward: 8,
      coat: 0x334155,
    },
    {
      id: 'rival-roof-3',
      name: 'Vigia do Norte',
      rivalLevel: 26,
      phaseIndex: 1,
      cx: 24,
      cz: -76,
      y: 5.0,
      halfW: 5.2,
      halfD: 4.8,
      hp: 140,
      dmg: 16,
      starReward: 9,
      coat: 0x475569,
    },
    {
      id: 'rival-roof-4',
      name: 'Presa Rubra',
      rivalLevel: 36,
      phaseIndex: 2,
      cx: 64,
      cz: 22,
      y: 5.8,
      halfW: 6.2,
      halfD: 6.2,
      hp: 175,
      dmg: 18,
      starReward: 10,
      coat: 0x991b1b,
    },
    {
      id: 'rival-roof-5',
      name: 'Fúria Neon',
      rivalLevel: 48,
      phaseIndex: 2,
      cx: 148,
      cz: -24,
      y: 8.8,
      halfW: 7.0,
      halfD: 7.0,
      hp: 230,
      dmg: 22,
      starReward: 12,
      coat: 0x0f766e,
    },
    {
      id: 'rival-roof-6',
      name: 'Lince da Torre',
      rivalLevel: 60,
      phaseIndex: 2,
      cx: 178,
      cz: 0,
      y: 9.6,
      halfW: 6.2,
      halfD: 9.0,
      hp: 265,
      dmg: 24,
      starReward: 13,
      coat: 0x0e7490,
    },
    {
      id: 'rival-roof-7',
      name: 'Lince do Hospital',
      rivalLevel: 72,
      phaseIndex: 3,
      cx: -68,
      cz: -24,
      y: 6.0,
      halfW: 6.6,
      halfD: 5.6,
      hp: 300,
      dmg: 27,
      starReward: 14,
      coat: 0x4338ca,
    },
    {
      id: 'rival-roof-8',
      name: 'Titã da Cobertura',
      rivalLevel: 84,
      phaseIndex: 3,
      cx: -154,
      cz: 26,
      y: 7.2,
      halfW: 7.0,
      halfD: 7.0,
      hp: 360,
      dmg: 31,
      starReward: 16,
      coat: 0x7e22ce,
    },
    {
      id: 'rival-roof-9',
      name: 'Guardião do Domo',
      rivalLevel: 94,
      phaseIndex: 4,
      cx: 0,
      cz: 174,
      y: 6.2,
      halfW: 8.0,
      halfD: 6.2,
      hp: 430,
      dmg: 35,
      starReward: 20,
      coat: 0xb45309,
    },
  ];

  rooftopRivals.forEach((rv) => {
    const { group, bodyMesh, legs } = createPredatorMesh('feral_cat', false, true, rv.coat);
    group.position.set(rv.cx, rv.y, rv.cz);
    scene.add(group);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.6,
    });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.4, 8), beaconMat);
    beacon.position.set(rv.cx + rv.halfW - 0.8, rv.y + 1.2, rv.cz + rv.halfD - 0.8);
    scene.add(beacon);

    predators.push({
      id: rv.id,
      name: rv.name,
      kind: 'feral_cat',
      isBoss: false,
      isTerritoryRival: true,
      rivalLevel: rv.rivalLevel,
      starReward: rv.starReward,
      rooftopBounds: {
        minX: rv.cx - rv.halfW,
        maxX: rv.cx + rv.halfW,
        minZ: rv.cz - rv.halfD,
        maxZ: rv.cz + rv.halfD,
        y: rv.y,
      },
      territoryBeacon: beacon,
      conquered: false,
      phaseIndex: rv.phaseIndex,
      group,
      bodyMesh,
      legs,
      homePos: new THREE.Vector3(rv.cx, rv.y, rv.cz),
      hp: rv.hp,
      maxHp: rv.hp,
      damage: rv.dmg,
      speed: 6.6,
      aggroRange: 12,
      attackRange: 2.0,
      attackCooldown: 0,
      stunTimer: 0,
      distractTimer: 0,
      hitFlashTimer: 0,
      alive: true,
      respawnTimer: 0,
      xpReward: 120 + rv.rivalLevel * 3,
      scrapReward: 2,
    });
  });

  const getSectorName = (x: number, z: number): string => {
    if (z > 50) return 'Estádio Devastado (Fase 4)';
    if (x > 46) return 'Bairro dos Telhados (Fase 2)';
    if (x < -46) return 'Hospital Submerso (Fase 3)';
    return 'Rua da Quarentena (Fase 1)';
  };

  return {
    colliders,
    indoorZones,
    phaseGates,
    interactables,
    predators,
    neonMaterials,
    waterMeshes,
    skyDome,
    getSectorName,
  };
}
