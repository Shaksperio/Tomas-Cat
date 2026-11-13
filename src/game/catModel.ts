import * as THREE from 'three';
import { EVOLUTION_STAGES } from '../types/game';

interface LimbRig {
  hip: THREE.Group;
  shin: THREE.Group;
  clawMesh: THREE.Mesh;
}

export class ArticulatedCat {
  public readonly root = new THREE.Group();
  private readonly bodyPivot = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly leftEar = new THREE.Group();
  private readonly rightEar = new THREE.Group();
  private readonly tailSegments: THREE.Group[] = [];
  private readonly legs: {
    fl: LimbRig;
    fr: LimbRig;
    bl: LimbRig;
    br: LimbRig;
  };

  // Evolution visual attachments
  private readonly collarRing: THREE.Mesh;
  private readonly collarTag: THREE.Mesh;
  private readonly cyberSpineGroup = new THREE.Group();
  private readonly shoulderArmorGroup = new THREE.Group();
  private readonly opticAntenna: THREE.Group;
  private readonly tailCore: THREE.Mesh;
  private readonly bioShieldHalo: THREE.Mesh;
  private readonly alphaCrownGroup = new THREE.Group();
  private readonly eyeMat: THREE.MeshStandardMaterial;
  private readonly cyberAccentMat: THREE.MeshStandardMaterial;
  private readonly furMat: THREE.MeshStandardMaterial;
  private readonly furSecondaryMat: THREE.MeshStandardMaterial;

  // Combat & Action FX
  private readonly slashArcGroup = new THREE.Group();
  private readonly slashMat: THREE.MeshBasicMaterial;
  private readonly meowRing: THREE.Mesh;
  private readonly meowMat: THREE.MeshBasicMaterial;

  private gaitPhase = 0;
  private climbPhase = 0;
  private currentScale = EVOLUTION_STAGES[0].scale;
  private targetScale = EVOLUTION_STAGES[0].scale;
  private actionTimer = 0;
  private actionType: 'none' | 'eat' | 'drink' | 'pounce' | 'claw' | 'meow' = 'none';
  private rightingRoll = 0;
  private landingSquat = 0;

