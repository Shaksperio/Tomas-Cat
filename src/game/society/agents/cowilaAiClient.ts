import type { SocietySimulationSnapshot } from '../simulation';
import { getSpecialistProfile } from './catalog';

export interface CowilaAiProposal {
  agentId: string;
  taskKind: string;
  reason: string;
  priority: number;
}

export interface CowilaAiDecision {
  tick: number;
  brief: string;
  proposals: CowilaAiProposal[];
  model?: string;
}

const endpoint = (import.meta.env.VITE_COWILA_AI_URL as string | undefined) || 'https://tomas-cowila-ai.antonyopintor.workers.dev';

export function isCowilaAiConfigured(): boolean {
  return typeof endpoint === 'string' && /^https:\/\//i.test(endpoint);
}

export async function requestCowilaDecision(
  snapshot: SocietySimulationSnapshot,
  signal?: AbortSignal,
): Promise<CowilaAiDecision> {
  if (!isCowilaAiConfigured()) throw new Error('Cowila AI ainda não está configurada.');
  const response = await fetch(`${endpoint!.replace(/\/$/, '')}/v1/decisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      tick: snapshot.tick,
      resources: snapshot.resources,
      agents: snapshot.agents.map((agent) => ({
        id: agent.id,
        name: agent.displayName,
        profession: agent.profession,
        status: agent.status,
        activeTaskId: agent.activeTaskId,
        energy: agent.energy,
        health: agent.health,
        sectorId: agent.position.sectorId,
        allowedTasks: getSpecialistProfile(agent.profession)?.allowedTasks ?? [],
      })),
      recentEvents: snapshot.events.slice(-12).map((event) => event.kind),
    }),
  });
  if (!response.ok) throw new Error(`Cowila AI respondeu HTTP ${response.status}.`);
  const data = await response.json() as CowilaAiDecision;
  if (data.tick !== snapshot.tick || !Array.isArray(data.proposals) || typeof data.brief !== 'string') {
    throw new Error('Resposta da Cowila AI inválida ou desatualizada.');
  }
  return data;
}
