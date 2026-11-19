import * as THREE from 'three';

/** Avatar físico do Oráculo: a instância só é criada para a conta proprietária. */
export class OraculoActor {
  readonly root = new THREE.Group();
  private readonly halo: THREE.Mesh;
  private elapsed = 0;

  constructor(private readonly scene: THREE.Scene) {
    const robe = new THREE.MeshStandardMaterial({ color: 0x172554, metalness: 0.48, roughness: 0.32, emissive: 0x082f49, emissiveIntensity: 0.55 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.82, roughness: 0.2 });
    const cyan = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.62, 5, 10), robe);
    body.position.y = 0.72;
    body.castShadow = true;
    this.root.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 14), silver);
    head.position.y = 1.48;
    head.castShadow = true;
    this.root.add(head);
    const ears = new THREE.ConeGeometry(0.11, 0.34, 5);
    for (const x of [-0.19, 0.19]) {
      const ear = new THREE.Mesh(ears, silver);
      ear.position.set(x, 1.76, 0.02);
      ear.rotation.z = x < 0 ? 0.22 : -0.22;
      this.root.add(ear);
    }
    const eye = new THREE.SphereGeometry(0.045, 8, 8);
    for (const x of [-0.105, 0.105]) {
      const glow = new THREE.Mesh(eye, cyan);
      glow.position.set(x, 1.5, 0.255);
      this.root.add(glow);
    }
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 1), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 2.2, metalness: 0.7, roughness: 0.12 }));
    crystal.position.set(0, 2.12, 0);
    crystal.name = 'oraculo-core';
    this.root.add(crystal);
    this.halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 8, 48), cyan);
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = 0.08;
    this.root.add(this.halo);

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 112;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(4, 12, 28, .9)';
      context.beginPath(); context.roundRect(8, 8, 496, 96, 26); context.fill();
      context.strokeStyle = '#22d3ee'; context.lineWidth = 3; context.stroke();
      context.fillStyle = '#cffafe'; context.font = 'bold 48px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText('ORÁCULO · COWILA', 256, 56);
    }
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
    label.position.y = 2.55; label.scale.set(2.9, 0.64, 1); this.root.add(label);
    this.root.position.set(-3.5, 0, -5.5);
    this.scene.add(this.root);
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.root.position.y = Math.sin(this.elapsed * 1.5) * 0.07;
    const core = this.root.getObjectByName('oraculo-core');
    if (core) { core.rotation.y += dt * 0.8; core.rotation.x += dt * 0.35; }
    this.halo.rotation.z += dt * 0.3;
  }

  isNear(x: number, z: number): boolean {
    return Math.hypot(this.root.position.x - x, this.root.position.z - z) <= 3.8;
  }

  dispose(): void {
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshStandardMaterial || material instanceof THREE.SpriteMaterial) {
            material.map?.dispose();
          }
          material.dispose();
        });
      }
    });
    this.scene.remove(this.root);
  }
}
