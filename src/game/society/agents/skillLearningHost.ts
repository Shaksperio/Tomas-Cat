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
    const result = ingestEventsIntoSkillLearning(
      this.book,
      snapshot.events,
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
