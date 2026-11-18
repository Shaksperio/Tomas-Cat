/**
 * Um SocietyAgentRuntime isolado por mundo jogável.
 * Espelha a ideia do WorldSocietyRegistry: memória e Cowila não vazam entre mundos.
 */

import { SocietyAgentRuntime, type SocietyAgentRuntimeConfig, type SocietyAgentRuntimeState } from './societyAgentRuntime';

export class WorldAgentRuntimeRegistry {
  private readonly runtimes = new Map<string, SocietyAgentRuntime>();

  constructor(
    worldIds: readonly string[],
    private readonly config: SocietyAgentRuntimeConfig = {},
  ) {
    if (worldIds.length === 0) throw new Error('At least one world must be registered.');
    for (const worldId of worldIds) {
      if (this.runtimes.has(worldId)) throw new Error(`Duplicate world ID: ${worldId}`);
      this.runtimes.set(worldId, new SocietyAgentRuntime(config));
    }
  }

  runtimeFor(worldId: string): SocietyAgentRuntime {
    const runtime = this.runtimes.get(worldId);
    if (!runtime) throw new Error(`Unknown world: ${worldId}`);
    return runtime;
  }

  /** Recria o runtime de um mundo (ex.: novo jogo naquele mundo). */
  reset(worldId: string): SocietyAgentRuntime {
    if (!this.runtimes.has(worldId)) throw new Error(`Unknown world: ${worldId}`);
    const runtime = new SocietyAgentRuntime(this.config);
    this.runtimes.set(worldId, runtime);
    return runtime;
  }

  exportStates(): Record<string, SocietyAgentRuntimeState> {
    return Object.fromEntries([...this.runtimes.entries()].map(([worldId, runtime]) =>
      [worldId, runtime.exportState()] as const,
    ));
  }

  restoreStates(states: Record<string, SocietyAgentRuntimeState>): boolean {
    if (!states || typeof states !== 'object') return false;
    const entries = Object.entries(states);
    if (entries.some(([worldId]) => !this.runtimes.has(worldId))) return false;
    const candidates = new Map<string, SocietyAgentRuntime>();
    for (const [worldId, state] of entries) {
      const runtime = new SocietyAgentRuntime(this.config);
      if (!runtime.restoreState(state)) return false;
      candidates.set(worldId, runtime);
    }
    for (const [worldId, runtime] of candidates) this.runtimes.set(worldId, runtime);
    return true;
  }

  get registeredWorldIds(): readonly string[] {
    return [...this.runtimes.keys()];
  }
}
