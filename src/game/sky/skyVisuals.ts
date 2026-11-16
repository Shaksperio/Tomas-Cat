/**
 * Apresentação 3D da atmosfera (nuvens + aves).
 * Consome sampleSkyAtmosphere; não altera regras de gameplay.
 */
import * as THREE from 'three';
import type { SkyAtmosphereSample } from './skyAtmosphere';

const CLOUD_COUNT = 14;
const BIRD_COUNT = 24;

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class SkyVisuals {
  private readonly cloudGroup = new THREE.Group();
  private readonly birdPoints: THREE.Points;
  private readonly birdPositions: Float32Array;
  private readonly birdPhases: Float32Array;
  private cloudDrift = 0;
  private readonly cloudMeshes: THREE.Mesh[] = [];

  constructor(private readonly scene: THREE.Scene) {
    const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
    });
    const rand = seededRand(0x5c1a11);
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const mesh = new THREE.Mesh(cloudGeo, cloudMat.clone());
      const scale = 8 + rand() * 18;
      mesh.scale.set(scale * (1.4 + rand()), scale * 0.45, scale * (1.1 + rand() * 0.5));
      mesh.position.set(
        (rand() - 0.5) * 380,
        42 + rand() * 55,
        (rand() - 0.5) * 380,
      );
      mesh.visible = false;
      this.cloudGroup.add(mesh);
      this.cloudMeshes.push(mesh);
    }
    this.cloudGroup.frustumCulled = false;
    this.scene.add(this.cloudGroup);

    this.birdPositions = new Float32Array(BIRD_COUNT * 3);
    this.birdPhases = new Float32Array(BIRD_COUNT);
    const brand = seededRand(0xb1rd);
    for (let i = 0; i < BIRD_COUNT; i++) {
      this.birdPhases[i] = brand() * Math.PI * 2;
      this.birdPositions[i * 3] = 0;
      this.birdPositions[i * 3 + 1] = 30;
      this.birdPositions[i * 3 + 2] = 0;
    }
    const birdGeo = new THREE.BufferGeometry();
    birdGeo.setAttribute('position', new THREE.BufferAttribute(this.birdPositions, 3));
    this.birdPoints = new THREE.Points(
      birdGeo,
      new THREE.PointsMaterial({
        color: 0x1e293b,
        size: 2.4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        fog: false,
      }),
    );
    this.birdPoints.visible = false;
    this.birdPoints.frustumCulled = false;
    this.scene.add(this.birdPoints);
  }

  update(
    dt: number,
    catX: number,
    catZ: number,
    sample: SkyAtmosphereSample,
    moonMesh?: THREE.Mesh,
  ): void {
    this.cloudDrift += dt * sample.clouds.drift * 4.5;
    const dens = sample.clouds.density;
    const showClouds = dens > 0.05;
    this.cloudGroup.position.set(catX, 0, catZ);
    const visibleCount = showClouds ? Math.max(2, Math.round(dens * CLOUD_COUNT)) : 0;

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const mesh = this.cloudMeshes[i];
      const on = i < visibleCount;
      mesh.visible = on;
      if (!on) continue;
      const baseX = ((i * 97) % 360) - 180;
      const baseZ = ((i * 53) % 360) - 180;
      mesh.position.x = baseX + Math.sin(this.cloudDrift * 0.15 + i) * 12;
      mesh.position.z = baseZ + Math.cos(this.cloudDrift * 0.11 + i * 0.7) * 10;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + dens * 0.55;
      if (dens > 0.6) mat.color.setHex(0xcbd5e1);
      else mat.color.setHex(0xf8fafc);
    }

    if (moonMesh) {
      const illum = sample.moonIllumination;
      const s = 0.85 + illum * 0.35;
      moonMesh.scale.setScalar(s);
      const mat = moonMesh.material as THREE.MeshBasicMaterial;
      const c = 0.55 + illum * 0.45;
      mat.color.setRGB(c * 0.95, c * 0.97, 1);
    }

    const birds = sample.birds;
    this.birdPoints.visible = birds.active && birds.flockStrength > 0.1;
    if (this.birdPoints.visible) {
      const n = Math.max(4, Math.round(birds.flockStrength * BIRD_COUNT));
      const radius = 55 + birds.flockStrength * 40;
      const height = 28 + birds.flockStrength * 18;
      for (let i = 0; i < BIRD_COUNT; i++) {
        if (i >= n) {
          this.birdPositions[i * 3 + 1] = -999;
          continue;
        }
        this.birdPhases[i] += dt * (0.35 + (i % 5) * 0.07);
        const a = this.birdPhases[i];
        const ring = radius * (0.6 + (i % 3) * 0.2);
        this.birdPositions[i * 3] = catX + Math.cos(a) * ring;
        this.birdPositions[i * 3 + 1] = height + Math.sin(a * 2.3 + i) * 4;
        this.birdPositions[i * 3 + 2] = catZ + Math.sin(a) * ring * 0.85;
      }
      const attr = this.birdPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate = true;
      (this.birdPoints.material as THREE.PointsMaterial).opacity = 0.5 + birds.flockStrength * 0.4;
    }
  }

  dispose(): void {
    this.scene.remove(this.cloudGroup);
    this.scene.remove(this.birdPoints);
    for (const m of this.cloudMeshes) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.birdPoints.geometry.dispose();
    (this.birdPoints.material as THREE.Material).dispose();
  }
}
