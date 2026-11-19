/**
 * Hospedeiro leve de métricas de skill — para o GameEngine / SocietyAgentRuntime
 * observarem eventos sem depender ainda de serialização no save.
 *
 * Uso sugerido (após merge desta PR + #64):
 *
 * ```ts
 * const host = new SkillLearningHost();
 * // a cada tick da sociedade:
 * const learning = host.observe(snapshot);
 * const report = runSpecialistCycle(snapshot, learning);
 * for (const p of report.proposals) simulation.scheduleAiSpecialistTask(p);
 * ```
 *
 * Compatível com IDs canônicos da PR #62/#64 (`engineer.survey-and-design`, etc.).
 */

import type { SocietySimulationSnapshot } from '../simulation';
import { listSocietySkills } from './skills';
import {
  emptySkillLearning,
  exportSkillLearning,
  ingestEventsIntoSkillLearning,
  type SkillLearningBook,
} from './skillLearning';

export interface SkillLearningHostState {
  schemaVersion: 1;
  book: SkillLearningBook;
  seenEventIds: string[];
}

export class SkillLearningHost {
  private book: SkillLearningBook = emptySkillLearning();
  private seenEventIds = new Set<string>();

  /** Atualiza métricas a partir dos eventos do snapshot; devolve o livro atual. */
  observe(snapshot: SocietySimulationSnapshot): SkillLearningBook {
    // O evento task_completed identifica o agente, mas não carrega skillId.
    // Resolve a habilidade canônica pela profissão do agente no snapshot para
    // que o viés do orquestrador use a mesma chave do catálogo de skills.
    const skillByProfession = new Map(
      listSocietySkills().map((skill) => [skill.profession, skill.id] as const),
    );
    const enrichedEvents = snapshot.events.map((event) => {
      if (event.kind !== 'task_completed') return event;
      const payload = event.payload as Record<string, unknown>;
      if (typeof payload.skillId === 'string' && payload.skillId.trim()) return event;
      const agentId = typeof payload.agentId === 'string' ? payload.agentId : null;
      const agent = agentId ? snapshot.agents.find((candidate) => candidate.id === agentId) : undefined;
      const skillId = agent ? skillByProfession.get(agent.profession) : undefined;
      if (!skillId) return event;
      return { ...event, payload: { ...payload, skillId } };
    });
    const result = ingestEventsIntoSkillLearning(
      this.book,
      enrichedEvents,
      snapshot.tick,
      this.seenEventIds,
    );
    this.book = result.book;
    this.seenEventIds = result.seenEventIds;
    return this.book;
  }

  getBook(): SkillLearningBook {
    return this.book;
  }

  /** Cópia serializável (save futuro). */
  exportBook(): SkillLearningBook {
    return exportSkillLearning(this.book);
  }

  importBook(book: SkillLearningBook): void {
    this.book = exportSkillLearning(book);
    this.seenEventIds = new Set();
  }

  exportState(): SkillLearningHostState {
    return {
      schemaVersion: 1,
      book: exportSkillLearning(this.book),
      seenEventIds: [...this.seenEventIds].sort(),
    };
  }

  restoreState(state: SkillLearningHostState): boolean {
    if (!state || state.schemaVersion !== 1
      || !state.book || typeof state.book.bySkill !== 'object'
      || state.book.bySkill === null || Array.isArray(state.book.bySkill)
      || !Array.isArray(state.seenEventIds)
      || state.seenEventIds.some((id) => typeof id !== 'string' || id.length === 0)
      || new Set(state.seenEventIds).size !== state.seenEventIds.length) return false;

    for (const [key, stats] of Object.entries(state.book.bySkill)) {
      if (!key || !stats || stats.skillKey !== key
        || !Number.isSafeInteger(stats.successCount) || stats.successCount < 0
        || !Number.isSafeInteger(stats.failureCount) || stats.failureCount < 0
        || !Number.isSafeInteger(stats.lastOutcomeTick) || stats.lastOutcomeTick < 0
        || !Array.isArray(stats.recentFailureReasons)
        || stats.recentFailureReasons.some((reason) => typeof reason !== 'string')) return false;
    }

    this.book = exportSkillLearning(state.book);
    this.seenEventIds = new Set(state.seenEventIds);
    return true;
  }

  reset(): void {
    this.book = emptySkillLearning();
    this.seenEventIds = new Set();
  }
}
