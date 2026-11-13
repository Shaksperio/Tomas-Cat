import * as THREE from 'three';
import { EnemyKind } from '../types/game';

export interface RooftopBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

export interface PredatorActor {
  id: string;
  name: string;
  kind: EnemyKind;
  isBoss: boolean;
  isFriendly?: boolean;
  isTerritoryRival?: boolean;
  rivalLevel?: number;
  starReward?: number;
  rooftopBounds?: RooftopBounds;
  territoryBeacon?: THREE.Mesh;
  conquered?: boolean;
  phaseIndex: number;
  group: THREE.Group;
  bodyMesh: THREE.Group;
  legs: THREE.Mesh[];
  homePos: THREE.Vector3;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  stunTimer: number;
  distractTimer: number;
  hitFlashTimer: number;
  alive: boolean;
  respawnTimer: number;
  xpReward: number;
  scrapReward: number;
}

export function createPredatorMesh(
  kind: EnemyKind,
  isBoss: boolean,
  isTerritoryRival = false,
  rivalCoatHex?: number,
): {
  group: THREE.Group;
  bodyMesh: THREE.Group;
  legs: THREE.Mesh[];
} {
  const group = new THREE.Group();
  const bodyMesh = new THREE.Group();
  group.add(bodyMesh);
  const legs: THREE.Mesh[] = [];

  const scale = isBoss
    ? kind === 'rat'
      ? 1.55
      : kind === 'feral_cat'
        ? 1.45
        : kind === 'hound'
          ? 1.65
          : 2.15
    : isTerritoryRival
      ? 1.18
      : kind === 'rat'
        ? 0.78
        : kind === 'feral_cat'
          ? 0.92
          : 1.08;

  const baseColor =
    rivalCoatHex ??
    (kind === 'rat'
      ? 0x4b5563
      : kind === 'feral_cat'
        ? 0x7c2d12
        : kind === 'hound'
          ? 0x27272a
          : 0x92400e);

  const accentColor = isTerritoryRival
    ? 0xfbbf24
    : kind === 'rat'
      ? 0x84cc16
      : kind === 'feral_cat'
        ? 0xef4444
        : kind === 'hound'
          ? 0xf97316
          : 0xf59e0b;

  const coatMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.85,
    metalness: 0.1,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.3,
    metalness: 0.85,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  const torsoGeo = new THREE.CapsuleGeometry(0.28 * scale, 0.65 * scale, 6, 12);
  torsoGeo.rotateX(Math.PI / 2);
  const torso = new THREE.Mesh(torsoGeo, coatMat);
  torso.position.y = 0.55 * scale;
  torso.castShadow = true;
  bodyMesh.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24 * scale, 12, 10), coatMat);
  head.position.set(0, 0.72 * scale, 0.48 * scale);
  head.castShadow = true;
  bodyMesh.add(head);

  const snout = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, 0.14 * scale, 0.26 * scale),
    coatMat,
  );
  snout.position.set(0, 0.66 * scale, 0.68 * scale);
  bodyMesh.add(snout);

  const eyeGeo = new THREE.SphereGeometry(0.045 * scale, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, glowMat);
  eyeL.position.set(0.11 * scale, 0.77 * scale, 0.66 * scale);
  const eyeR = new THREE.Mesh(eyeGeo, glowMat);
  eyeR.position.set(-0.11 * scale, 0.77 * scale, 0.66 * scale);
  bodyMesh.add(eyeL, eyeR);

  if (kind === 'rat') {
    const earGeo = new THREE.CylinderGeometry(0.11 * scale, 0.11 * scale, 0.03 * scale, 10);
    earGeo.rotateX(Math.PI / 2);
    const eL = new THREE.Mesh(earGeo, coatMat);
    eL.position.set(0.16 * scale, 0.9 * scale, 0.42 * scale);
    const eR = new THREE.Mesh(earGeo, coatMat);
    eR.position.set(-0.16 * scale, 0.9 * scale, 0.42 * scale);
    bodyMesh.add(eL, eR);

    for (let i = 0; i < 3; i++) {
      const cyst = new THREE.Mesh(new THREE.SphereGeometry(0.11 * scale, 8, 8), glowMat);
      cyst.position.set(0, 0.8 * scale, (0.15 - i * 0.25) * scale);
      bodyMesh.add(cyst);
    }

    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.06 * scale, 1.0 * scale, 8),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.6 }),
    );
    tail.rotation.x = -Math.PI * 0.42;
    tail.position.set(0, 0.46 * scale, -0.78 * scale);
    bodyMesh.add(tail);
  } else if (kind === 'feral_cat') {
    const earGeo = new THREE.ConeGeometry(0.08 * scale, 0.2 * scale, 4);
    const eL = new THREE.Mesh(earGeo, coatMat);
    eL.position.set(0.13 * scale, 0.95 * scale, 0.46 * scale);
    const eR = new THREE.Mesh(earGeo, coatMat);
    eR.position.set(-0.13 * scale, 0.95 * scale, 0.46 * scale);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2 * scale, 0.035 * scale, 8, 16), metalMat);
    collar.position.set(0, 0.62 * scale, 0.32 * scale);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045 * scale, 0.55 * scale, 4, 8), coatMat);
    tail.rotation.x = -Math.PI / 3;
    tail.position.set(0, 0.72 * scale, -0.62 * scale);
    bodyMesh.add(eL, eR, collar, tail);

    // Territory Rival Cats get a glowing Star Crest / Shoulder Fins!
    if (isTerritoryRival) {
      const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 * scale, 0), glowMat);
      crest.position.set(0, 1.04 * scale, 0.44 * scale);
      const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.14 * scale, 0.4 * scale), glowMat);
      dorsal.position.set(0, 0.85 * scale, 0);
      bodyMesh.add(crest, dorsal);
    }
  } else if (kind === 'hound') {
    const harness = new THREE.Mesh(new THREE.BoxGeometry(0.62 * scale, 0.42 * scale, 0.46 * scale), metalMat);
    harness.position.set(0, 0.58 * scale, 0.14 * scale);
    const jawGuard = new THREE.Mesh(new THREE.BoxGeometry(0.24 * scale, 0.09 * scale, 0.22 * scale), metalMat);
    jawGuard.position.set(0, 0.58 * scale, 0.7 * scale);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.12 * scale, 0.35 * scale), glowMat);
    core.position.set(0, 0.82 * scale, 0.12 * scale);
    bodyMesh.add(harness, jawGuard, core);
  } else {
    const maneMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.9,
      metalness: 0.15,
    });
    for (let m = 0; m < 10; m++) {
      const a = (m / 10) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.14 * scale, 0.38 * scale, 5),
        m % 3 === 0 ? glowMat : maneMat,
      );
      spike.position.set(Math.cos(a) * 0.28 * scale, 0.72 * scale + Math.sin(a) * 0.28 * scale, 0.38 * scale);
      spike.rotation.z = a - Math.PI / 2;
      bodyMesh.add(spike);
    }
    const chestArmor = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * scale, 0.28 * scale, 0.34 * scale, 8), metalMat);
    chestArmor.rotation.x = Math.PI / 2;
    chestArmor.position.set(0, 0.58 * scale, 0.24 * scale);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scale, 0.04 * scale, 0.8 * scale, 8), coatMat);
    tail.rotation.x = -Math.PI / 3;
    tail.position.set(0, 0.65 * scale, -0.72 * scale);
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 8, 8), glowMat);
    tuft.position.set(0, 0.88 * scale, -1.04 * scale);
    bodyMesh.add(chestArmor, tail, tuft);
  }

  const legGeo = new THREE.CapsuleGeometry(0.075 * scale, 0.36 * scale, 4, 8);
  const legOffsets: [number, number][] = [
    [0.18 * scale, 0.28 * scale],
    [-0.18 * scale, 0.28 * scale],
    [0.18 * scale, -0.28 * scale],
    [-0.18 * scale, -0.28 * scale],
  ];
  legOffsets.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, coatMat);
    leg.position.set(lx, 0.28 * scale, lz);
    leg.castShadow = true;
    bodyMesh.add(leg);
    legs.push(leg);
  });

  if (isBoss || isTerritoryRival) {
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.95 * scale, 1.15 * scale, 28),
      new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: isBoss ? 0.45 : 0.35,
        side: THREE.DoubleSide,
      }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.05;
    group.add(aura);
  }

  return { group, bodyMesh, legs };
}
