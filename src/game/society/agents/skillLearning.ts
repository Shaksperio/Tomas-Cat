/**
 * Loop de aprendizado determinístico para skills da sociedade.
 * Complementa o catálogo de skills da PR #62 (Codex): métricas + viés de prioridade.
 * Sem LLM; skills continuam versionadas em código.
 */

import type { WorldEvent } from '../contracts';

export interface SkillLearningStats {
  skillKey: string;
  successCount: number;
  failureCount: number;
  lastOutcomeTick: number;
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

export function skillSuccessRate(book: SkillLearningBook, skillKey: string): number {
  const stats = book.bySkill[skillKey];
  if (!stats) return 0.5;
  const total = stats.successCount + stats.failureCount;
  if (total === 0) return 0.5;
  return stats.successCount / total;
}

/** Ajuste de prioridade (−10 … +10). */
export function skillPriorityBias(book: SkillLearningBook, skillKey: string): number {
  const rate = skillSuccessRate(book, skillKey);
  if (rate >= 0.8) return 10;
  if (rate >= 0.6) return 5;
  if (rate <= 0.2) return -10;
  if (rate <= 0.4) return -5;
  return 0;
}

export function clampPriority(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Aplica viés de aprendizado à prioridade base de uma skill. */
export function applySkillLearningBias(
  basePriority: number,
  book: SkillLearningBook,
  skillKey: string,
): number {
  return clampPriority(basePriority + skillPriorityBias(book, skillKey));
}

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
    // A simulação atual ainda não emite eventos tipados de falha/bloqueio.
    // Falhas verificadas podem ser registradas explicitamente por recordSkillFailure;
    // não inferimos fracasso a partir de eventos genéricos de recursos ou estado.
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

/** Snapshot serializável para save (opcional). */
export function exportSkillLearning(book: SkillLearningBook): SkillLearningBook {
  const bySkill: Record<string, SkillLearningStats> = {};
  for (const key of Object.keys(book.bySkill).sort()) {
    const s = book.bySkill[key];
    bySkill[key] = {
      skillKey: s.skillKey,
      successCount: s.successCount,
      failureCount: s.failureCount,
      lastOutcomeTick: s.lastOutcomeTick,
      recentFailureReasons: [...s.recentFailureReasons],
    };
  }
  return { bySkill };
}
