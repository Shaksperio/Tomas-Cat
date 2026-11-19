/**
 * Cola determinística entre o catálogo de skills (PR #62), o learning (esta PR)
 * e a API pública `SocietySimulation.scheduleAiSpecialistTask` (já na main).
 *
 * Não modifica o interior de `simulation.step` — a PR #37 (Codex) pode ainda
 * integrar o ciclo dentro do tick; este módulo serve o GameEngine / testes
 * e evita duplicar lógica enquanto #37 estiver aberta.
 */

import type { SocietySimulation } from '../simulation';
import { runSpecialistCycle, type SpecialistCycleReport } from './orchestrator';
import {
  emptySkillLearning,
  type SkillLearningBook,
} from './skillLearning';
import type { SkillLearningHost } from './skillLearningHost';

export interface SpecialistScheduleResult {
  report: SpecialistCycleReport;
  scheduledIds: string[];
  skippedIds: string[];
}

/**
 * Roda um ciclo de propostas e tenta enfileirar cada proposta aceita.
 * Idempotente: `scheduleAiSpecialistTask` recusa proposalId já existente.
 */
export function scheduleSpecialistCycle(
  simulation: SocietySimulation,
  learning: SkillLearningBook = emptySkillLearning(),
): SpecialistScheduleResult {
  const snapshot = simulation.snapshot();
  const report = runSpecialistCycle(snapshot, learning);
  const scheduledIds: string[] = [];
  const skippedIds: string[] = [];

  for (const proposal of report.proposals) {
    const ok = simulation.scheduleAiSpecialistTask(proposal);
    if (ok) scheduledIds.push(proposal.proposalId);
    else skippedIds.push(proposal.proposalId);
  }

  return { report, scheduledIds, skippedIds };
}

/**
 * Observa o snapshot no host de learning e agenda o ciclo.
 * Uso típico no tick do GameEngine (1× por segundo lógico):
 *
 * ```ts
 * scheduleSpecialistCycleWithHost(simulation, learningHost);
 * simulation.step(1);
 * ```
 *
 * Observar **antes** do step usa o estado atual; após o step, o host
 * pode receber os eventos de conclusão no tick seguinte.
 */
export function scheduleSpecialistCycleWithHost(
  simulation: SocietySimulation,
  host: SkillLearningHost,
): SpecialistScheduleResult {
  const learning = host.observe(simulation.snapshot());
  return scheduleSpecialistCycle(simulation, learning);
}
