import * as THREE from 'three';
import type { SocietySimulationSnapshot, SimulatedAgent } from './simulation';

interface SocietyActorView {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  legs: THREE.Mesh[];
  badge: THREE.Mesh;
  nameTag: THREE.Sprite;
  socialBubble: THREE.Sprite;
  socialBubbleTimer: number;
  phase: number;
}

const PROFESSION_COLORS: Record<SimulatedAgent['profession'], number> = {
  engineer: 0x38bdf8,
  worker: 0xf59e0b,
  agent: 0xa78bfa,
  farmer: 0x84cc16,
  lumberjack: 0xb45309,
  miner: 0x94a3b8,
  carpenter: 0xd97706,
  merchant: 0xec4899,
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
  /** Habitante cuja posição/rotação é controlada por uma cena (ex.: batalha). */
  private controlledAgentIds = new Set<string>();
  private readonly constructions = new Map<string, THREE.Group>();
  private farm: THREE.Group | null = null;
  private readonly crops: THREE.Group[] = [];
  private storage: THREE.Group | null = null;
  private market: THREE.Group | null = null;
  private marketSignTexture: THREE.CanvasTexture | null = null;
  private marketSignCanvas: HTMLCanvasElement | null = null;
  private readonly stockBars = new Map<keyof SocietySimulationSnapshot['resources'], THREE.Mesh>();
  private readonly processedSocialEventIds = new Set<string>();

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

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const labelContext = labelCanvas.getContext('2d');
    if (labelContext) {
      labelContext.fillStyle = 'rgba(8, 16, 30, 0.82)';
      labelContext.beginPath();
      labelContext.roundRect(8, 8, 240, 48, 18);
      labelContext.fill();
      labelContext.font = 'bold 26px sans-serif';
      labelContext.textAlign = 'center';
      labelContext.textBaseline = 'middle';
      labelContext.fillStyle = '#f8fafc';
      labelContext.fillText(agent.displayName, 128, 32);
    }
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const nameTag = new THREE.Sprite(new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      depthWrite: false,
    }));
    nameTag.position.set(0, 1.48, 0);
    nameTag.scale.set(1.35, 0.34, 1);
    root.add(nameTag);

    const bubbleCanvas = document.createElement('canvas');
    bubbleCanvas.width = 128;
    bubbleCanvas.height = 72;
    const bubbleContext = bubbleCanvas.getContext('2d');
    if (bubbleContext) {
      bubbleContext.fillStyle = 'rgba(8, 16, 30, 0.9)';
      bubbleContext.beginPath();
      bubbleContext.roundRect(8, 6, 112, 52, 22);
      bubbleContext.fill();
      bubbleContext.fillStyle = '#67e8f9';
      for (const x of [42, 64, 86]) {
        bubbleContext.beginPath();
        bubbleContext.arc(x, 32, 6, 0, Math.PI * 2);
        bubbleContext.fill();
      }
    }
    const socialBubble = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(bubbleCanvas),
      transparent: true,
      depthWrite: false,
    }));
    socialBubble.position.set(0, 1.92, 0);
    socialBubble.scale.set(0.62, 0.35, 1);
    socialBubble.visible = false;
    root.add(socialBubble);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 12),
      new THREE.MeshBasicMaterial({ color: 0x050b14, transparent: true, opacity: 0.22 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    root.add(shadow);

    this.scene.add(root);
    return { root, body, head, legs, badge, nameTag, socialBubble, socialBubbleTimer: 0, phase: agent.id.length * 0.73 };
  }

  private createFarm(): void {
    const farm = new THREE.Group();
    const soil = new THREE.MeshStandardMaterial({ color: 0x76523b, roughness: 1 });
    const furrow = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 3.6), soil);
    furrow.position.y = 0.06;
    furrow.receiveShadow = true;
    farm.add(furrow);

    const cropStem = new THREE.MeshStandardMaterial({ color: 0x4d9b45, roughness: 0.9 });
    const cropLeaf = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.85 });
    const cropFruit = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.7 });
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const plant = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.48, 6), cropStem);
        stem.position.y = 0.24;
        plant.add(stem);
        for (const side of [-1, 1]) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5), cropLeaf);
          leaf.scale.set(1.5, 0.45, 0.8);
          leaf.position.set(side * 0.13, 0.27, 0);
          plant.add(leaf);
        }
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), cropFruit);
        fruit.position.set(0, 0.49, 0.04);
        plant.add(fruit);
        plant.position.set(-1.95 + column * 1.3, 0.12, -1.15 + row * 1.15);
        farm.add(plant);
        this.crops.push(plant);
      }
    }
    farm.position.set(10, 0, 4);
    farm.visible = false;
    this.scene.add(farm);
    this.farm = farm;
  }

  private createStorage(): void {
    const storage = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x79543a, roughness: 0.9 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x87939d, roughness: 0.95 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 1.5), stone);
    base.position.y = 0.09;
    storage.add(base);
    const resources: Array<[keyof SocietySimulationSnapshot['resources'], number]> = [
      ['food', -1.6], ['wood', -0.8], ['stone', 0], ['planks', 0.8], ['coins', 1.6],
    ];
    for (const [resource, x] of resources) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), wood);
      crate.position.set(x, 0.49, 0);
      crate.castShadow = true;
      storage.add(crate);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.08, 0.08),
        new THREE.MeshBasicMaterial({ color: resource === 'food' ? 0x84cc16 : resource === 'wood' ? 0xf59e0b : resource === 'stone' ? 0x94a3b8 : resource === 'planks' ? 0xd97706 : 0xfacc15 }),
      );
      bar.position.set(x, 0.92, 0.37);
      storage.add(bar);
      this.stockBars.set(resource, bar);
    }
    storage.position.set(5, 0, 8);
    storage.visible = false;
    this.scene.add(storage);
    this.storage = storage;
  }

  private createMarket(): void {
    const market = new THREE.Group();
    const timber = new THREE.MeshStandardMaterial({ color: 0x805333, roughness: 0.86 });
    const fabric = new THREE.MeshStandardMaterial({ color: 0xbe3455, roughness: 0.92 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.82, 0.85), timber);
    counter.position.y = 0.42;
    counter.castShadow = true;
    market.add(counter);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 1.45), fabric);
    roof.position.y = 2.05;
    roof.castShadow = true;
    market.add(roof);
    for (const x of [-1.25, 1.25]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 2.05, 8), timber);
      post.position.set(x, 1.05, -0.48);
      post.castShadow = true;
      market.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.48, 0.16), fabric);
    canopy.position.set(0, 1.78, 0.67);
    market.add(canopy);

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 128;
    const context = signCanvas.getContext('2d');
    if (context) {
      context.fillStyle = '#111827';
      context.fillRect(0, 0, 512, 128);
      context.fillStyle = '#f8fafc';
      context.font = 'bold 48px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('MERCADO', 256, 64);
    }
    this.marketSignCanvas = signCanvas;
    this.marketSignTexture = new THREE.CanvasTexture(signCanvas);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.marketSignTexture,
      transparent: false,
      depthWrite: false,
    }));
    sign.position.set(0, 2.45, 0.15);
    sign.scale.set(2.1, 0.52, 1);
    market.add(sign);

    market.position.set(3, 0, 6);
    market.visible = false;
    this.scene.add(market);
    this.market = market;
  }

  private updateCommunityVisuals(snapshot: SocietySimulationSnapshot, visible: boolean): void {
    if (!this.farm) this.createFarm();
    if (!this.storage) this.createStorage();
    if (!this.market) this.createMarket();
    if (!this.farm || !this.storage || !this.market) return;

    const farmerTask = snapshot.tasks.find((task) =>
      task.assignedAgentId === 'farmer-01'
      && (task.kind === 'cultivate_field' || task.kind === 'harvest_food')
      && task.status !== 'completed' && task.status !== 'cancelled',
    );
    const growing = farmerTask?.kind === 'cultivate_field' && farmerTask.status === 'in_progress';
    const harvestReady = farmerTask?.kind === 'harvest_food';
    const cycle = (snapshot.tick % 36) / 36;
    const growth = harvestReady ? 1 : growing ? Math.max(0.18, cycle) : Math.max(0.12, cycle * 0.82);
    for (const [index, crop] of this.crops.entries()) {
      const variation = 0.82 + (index % 4) * 0.06;
      crop.scale.setScalar(growth * variation);
      crop.visible = true;
    }
    this.farm.visible = visible;
    this.storage.visible = visible;
    this.market.visible = visible;
    const maximum = Math.max(10, snapshot.resources.food, snapshot.resources.wood, snapshot.resources.stone);
    for (const [resource, bar] of this.stockBars) {
      const amount = snapshot.resources[resource];
      bar.scale.x = 0.35 + (amount / maximum) * 1.1;
      bar.visible = amount > 0;
    }
    const context = this.marketSignCanvas?.getContext('2d');
    if (context && this.marketSignTexture) {
      context.fillStyle = '#111827';
      context.fillRect(0, 0, 512, 128);
      context.fillStyle = '#f8fafc';
      context.font = 'bold 42px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('MERCADO', 256, 42);
      context.fillStyle = '#facc15';
      context.font = 'bold 30px sans-serif';
      context.fillText(`\u25C6 ${snapshot.resources.coins} moedas`, 256, 91);
      this.marketSignTexture.needsUpdate = true;
    }
  }

  public getActorRoot(agentId: string): THREE.Object3D | null {
    return this.actors.get(agentId)?.root ?? null;
  }

  /** Enquanto definido, a cena controla posição e rotação deste habitante. */
  public setSceneControl(agentIds: string | string[] | null): void {
    this.controlledAgentIds = new Set(agentIds === null ? [] : Array.isArray(agentIds) ? agentIds : [agentIds]);
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
      if (!this.controlledAgentIds.has(agent.id)) {
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
      }
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

    for (const event of snapshot.events) {
      if (event.kind !== 'social_interaction' || this.processedSocialEventIds.has(event.id)) continue;
      this.processedSocialEventIds.add(event.id);
      const payload = event.payload as { fromAgentId?: unknown; toAgentId?: unknown };
      for (const agentId of [payload.fromAgentId, payload.toAgentId]) {
        if (typeof agentId !== 'string') continue;
        const actor = this.actors.get(agentId);
        if (actor) actor.socialBubbleTimer = 2.4;
      }
    }
    if (this.processedSocialEventIds.size > 512) {
      this.processedSocialEventIds.clear();
      for (const event of snapshot.events) {
        if (event.kind === 'social_interaction') this.processedSocialEventIds.add(event.id);
      }
    }

    for (const [id, actor] of this.actors) {
      if (!activeIds.has(id)) actor.root.visible = false;
      actor.socialBubbleTimer = Math.max(0, actor.socialBubbleTimer - dt);
      actor.socialBubble.visible = visible && actor.socialBubbleTimer > 0;
      actor.socialBubble.material.opacity = Math.min(1, actor.socialBubbleTimer * 2);
    }

    this.updateCommunityVisuals(snapshot, visible);

    // Uma estrutura só aparece após a tarefa de construção ser concluída.
    for (const task of snapshot.tasks) {
      if (task.kind !== 'build_module' || task.status !== 'completed' || !task.target) continue;
      if (this.constructions.has(task.id)) continue;

      const structure = new THREE.Group();
      const stone = new THREE.MeshStandardMaterial({ color: 0x87939d, roughness: 0.92 });
      const timber = new THREE.MeshStandardMaterial({ color: 0x79543a, roughness: 0.88 });
      const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x344b5b, roughness: 0.82 });

      const foundation = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 2.1), stone);
      foundation.position.y = 0.11;
      foundation.castShadow = true;
      foundation.receiveShadow = true;
      structure.add(foundation);

      for (const x of [-0.92, 0.92]) {
        for (const z of [-0.78, 0.78]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.55, 0.16), timber);
          post.position.set(x, 0.98, z);
          post.castShadow = true;
          structure.add(post);
        }
      }

      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.72, 0.82, 4), roofMaterial);
      roof.position.y = 2.08;
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 0.82;
      roof.castShadow = true;
      structure.add(roof);

      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.3, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x082f49, emissiveIntensity: 0.45 }),
      );
      sign.position.set(0, 1.05, 0.91);
      structure.add(sign);

      structure.position.set(task.target.x, 0, task.target.z);
      structure.visible = visible;
      this.scene.add(structure);
      this.constructions.set(task.id, structure);
    }
    for (const structure of this.constructions.values()) structure.visible = visible;
  }

  public dispose(): void {
    for (const actor of this.actors.values()) {
      actor.root.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material instanceof THREE.SpriteMaterial && material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
      this.scene.remove(actor.root);
    }
    this.actors.clear();
    for (const structure of this.constructions.values()) {
      structure.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      this.scene.remove(structure);
    }
    this.constructions.clear();
    for (const group of [this.farm, this.storage, this.market]) {
      if (!group) continue;
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      this.scene.remove(group);
    }
    this.farm = null;
    this.storage = null;
    this.market = null;
    this.marketSignTexture?.dispose();
    this.marketSignTexture = null;
    this.marketSignCanvas = null;
    this.crops.length = 0;
    this.stockBars.clear();
  }
}
