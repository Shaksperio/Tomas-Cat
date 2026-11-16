/**
 * Meshes low-poly de portais (anel + partículas leves).
 * Só apresentação — ativação vem de portalSystem.
 */
import * as THREE from 'three';
import type { PortalDef } from './portalSystem';
import { portalIsActive } from './portalSystem';

interface PortalMesh {
  def: PortalDef;
  group: THREE.Group;
  ring: THREE.Mesh;
  glow: THREE.Mesh;
}

export class PortalVisuals {
  private readonly portals: PortalMesh[] = [];
  private elapsed = 0;

  constructor(
    private readonly scene: THREE.Scene,
    defs: readonly PortalDef[],
  ) {
    for (const def of defs) {
      const group = new THREE.Group();
      group.position.set(def.position[0], def.position[1], def.position[2]);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.6, 0.12, 8, 24),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;

      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(1.35, 20),
        new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.05;

      group.add(ring);
      group.add(glow);
      this.scene.add(group);
      this.portals.push({ def, group, ring, glow });
    }
  }

  update(dt: number, flags: ReadonlySet<string> | readonly string[]): void {
    this.elapsed += dt;
    for (const p of this.portals) {
      const active = portalIsActive(p.def, flags);
      const ringMat = p.ring.material as THREE.MeshBasicMaterial;
      const glowMat = p.glow.material as THREE.MeshBasicMaterial;
      if (active) {
        ringMat.opacity = 0.55 + Math.sin(this.elapsed * 3) * 0.2;
        glowMat.opacity = 0.22 + Math.sin(this.elapsed * 2.2) * 0.08;
        ringMat.color.setHex(0x38bdf8);
        p.ring.rotation.z += dt * 0.8;
      } else {
        ringMat.opacity = 0.18;
        glowMat.opacity = 0.06;
        ringMat.color.setHex(0x64748b);
      }
    }
  }

  dispose(): void {
    for (const p of this.portals) {
      this.scene.remove(p.group);
      p.ring.geometry.dispose();
      (p.ring.material as THREE.Material).dispose();
      p.glow.geometry.dispose();
      (p.glow.material as THREE.Material).dispose();
    }
    this.portals.length = 0;
  }
}
