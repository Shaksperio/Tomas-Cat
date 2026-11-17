import { SocietySimulation, type SocietySimulationSnapshot } from './simulation';

const WORLD_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/i;

/**
 * Keeps an isolated deterministic society simulation for each registered world.
 *
 * This is an in-memory runtime foundation for the Matrix-style world model:
 * each world has its own agents, tasks, relationships, resources and logical
 * clock. It does not imply persistence, networking, background execution or
 * a connection to the Three.js scene.
 */
export class WorldSocietyRegistry {
  private readonly worlds = new Map<string, SocietySimulation>();

  constructor(worldIds: readonly string[]) {
    if (worldIds.length === 0) throw new Error('At least one world must be registered.');
    for (const worldId of worldIds) {
      if (!WORLD_ID_PATTERN.test(worldId)) throw new Error(`Invalid world ID: ${worldId}`);
      if (this.worlds.has(worldId)) throw new Error(`Duplicate world ID: ${worldId}`);
      this.worlds.set(worldId, new SocietySimulation());
    }
  }

  get registeredWorldIds(): readonly string[] {
    return [...this.worlds.keys()];
  }

  hasWorld(worldId: string): boolean {
    return this.worlds.has(worldId);
  }

  snapshot(worldId: string): SocietySimulationSnapshot {
    const simulation = this.worlds.get(worldId);
    if (!simulation) throw new Error(`Unknown world: ${worldId}`);
    return simulation.snapshot();
  }

  advance(worldId: string, ticks = 1): SocietySimulationSnapshot {
    const simulation = this.worlds.get(worldId);
    if (!simulation) throw new Error(`Unknown world: ${worldId}`);
    return simulation.step(ticks);
  }

  /** Advances each registered world independently, in registration order. */
  advanceAll(ticks = 1): ReadonlyMap<string, SocietySimulationSnapshot> {
    const snapshots = new Map<string, SocietySimulationSnapshot>();
    for (const [worldId, simulation] of this.worlds) {
      snapshots.set(worldId, simulation.step(ticks));
    }
    return snapshots;
  }
}
