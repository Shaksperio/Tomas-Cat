/**
 * Um SocietyAgentRuntime isolado por mundo jogável.
 * Espelha a ideia do WorldSocietyRegistry: memória e Cowila não vazam entre mundos.
 */

import { SocietyAgentRuntime, type SocietyAgentRuntimeConfig } from './societyAgentRuntime';

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

  get registeredWorldIds(): readonly string[] {
    return [...this.runtimes.keys()];
  }
}
