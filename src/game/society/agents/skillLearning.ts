/**
 * Loop de aprendizado determinístico para skills da sociedade.
 *
 * Inspirado no learning loop do Hermes Agent (métricas + priorização),
 * sem LLM e sem instalar/editar skills em runtime.
 *
 * Compatível com a PR #62 (Codex): quando `skillId` existir nas propostas,
 * registre sucesso/falha aqui. Antes do merge da #62, use o taskKind como chave.
 */

import type { WorldEvent } from '../contracts';

export interface SkillLearningStats {
  skillKey: string;
  successCount: number;
  failureCount: number;
  lastOutcomeTick: number;
  /** Motivos de falha recentes (máx. 5), estáveis para debug/HUD. */
  recentFailureReasons: readonly string[];
}

export interface SkillLearningBook {
  bySkill: Record<string, SkillLearningStats>;
}

const MAX_FAILURE_REASONS = 5;

export function emptySkillLearning(): SkillLearningBook {
  return { bySkill: {} };
}

function ensureStats(book: SkillLearningBook, skillKey: string): SkillLearningStats {
  const existing = book.bySkill[skillKey];
  if (existing) return existing;
  return {
    skillKey,
    successCount: 0,
    failureCount: 0,
    lastOutcomeTick: 0,
    recentFailureReasons: [],
  };
}

export function recordSkillSuccess(
  book: SkillLearningBook,
  skillKey: string,
  tick: number,
): SkillLearningBook {
  const prev = ensureStats(book, skillKey);
  return {
    bySkill: {
      ...book.bySkill,
      [skillKey]: {
        ...prev,
        successCount: prev.successCount + 1,
        lastOutcomeTick: tick,
      },
    },
  };
}

export function recordSkillFailure(
  book: SkillLearningBook,
  skillKey: string,
  tick: number,
  reason: string,
): SkillLearningBook {
  const prev = ensureStats(book, skillKey);
  const reasons = [reason, ...prev.recentFailureReasons].slice(0, MAX_FAILURE_REASONS);
  return {
    bySkill: {
      ...book.bySkill,
      [skillKey]: {
        ...prev,
        failureCount: prev.failureCount + 1,
        lastOutcomeTick: tick,
        recentFailureReasons: reasons,
      },
    },
  };
}

/** Taxa de sucesso 0–1; skills sem histórico retornam 0.5 (neutro). */
export function skillSuccessRate(book: SkillLearningBook, skillKey: string): number {
  const stats = book.bySkill[skillKey];
  if (!stats) return 0.5;
  const total = stats.successCount + stats.failureCount;
  if (total === 0) return 0.5;
  return stats.successCount / total;
}

/**
 * Ajuste de prioridade determinístico (−10 … +10) com base na taxa de sucesso.
 * Skills confiáveis sobem; skills que falham muito descem (sem banir).
 */
export function skillPriorityBias(book: SkillLearningBook, skillKey: string): number {
  const rate = skillSuccessRate(book, skillKey);
  if (rate >= 0.8) return 10;
  if (rate >= 0.6) return 5;
  if (rate <= 0.2) return -10;
  if (rate <= 0.4) return -5;
  return 0;
}

/**
 * Ingere eventos da simulação e atualiza métricas.
 * - task_completed → sucesso (chave: skillId do payload ou `task:${kind}`)
 * - task_failed / resource_blocked → falha, se o payload trouxer skillKey/kind
 */
export function ingestEventsIntoSkillLearning(
  book: SkillLearningBook,
  events: readonly WorldEvent[],
  tick: number,
  seenEventIds: Set<string> = new Set(),
): { book: SkillLearningBook; seenEventIds: Set<string> } {
  let next = book;
  const seen = new Set(seenEventIds);
  const sorted = [...events].sort((a, b) => a.id.localeCompare(b.id));

  for (const event of sorted) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const p = event.payload as Record<string, unknown>;
    const skillKey =
      typeof p.skillId === 'string' && p.skillId.trim()
        ? p.skillId
        : typeof p.kind === 'string'
          ? `task:${p.kind}`
          : null;
    if (!skillKey) continue;

    if (event.kind === 'task_completed') {
      next = recordSkillSuccess(next, skillKey, tick);
      continue;
    }
    if (event.kind === 'task_failed' || event.kind === 'resource_blocked') {
      const reason =
        typeof p.reason === 'string' && p.reason.trim()
          ? p.reason
          : event.kind === 'resource_blocked'
            ? 'Recurso insuficiente.'
            : 'Tarefa falhou.';
      next = recordSkillFailure(next, skillKey, tick, reason);
    }
  }

  if (seen.size > 500) {
    const keep = [...seen].sort().slice(-250);
    seen.clear();
    for (const id of keep) seen.add(id);
  }

  return { book: next, seenEventIds: seen };
}

export function listSkillLearningStats(
  book: SkillLearningBook,
): readonly SkillLearningStats[] {
  return Object.keys(book.bySkill)
    .sort()
    .map((key) => book.bySkill[key]);
}
