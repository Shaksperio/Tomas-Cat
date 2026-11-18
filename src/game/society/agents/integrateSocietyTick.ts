/**
 * Helper mínimo para o GameEngine avançar sociedade + agentes num único tick lógico.
 * Evita espalhar lógica da Cowila no laço de renderização.
 */

import type { SocietySimulation } from '../simulation';
import type { SocietyAgentRuntime, SocietyAgentRuntimeFrame } from './societyAgentRuntime';

export function integrateSocietyTick(
  simulation: SocietySimulation,
  agentRuntime: SocietyAgentRuntime,
): SocietyAgentRuntimeFrame {
  return agentRuntime.step(simulation, 1);
}
