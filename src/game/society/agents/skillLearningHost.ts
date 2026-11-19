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

  reset(): void {
    this.book = emptySkillLearning();
    this.seenEventIds = new Set();
  }
}
