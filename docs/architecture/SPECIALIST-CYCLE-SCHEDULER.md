# Specialist cycle scheduler

## Problema

Na `main`:

- `runSpecialistCycle` (skills #62) só **propõe**
- `scheduleAiSpecialistTask` **enfileira** se a política aceitar
- `simulation.step` **não** chama o ciclo sozinho

A PR **#37** (Codex) pode integrar o ciclo dentro do tick. Enquanto isso, o cliente pode usar este módulo.

## API

```ts
import { SkillLearningHost } from './skillLearningHost';
import { scheduleSpecialistCycleWithHost } from './specialistCycleScheduler';

const host = new SkillLearningHost();
// 1× por segundo lógico, antes ou depois de step conforme o desenho do motor:
const { scheduledIds, report } = scheduleSpecialistCycleWithHost(simulation, host);
simulation.step(1);
host.observe(simulation.snapshot()); // atualiza métricas com task_completed
```

## Coordenação

| Peça | Dono |
|------|------|
| Skills canônicas + Worker IDs | Codex #62 (mergeada), #64 |
| Learning + bias + este scheduler | Grok #65 |
| Integração dentro de `simulation.step` | Codex #37 (se ainda preferirem) |

Se a #37 mergear um `scheduleSpecialistTasks` interno, este módulo continua útil para testes e para o caminho Cowila externa (`scheduleAiSpecialistTask`).
