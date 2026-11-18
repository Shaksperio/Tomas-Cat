# Society Agent Runtime

Ponto de entrada único para a camada de agentes no cliente:

```ts
const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 25 });
const frame = runtime.step(simulation, 1);
// frame.directive?.brief → HUD
// frame.readyPlacements → SocietyActors.applyReadyPlacements (após PR #38)
// frame.memory → debug / diálogo
```

## Fluxo

1. `simulation.step` (inclui especialistas se PR #37 estiver mergeada)
2. Ingestão de eventos → memória
3. A cada N ticks: `runCowilaStrategicCycle`
4. Blueprints acessíveis e com recursos → `WorldConstructionRuntime.registerProject` (**sem** auto-completar tarefas)
5. Quando o scheduler concluir a tarefa de obra: `notifyConstructionTaskComplete`
6. `getReadyPlacements` → apresentação 3D → `markPlacementsPublished`

## Arquivos

| Módulo | Papel |
|--------|--------|
| `orchestrator.ts` | Rotinas por profissão |
| `agentMemory.ts` | Histórico resumido |
| `cowilaCoordinator.ts` | Estratégia / blueprints |
| `societyAgentRuntime.ts` | **Cola** entre os três e a construção |
| `worldConstructionRuntime.ts` | Placements autorizados |

## Segurança

- Sem LLM
- Sem gastar recursos no registro do blueprint (o consumo continua no scheduler de tarefas)
- Sem marcar obra como concluída sem `notifyConstructionTaskComplete`