  constructor() {
    this.root.name = 'FelisProtagonist';

    this.furMat = new THREE.MeshStandardMaterial({
      color: 0x3b4252,
      roughness: 0.88,
      metalness: 0.04,
    });
    this.furSecondaryMat = new THREE.MeshStandardMaterial({
      color: 0xd8dee9,
      roughness: 0.84,
      metalness: 0.04,
    });
    const darkPadMat = new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      roughness: 0.6,
      metalness: 0.1,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xec9aa8,
      roughness: 0.45,
      metalness: 0.05,
    });
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.8,
      roughness: 0.15,
      metalness: 0.2,
    });
    const metalArmorMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.28,
      metalness: 0.88,
    });
    this.cyberAccentMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.6,
    });

    this.bodyPivot.position.set(0, 0.42, 0);
    this.root.add(this.bodyPivot);

    const torsoGeo = new THREE.CapsuleGeometry(0.18, 0.48, 8, 16);
    torsoGeo.rotateX(Math.PI / 2);
    const torso = new THREE.Mesh(torsoGeo, this.furMat);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.bodyPivot.add(torso);

    const chestGeo = new THREE.SphereGeometry(0.155, 14, 12);
    chestGeo.scale(0.95, 1.05, 1.1);
    const chest = new THREE.Mesh(chestGeo, this.furSecondaryMat);
    chest.position.set(0, -0.02, 0.2);
    chest.castShadow = true;
    this.bodyPivot.add(chest);

    const collarGeo = new THREE.TorusGeometry(0.145, 0.024, 10, 24);
    collarGeo.rotateX(Math.PI * 0.42);
    this.collarRing = new THREE.Mesh(collarGeo, metalArmorMat);
    this.collarRing.position.set(0, 0.07, 0.26);
    this.bodyPivot.add(this.collarRing);

    this.collarTag = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.036, 0),
      this.cyberAccentMat,
    );
    this.collarTag.position.set(0, -0.04, 0.36);
    this.bodyPivot.add(this.collarTag);

    this.headGroup.position.set(0, 0.16, 0.35);
    this.bodyPivot.add(this.headGroup);

    const craniumGeo = new THREE.SphereGeometry(0.165, 18, 16);
    craniumGeo.scale(1.04, 0.94, 1.02);
    const cranium = new THREE.Mesh(craniumGeo, this.furMat);
    cranium.castShadow = true;
    this.headGroup.add(cranium);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.12), this.furSecondaryMat);
    muzzle.position.set(0, -0.045, 0.13);
    this.headGroup.add(muzzle);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.03, 3), noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.02, 0.195);
    this.headGroup.add(nose);

    const eyeGeo = new THREE.SphereGeometry(0.03, 12, 10);
    eyeGeo.scale(0.85, 1.15, 0.6);
    const leftEye = new THREE.Mesh(eyeGeo, this.eyeMat);
    leftEye.position.set(0.068, 0.03, 0.14);
    const rightEye = new THREE.Mesh(eyeGeo, this.eyeMat);
    rightEye.position.set(-0.068, 0.03, 0.14);
    this.headGroup.add(leftEye, rightEye);

    const outerEarGeo = new THREE.ConeGeometry(0.062, 0.14, 4);
    const innerEarGeo = new THREE.ConeGeometry(0.034, 0.09, 4);

    const lOuter = new THREE.Mesh(outerEarGeo, this.furMat);
    lOuter.castShadow = true;
    const lInner = new THREE.Mesh(innerEarGeo, noseMat);
    lInner.position.set(0, -0.01, 0.02);
    this.leftEar.add(lOuter, lInner);
    this.leftEar.position.set(0.095, 0.145, 0.01);
    this.leftEar.rotation.set(0.1, 0, -0.25);

    const rOuter = new THREE.Mesh(outerEarGeo, this.furMat);
    rOuter.castShadow = true;
    const rInner = new THREE.Mesh(innerEarGeo, noseMat);
    rInner.position.set(0, -0.01, 0.02);
    this.rightEar.add(rOuter, rInner);
    this.rightEar.position.set(-0.095, 0.145, 0.01);
    this.rightEar.rotation.set(0.1, 0, 0.25);
    this.headGroup.add(this.leftEar, this.rightEar);

    // Meow acoustic wave ring
    this.meowMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.meowRing = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.18, 24), this.meowMat);
    this.meowRing.position.set(0, -0.02, 0.24);
    this.meowRing.visible = false;
    this.headGroup.add(this.meowRing);

    // Optic Ear Antenna (Stage 3+)
    this.opticAntenna = new THREE.Group();
    const antStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, 0.12, 8),
      metalArmorMat,
    );
    antStem.position.set(0.13, 0.11, -0.02);
    const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), this.cyberAccentMat);
    antTip.position.set(0.13, 0.175, -0.02);
    const visorBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.02, 0.02),
      this.cyberAccentMat,
    );
    visorBar.position.set(0, 0.055, 0.155);
    this.opticAntenna.add(antStem, antTip, visorBar);
    this.opticAntenna.visible = false;
    this.headGroup.add(this.opticAntenna);

    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.07 - i * 0.008, 0.09),
        i % 2 === 0 ? metalArmorMat : this.cyberAccentMat,
      );
      fin.position.set(0, 0.175, 0.16 - i * 0.12);
      fin.rotation.x = -0.35;
      this.cyberSpineGroup.add(fin);
    }
    this.cyberSpineGroup.visible = false;
    this.bodyPivot.add(this.cyberSpineGroup);

    const plateGeo = new THREE.BoxGeometry(0.11, 0.14, 0.2);
    const leftPlate = new THREE.Mesh(plateGeo, metalArmorMat);
    leftPlate.position.set(0.16, 0.05, 0.14);
    leftPlate.rotation.z = -0.25;
    const rightPlate = new THREE.Mesh(plateGeo, metalArmorMat);
    rightPlate.position.set(-0.16, 0.05, 0.14);
    rightPlate.rotation.z = 0.25;
    const dorsalCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12),
      this.cyberAccentMat,
    );
    dorsalCore.position.set(0, 0.185, 0.1);
    this.shoulderArmorGroup.add(leftPlate, rightPlate, dorsalCore);
    this.shoulderArmorGroup.visible = false;
    this.bodyPivot.add(this.shoulderArmorGroup);

    this.bioShieldHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.012, 8, 32),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.45,
      }),
    );
    this.bioShieldHalo.rotation.x = Math.PI / 2;
    this.bioShieldHalo.position.set(0, 0.02, 0);
    this.bioShieldHalo.visible = false;
    this.bodyPivot.add(this.bioShieldHalo);

    // Level 99 Alpha Leader Golden Crown & Aura
    const goldAlphaMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.8,
      metalness: 0.9,
      roughness: 0.15,
    });
    const alphaHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.015, 8, 20),
      goldAlphaMat,
    );
    alphaHalo.rotation.x = Math.PI / 2;
    alphaHalo.position.set(0, 0.24, 0.02);
    const alphaGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), goldAlphaMat);
    alphaGem.position.set(0, 0.28, 0.08);
    this.alphaCrownGroup.add(alphaHalo, alphaGem);
    this.alphaCrownGroup.visible = false;
    this.headGroup.add(this.alphaCrownGroup);

    // 3-Claw Slash Arc VFX
    this.slashMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let s = -1; s <= 1; s++) {
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.44, 16, 1, -0.7, 1.4),
        this.slashMat,
      );
      arc.position.set(s * 0.12, 0.08 + Math.abs(s) * -0.03, 0.55);
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = Math.PI / 2 + s * 0.18;
      this.slashArcGroup.add(arc);
    }
    this.slashArcGroup.visible = false;
    this.bodyPivot.add(this.slashArcGroup);

    // Tail
    let parentTail: THREE.Object3D = this.bodyPivot;
    for (let i = 0; i < 4; i++) {
      const segGroup = new THREE.Group();
      if (i === 0) segGroup.position.set(0, 0.08, -0.32);
      else segGroup.position.set(0, 0, -0.13);
      const radius = 0.042 - i * 0.006;
      const segGeo = new THREE.CapsuleGeometry(radius, 0.11, 4, 8);
      segGeo.rotateX(Math.PI / 2);
      const segMat = i === 3 ? this.furSecondaryMat : this.furMat;
      const segMesh = new THREE.Mesh(segGeo, segMat);
      segMesh.position.set(0, 0, -0.065);
      segMesh.castShadow = true;
      segGroup.add(segMesh);
      parentTail.add(segGroup);
      this.tailSegments.push(segGroup);
      parentTail = segGroup;
    }

    this.tailCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 10, 10),
      this.cyberAccentMat,
    );
    this.tailCore.position.set(0, 0, -0.12);
    this.tailCore.visible = false;
    this.tailSegments[3].add(this.tailCore);

    const createLeg = (x: number, z: number): LimbRig => {
      const hip = new THREE.Group();
      hip.position.set(x, -0.04, z);

      const upperMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.052, 0.15, 4, 10),
        this.furMat,
      );
      upperMesh.position.set(0, -0.09, 0);
      upperMesh.castShadow = true;
      hip.add(upperMesh);

      const shin = new THREE.Group();
      shin.position.set(0, -0.18, 0);
      const lowerMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.042, 0.13, 4, 10),
        this.furSecondaryMat,
      );
      lowerMesh.position.set(0, -0.08, 0);
      lowerMesh.castShadow = true;

      const paw = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 10, 8),
        darkPadMat,
      );
      paw.scale.set(1, 0.65, 1.35);
      paw.position.set(0, -0.17, 0.025);

      const clawMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.018, 0.045, 4),
        this.cyberAccentMat,
      );
      clawMesh.rotation.x = Math.PI / 2;
      clawMesh.position.set(0, -0.17, 0.085);
      clawMesh.visible = false;

      shin.add(lowerMesh, paw, clawMesh);
      hip.add(shin);
      this.bodyPivot.add(hip);

      return { hip, shin, clawMesh };
    };

    this.legs = {
      fl: createLeg(0.115, 0.2),
      fr: createLeg(-0.115, 0.2),
      bl: createLeg(0.115, -0.2),
      br: createLeg(-0.115, -0.2),
    };

    this.applyEvolutionStage(0, true, false);
  }

  public applyEvolutionStage(stageIndex: number, instant = false, isAlphaLeader = false): void {
    const def = EVOLUTION_STAGES[Math.min(stageIndex, EVOLUTION_STAGES.length - 1)];
    this.targetScale = isAlphaLeader ? 1.52 : def.scale;
    if (instant) {
      this.currentScale = this.targetScale;
      this.root.scale.setScalar(this.currentScale);
    }

    this.eyeMat.color.setHex(isAlphaLeader ? 0xfbbf24 : def.eyeColor);
    this.eyeMat.emissive.setHex(isAlphaLeader ? 0xfbbf24 : def.eyeColor);
    this.cyberAccentMat.color.setHex(isAlphaLeader ? 0xfbbf24 : def.accentColor);
    this.cyberAccentMat.emissive.setHex(isAlphaLeader ? 0xfbbf24 : def.accentColor);
    this.slashMat.color.setHex(isAlphaLeader ? 0xfbbf24 : def.accentColor);

    if (stageIndex === 0) {
      this.furMat.color.setHex(0x4c566a);
      this.furSecondaryMat.color.setHex(0xe5e9f0);
    } else if (stageIndex === 1) {
      this.furMat.color.setHex(0x374151);
      this.furSecondaryMat.color.setHex(0xcbd5e1);
    } else if (stageIndex === 2) {
      this.furMat.color.setHex(0x1e293b);
      this.furSecondaryMat.color.setHex(0x94a3b8);
    } else {
      this.furMat.color.setHex(0x0f172a);
      this.furSecondaryMat.color.setHex(0x64748b);
    }

    this.collarTag.visible = stageIndex >= 1;
    this.opticAntenna.visible = stageIndex >= 2;
    this.cyberSpineGroup.visible = stageIndex >= 2;
    this.legs.fl.clawMesh.visible = stageIndex >= 2;
    this.legs.fr.clawMesh.visible = stageIndex >= 2;
    this.legs.bl.clawMesh.visible = stageIndex >= 2;
    this.legs.br.clawMesh.visible = stageIndex >= 2;

    this.shoulderArmorGroup.visible = stageIndex >= 3;
    this.tailCore.visible = stageIndex >= 3;
    this.bioShieldHalo.visible = stageIndex >= 3;
    this.alphaCrownGroup.visible = isAlphaLeader;
  }

  public triggerAction(kind: 'eat' | 'drink' | 'pounce' | 'claw' | 'meow'): void {
    this.actionType = kind;
    this.actionTimer = kind === 'claw' ? 0.34 : kind === 'meow' ? 0.55 : 0.55;
    if (kind === 'claw') {
      this.slashArcGroup.visible = true;
      this.slashArcGroup.rotation.z = (Math.random() - 0.5) * 0.4;
    } else if (kind === 'meow') {
      this.meowRing.visible = true;
      this.meowRing.scale.setScalar(1);
    }
  }

  public triggerFourPawLanding(): void {
    this.landingSquat = 0.28;
    this.rightingRoll = 0;
  }

  public update(
    dt: number,
    horizontalSpeed: number,
    isGrounded: boolean,
    isSprinting: boolean,
    isSheltered: boolean,
    isClimbing: boolean,
    verticalVel: number,
    elapsed: number,
  ): void {
    this.currentScale = THREE.MathUtils.damp(this.currentScale, this.targetScale, 4.5, dt);
    this.root.scale.setScalar(this.currentScale);

    if (this.actionTimer > 0) {
      this.actionTimer = Math.max(0, this.actionTimer - dt);
      if (this.actionType === 'claw') {
        const progress = 1 - this.actionTimer / 0.34;
        this.slashMat.opacity = Math.sin(progress * Math.PI) * 0.9;
        this.slashArcGroup.scale.setScalar(0.85 + progress * 0.55);
      } else if (this.actionType === 'meow') {
        const progress = 1 - this.actionTimer / 0.55;
        this.meowMat.opacity = (1 - progress) * 0.85;
        this.meowRing.scale.setScalar(1 + progress * 6.5);
      }
      if (this.actionTimer === 0) {
        this.actionType = 'none';
        this.slashArcGroup.visible = false;
        this.meowRing.visible = false;
      }
    }

    if (this.landingSquat > 0) {
      this.landingSquat = Math.max(0, this.landingSquat - dt);
    }

    const moving = horizontalSpeed > 0.35;

    if (isClimbing) {
      // Vertical wall climbing posture!
      this.climbPhase += dt * (Math.abs(verticalVel) > 0.2 ? 12 : 2);
      const wave = Math.sin(this.climbPhase) * 0.5;
      this.bodyPivot.rotation.x = THREE.MathUtils.damp(this.bodyPivot.rotation.x, -Math.PI * 0.42, 14, dt);
      this.bodyPivot.rotation.z = THREE.MathUtils.damp(this.bodyPivot.rotation.z, 0, 14, dt);
      this.bodyPivot.position.y = THREE.MathUtils.damp(this.bodyPivot.position.y, 0.46, 12, dt);

      this.legs.fl.hip.rotation.x = -0.6 + wave;
      this.legs.fr.hip.rotation.x = -0.6 - wave;
      this.legs.bl.hip.rotation.x = 0.5 - wave;
      this.legs.br.hip.rotation.x = 0.5 + wave;
      this.legs.fl.shin.rotation.x = 0.4;
      this.legs.fr.shin.rotation.x = 0.4;
      this.legs.bl.shin.rotation.x = -0.35;
      this.legs.br.shin.rotation.x = -0.35;
    } else if (!isGrounded) {
      // Cat Righting Reflex: twist mid-air & always prepare all 4 paws downward to land!
      if (verticalVel < -2.5) {
        this.rightingRoll = THREE.MathUtils.damp(this.rightingRoll, 0, 8, dt);
      }
      this.bodyPivot.rotation.z = this.rightingRoll;
      this.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.bodyPivot.rotation.x,
        verticalVel > 0 ? -0.22 : 0.16,
        10,
        dt,
      );
      this.bodyPivot.position.y = THREE.MathUtils.damp(this.bodyPivot.position.y, 0.44, 10, dt);

      // All 4 legs reach downward ready for 4-paw landing
      const brace = verticalVel < -1.5 ? 0.35 : -0.45;
      this.legs.fl.hip.rotation.x = brace;
      this.legs.fr.hip.rotation.x = brace;
      this.legs.bl.hip.rotation.x = -brace * 0.6;
      this.legs.br.hip.rotation.x = -brace * 0.6;
      this.legs.fl.shin.rotation.x = 0.15;
      this.legs.fr.shin.rotation.x = 0.15;
      this.legs.bl.shin.rotation.x = -0.15;
      this.legs.br.shin.rotation.x = -0.15;
    } else if (this.actionType === 'claw') {
      // Swipe lunge with front paw
      this.bodyPivot.rotation.z = THREE.MathUtils.damp(this.bodyPivot.rotation.z, 0, 14, dt);
      this.bodyPivot.rotation.x = -0.15;
      this.legs.fr.hip.rotation.x = -1.25;
      this.legs.fr.shin.rotation.x = -0.3;
      this.legs.fl.hip.rotation.x = 0.35;
    } else if (moving) {
      this.bodyPivot.rotation.z = THREE.MathUtils.damp(this.bodyPivot.rotation.z, 0, 12, dt);
      const freq = isSprinting ? 14.5 : 9.5;
      this.gaitPhase += dt * freq * Math.min(1.5, 0.6 + horizontalSpeed * 0.08);
      const amp = isSprinting ? 0.68 : 0.45;

      const flAngle = Math.sin(this.gaitPhase) * amp;
      const frAngle = Math.sin(this.gaitPhase + (isSprinting ? 0.45 : Math.PI)) * amp;
      const blAngle = Math.sin(this.gaitPhase + Math.PI) * amp;
      const brAngle = Math.sin(this.gaitPhase + (isSprinting ? Math.PI + 0.45 : 0)) * amp;

      this.legs.fl.hip.rotation.x = flAngle;
      this.legs.fr.hip.rotation.x = frAngle;
      this.legs.bl.hip.rotation.x = blAngle;
      this.legs.br.hip.rotation.x = brAngle;

      this.legs.fl.shin.rotation.x = Math.max(0, -flAngle * 0.7);
      this.legs.fr.shin.rotation.x = Math.max(0, -frAngle * 0.7);
      this.legs.bl.shin.rotation.x = Math.max(0, -blAngle * 0.6);
      this.legs.br.shin.rotation.x = Math.max(0, -brAngle * 0.6);

      const bounce = Math.abs(Math.sin(this.gaitPhase)) * (isSprinting ? 0.055 : 0.025);
      this.bodyPivot.position.y = THREE.MathUtils.damp(this.bodyPivot.position.y, 0.42 + bounce, 14, dt);
      this.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.bodyPivot.rotation.x,
        Math.cos(this.gaitPhase) * (isSprinting ? 0.08 : 0.03),
        12,
        dt,
      );
    } else {
      this.bodyPivot.rotation.z = THREE.MathUtils.damp(this.bodyPivot.rotation.z, 0, 12, dt);
      const squatOffset = this.landingSquat > 0 ? -0.14 : 0;
      const targetBodyY = (isSheltered ? 0.31 : 0.42 + Math.sin(elapsed * 2.2) * 0.012) + squatOffset;
      this.bodyPivot.position.y = THREE.MathUtils.damp(this.bodyPivot.position.y, targetBodyY, 12, dt);
      this.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.bodyPivot.rotation.x,
        this.actionType === 'eat' || this.actionType === 'drink' ? 0.25 : 0,
        10,
        dt,
      );

      const legBend = isSheltered || this.landingSquat > 0 ? 0.45 : 0;
      this.legs.fl.hip.rotation.x = THREE.MathUtils.damp(this.legs.fl.hip.rotation.x, -legBend, 10, dt);
      this.legs.fr.hip.rotation.x = THREE.MathUtils.damp(this.legs.fr.hip.rotation.x, -legBend, 10, dt);
      this.legs.bl.hip.rotation.x = THREE.MathUtils.damp(this.legs.bl.hip.rotation.x, legBend, 10, dt);
      this.legs.br.hip.rotation.x = THREE.MathUtils.damp(this.legs.br.hip.rotation.x, legBend, 10, dt);
      this.legs.fl.shin.rotation.x = THREE.MathUtils.damp(this.legs.fl.shin.rotation.x, legBend * 1.4, 10, dt);
      this.legs.fr.shin.rotation.x = THREE.MathUtils.damp(this.legs.fr.shin.rotation.x, legBend * 1.4, 10, dt);
      this.legs.bl.shin.rotation.x = THREE.MathUtils.damp(this.legs.bl.shin.rotation.x, -legBend * 1.2, 10, dt);
      this.legs.br.shin.rotation.x = THREE.MathUtils.damp(this.legs.br.shin.rotation.x, -legBend * 1.2, 10, dt);
    }

    const headPitch =
      this.actionType === 'eat' || this.actionType === 'drink'
        ? 0.45 + Math.sin(elapsed * 16) * 0.14
        : this.actionType === 'meow'
          ? -0.35
          : Math.sin(elapsed * 1.6) * 0.04;
    const headYaw = moving ? 0 : Math.sin(elapsed * 0.9) * 0.14;
    this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, headPitch, 10, dt);
    this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, headYaw, 6, dt);

    this.leftEar.rotation.z = -0.25 + (Math.sin(elapsed * 5.3) > 0.96 ? 0.14 : 0);
    this.rightEar.rotation.z = 0.25 - (Math.sin(elapsed * 3.7) > 0.97 ? 0.14 : 0);

    this.tailSegments.forEach((seg, idx) => {
      const sway = Math.sin(elapsed * (moving ? 6.5 : 2.6) - idx * 0.65) * (moving ? 0.18 : 0.24);
      const lift = idx === 0 ? (moving ? 0.35 : 0.55) : 0.22;
      seg.rotation.y = sway;
      seg.rotation.x = lift + Math.cos(elapsed * 2.1 - idx * 0.5) * 0.08;
    });

    if (this.bioShieldHalo.visible) {
      this.bioShieldHalo.rotation.z += dt * 0.8;
    }
  }
}
