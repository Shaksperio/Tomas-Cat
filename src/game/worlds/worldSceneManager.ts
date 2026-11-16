import * as THREE from 'three';
import type { WorldId, WorldPoint } from './portalWorlds';
import type { BuiltWorld } from '../worldBuilder';

export interface WorldSceneDefinition {
  id: WorldId;
  spawn: WorldPoint;
  build: (root: THREE.Group) => BuiltWorld;
}

export interface WorldSceneInstance {
  readonly id: WorldId;
  readonly root: THREE.Group;
  readonly spawn: WorldPoint;
  readonly world: BuiltWorld;
}

function disposeRoot(root: THREE.Object3D): void {
  root.traverse((object) => {
    const renderable = object as THREE.Mesh | THREE.Points | THREE.Line;
    if (!renderable.geometry) return;
    renderable.geometry.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    materials.forEach((material) => material.dispose());
  });
}

/**
 * Owns the 3D roots for independent worlds. Factories are lazy and each world
 * has its own root, collision/world data and spawn; global player/UI systems
 * remain outside these roots. No assumptions are made about campaign phases.
 */
export class WorldSceneManager {
  private readonly definitions = new Map<WorldId, WorldSceneDefinition>();
  private readonly instances = new Map<WorldId, WorldSceneInstance>();
  private activeId: WorldId | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    definitions: readonly WorldSceneDefinition[],
    initialWorldId: WorldId,
  ) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.id)) throw new Error(`Duplicate world scene: ${definition.id}`);
      this.definitions.set(definition.id, definition);
    }
    if (!this.definitions.has(initialWorldId)) throw new Error(`Unknown initial world scene: ${initialWorldId}`);
    this.activate(initialWorldId);
  }

  get active(): WorldSceneInstance {
    if (!this.activeId) throw new Error('No active world scene');
    return this.instances.get(this.activeId)!;
  }

  get activeWorldId(): WorldId {
    return this.active.id;
  }

  get registeredWorldIds(): readonly WorldId[] {
    return [...this.definitions.keys()];
  }

  activate(worldId: WorldId): WorldSceneInstance {
    const definition = this.definitions.get(worldId);
    if (!definition) throw new Error(`World scene is not registered: ${worldId}`);

    if (this.activeId && this.activeId !== worldId) {
      const previous = this.instances.get(this.activeId);
      if (previous) previous.root.visible = false;
    }

    let instance = this.instances.get(worldId);
    if (!instance) {
      const root = new THREE.Group();
      root.name = `world:${worldId}`;
      root.visible = false;
      try {
        const world = definition.build(root);
        instance = { id: worldId, root, spawn: { ...definition.spawn }, world };
        this.scene.add(root);
        this.instances.set(worldId, instance);
      } catch (error) {
        disposeRoot(root);
        throw error;
      }
    }

    instance.root.visible = true;
    this.activeId = worldId;
    return instance;
  }

  unload(worldId: WorldId): boolean {
    if (worldId === this.activeId) return false;
    const instance = this.instances.get(worldId);
    if (!instance) return false;
    this.scene.remove(instance.root);
    disposeRoot(instance.root);
    this.instances.delete(worldId);
    return true;
  }

  dispose(): void {
    for (const instance of this.instances.values()) {
      this.scene.remove(instance.root);
      disposeRoot(instance.root);
    }
    this.instances.clear();
    this.activeId = null;
  }
}
