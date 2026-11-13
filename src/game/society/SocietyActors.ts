import * as THREE from 'three';
import type { SocietySimulationSnapshot, SimulatedAgent } from './simulation';

interface SocietyActorView {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  legs: THREE.Mesh[];
  badge: THREE.Mesh;
  phase: number;
}

const PROFESSION_COLORS: Record<SimulatedAgent['profession'], number> = {
  engineer: 0x38bdf8,
  worker: 0xf59e0b,
  agent: 0xa78bfa,
};

const STATUS_COLORS: Record<SimulatedAgent['status'], number> = {
  idle: 0x22c55e,
  working: 0xf59e0b,
  resting: 0x60a5fa,
  travelling: 0x06b6d4,
  disabled: 0x64748b,
};

/** Renderização leve dos habitantes; a simulação continua independente do Three.js. */
export class SocietyActors {
  private readonly actors = new Map<string, SocietyActorView>();

  constructor(private readonly scene: THREE.Scene) {}

  private createActor(agent: SimulatedAgent): SocietyActorView {
    const root = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({
      color: PROFESSION_COLORS[agent.profession],
      roughness: 0.78,
    });
    const face = new THREE.MeshStandardMaterial({ color: 0xe8d9c8, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x202b3a, roughness: 0.65 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), coat);
    body.scale.set(0.82, 0.72, 1.28);
    body.position.y = 0.43;
    body.castShadow = true;
    root.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), face);
    head.position.set(0, 0.68, 0.32);
    head.castShadow = true;
    root.add(head);

    const earGeometry = new THREE.ConeGeometry(0.095, 0.22, 5);
    const earLeft = new THREE.Mesh(earGeometry, face);
    earLeft.position.set(-0.15, 0.91, 0.31);
    earLeft.rotation.z = -0.18;
    const earRight = new THREE.Mesh(earGeometry, face);
    earRight.position.set(0.15, 0.91, 0.31);
    earRight.rotation.z = 0.18;
    root.add(earLeft, earRight);

    const eyes = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x172033 }),
    );
    const eyeLeft = eyes.clone();
    eyeLeft.position.set(-0.09, 0.71, 0.535);
    const eyeRight = eyes.clone();
    eyeRight.position.set(0.09, 0.71, 0.535);
    root.add(eyeLeft, eyeRight);

    const legs: THREE.Mesh[] = [];
    const legGeometry = new THREE.CapsuleGeometry(0.065, 0.22, 3, 6);
    for (const x of [-0.19, 0.19]) {
      for (const z of [-0.18, 0.24]) {
        const leg = new THREE.Mesh(legGeometry, coat);
        leg.position.set(x, 0.19, z);
        leg.castShadow = true;
        root.add(leg);
        legs.push(leg);
      }
    }

    const tail = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.38, 3, 6),
      coat,
    );
    tail.position.set(0, 0.48, -0.48);
    tail.rotation.x = Math.PI / 2.8;
    root.add(tail);

    const badge = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshBasicMaterial({ color: STATUS_COLORS[agent.status] }),
    );
    badge.position.set(0, 1.18, 0);
    root.add(badge);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 12),
      new THREE.MeshBasicMaterial({ color: 0x050b14, transparent: true, opacity: 0.22 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    root.add(shadow);

    this.scene.add(root);
    return { root, body, head, legs, badge, phase: agent.id.length * 0.73 };
  }

  public update(
    dt: number,
    snapshot: SocietySimulationSnapshot,
    visible: boolean,
  ): void {
    const activeIds = new Set(snapshot.agents.map((agent) => agent.id));
    for (const agent of snapshot.agents) {
      let actor = this.actors.get(agent.id);
      if (!actor) {
        actor = this.createActor(agent);
        this.actors.set(agent.id, actor);
      }

      actor.root.visible = visible && agent.status !== 'disabled';
      actor.root.position.x = THREE.MathUtils.damp(
        actor.root.position.x,
        agent.position.x,
        3.2,
        dt,
      );
      actor.root.position.z = THREE.MathUtils.damp(
        actor.root.position.z,
        agent.position.z,
        3.2,
        dt,
      );
      actor.root.rotation.y = THREE.MathUtils.damp(
        actor.root.rotation.y,
        agent.status === 'working' ? Math.PI * 0.5 : 0,
        2,
        dt,
      );
      (actor.badge.material as THREE.MeshBasicMaterial).color.setHex(STATUS_COLORS[agent.status]);
      actor.phase += dt * (agent.status === 'working' ? 8 : 2.2);
      const stride = agent.status === 'working' ? Math.sin(actor.phase) * 0.42 : 0;
      actor.legs[0].rotation.x = stride;
      actor.legs[3].rotation.x = stride;
      actor.legs[1].rotation.x = -stride;
      actor.legs[2].rotation.x = -stride;
      actor.body.position.y = 0.43 + (agent.status === 'resting' ? -0.1 : Math.sin(actor.phase * 0.5) * 0.018);
      actor.head.position.y = agent.status === 'resting' ? 0.56 : 0.68;
    }

    for (const [id, actor] of this.actors) {
      if (!activeIds.has(id)) actor.root.visible = false;
    }
  }

  public dispose(): void {
    for (const actor of this.actors.values()) {
      actor.root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      this.scene.remove(actor.root);
    }
    this.actors.clear();
  }
}
