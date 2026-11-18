# Cowila estratégica e memória de agentes

## Estado

| Camada | Status |
|--------|--------|
| Especialistas (8 papéis) + orquestrador de rotina | Implementado |
| Propostas → fila de tarefas | PR #37 (scheduler) |
| Memória resumida por habitante | Este módulo (`agentMemory.ts`) |
| Cowila estratégica determinística | Este módulo (`cowilaCoordinator.ts`) |
| Cowila generativa (LLM) | **Não conectada** |
| Autopilot / embodiment | PR #36 (rascunho) |

## Princípios

1. A Cowila **não** controla cada frame nem move meshes diretamente.
2. Diretivas são tipadas: foco de recurso, prioridades de profissão, blueprints com **assetIds aprovados**.
3. Blueprints passam por `validateConstructionProject` antes de qualquer obra.
4. Memória é um anel determinístico de eventos já emitidos (sem rede).

## Integração futura (após PR #37)

```ts
let memory = emptyAgentMemory();
// a cada N ticks da sociedade:
const snap = simulation.snapshot();
memory = ingestEventsIntoMemory(memory, snap.events, snap.tick);
const directive = runCowilaStrategicCycle(snap, memory);
// HUD: directive.brief
// Se engenheiro ocioso e recursos ok → blueprintToProposedProject → runtime de construção
```

## Segurança

- Sem LLM, sem fetch, sem edição de save.
- Sem geometria inventada: só `COWILA_APPROVED_ASSETS`.
