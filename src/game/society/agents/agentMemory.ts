/**
 * Memória resumida e determinística dos agentes da sociedade.
 * Não usa LLM; consome apenas eventos já emitidos pela simulação.
 * Serve de contexto para a Cowila estratégica e para a HUD.
 */

import type { WorldEvent } from '../contracts';

export interface AgentMemoryEntry {
  tick: number;
  kind: string;
  summary: string;
  sourceEventId: string;
}

export interface AgentMemoryBook {
  /** agentId → entradas mais recentes primeiro (máx. maxEntries). */
  byAgent: Record<string, AgentMemoryEntry[]>;
}

const DEFAULT_MAX_ENTRIES = 8;

function summarizeEvent(event: WorldEvent): { agentId: string; summary: string } | null {
  const p = event.payload as Record<string, unknown>;
  if (event.kind === 'task_completed' && typeof p.agentId === 'string') {
    const kind = typeof p.kind === 'string' ? p.kind : 'tarefa';
    return {
      agentId: p.agentId,
      summary: `Concluiu ${kind}.`,
    };
  }
  if (event.kind === 'agent_state_changed' && typeof p.agentId === 'string') {
    const status = typeof p.status === 'string' ? p.status : 'estado';
    return {
      agentId: p.agentId,
      summary: `Passou a ${status}.`,
    };
  }
  if (event.kind === 'project_started' && typeof p.engineerId === 'string') {
    const name = typeof p.name === 'string' ? p.name : 'projeto';
    return {
      agentId: p.engineerId,
      summary: `Iniciou projeto «${name}».`,
    };
  }
  if (event.kind === 'project_completed' && typeof p.builderId === 'string') {
    return {
      agentId: p.builderId,
      summary: 'Concluiu módulo de construção no terreno.',
    };
  }
  if (event.kind === 'wage_paid' && typeof p.agentId === 'string') {
    return {
      agentId: p.agentId,
      summary: 'Recebeu salário comunitário.',
    };
  }
  if (event.kind === 'trade_completed' && typeof p.merchantId === 'string') {
    return {
      agentId: p.merchantId,
      summary: 'Negociou no mercado comunitário.',
    };
  }
  return null;
}

/**
 * Atualiza o livro de memórias a partir dos eventos do snapshot.
 * Idempotente por sourceEventId; ordem estável.
 */
export function ingestEventsIntoMemory(
  book: AgentMemoryBook,
  events: readonly WorldEvent[],
  tick: number,
  maxEntries = DEFAULT_MAX_ENTRIES,
): AgentMemoryBook {
  const next: AgentMemoryBook = {
    byAgent: { ...book.byAgent },
  };
  for (const agentId of Object.keys(next.byAgent)) {
    next.byAgent[agentId] = [...(next.byAgent[agentId] ?? [])];
  }

  const seen = new Set<string>();
  for (const list of Object.values(next.byAgent)) {
    for (const entry of list) seen.add(entry.sourceEventId);
  }

  const sorted = [...events].sort((a, b) => a.id.localeCompare(b.id));
  for (const event of sorted) {
    if (seen.has(event.id)) continue;
    const parsed = summarizeEvent(event);
    if (!parsed) continue;
    seen.add(event.id);
    const list = next.byAgent[parsed.agentId] ? [...next.byAgent[parsed.agentId]] : [];
    list.unshift({
      tick,
      kind: event.kind,
      summary: parsed.summary,
      sourceEventId: event.id,
    });
    next.byAgent[parsed.agentId] = list.slice(0, maxEntries);
  }
  return next;
}

export function emptyAgentMemory(): AgentMemoryBook {
  return { byAgent: {} };
}

export function memoryForAgent(
  book: AgentMemoryBook,
  agentId: string,
): readonly AgentMemoryEntry[] {
  return book.byAgent[agentId] ?? [];
}

/** Texto curto para HUD ou prompt futuro da Cowila (sem rede). */
export function formatAgentMemoryBrief(
  book: AgentMemoryBook,
  agentId: string,
  limit = 3,
): string {
  const entries = memoryForAgent(book, agentId).slice(0, limit);
  if (entries.length === 0) return 'Sem histórico recente.';
  return entries.map((e) => `[t${e.tick}] ${e.summary}`).join(' ');
}
