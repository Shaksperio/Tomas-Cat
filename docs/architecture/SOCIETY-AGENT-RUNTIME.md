# Society Agent Runtime

Ponto de entrada único para a camada de agentes no cliente.

## No GameEngine (ver `GameEngine_agentRuntime.patch`)

```ts
private readonly agentRuntimeRegistry = new WorldAgentRuntimeRegistry(PLAYABLE_WORLD_IDS, {
  cowilaEveryTicks: 25,
});
private get agentRuntime() {
  return this.agentRuntimeRegistry.runtimeFor(this.worldSceneManager.activeWorldId);
}

// no loop playing:
while (this.societyTickTimer >= 1) {
  const frame = this.agentRuntime.step(this.society, 1);
  if (frame.registeredProjectIds.length > 0 && frame.directive) {
    this.callbacks.onToast(frame.directive.brief, 'info');
  }
  this.societyTickTimer -= 1;
}
```

Ao resetar o mundo: `agentRuntimeRegistry.reset(activeWorldId)` junto com `societyRegistry.reset`.

## Fluxo

1. `simulation.step` (especialistas se PR #37 mergeada)
2. Memória ← eventos
3. A cada N ticks: Cowila estratégica
4. Blueprint validado → `WorldConstructionRuntime.registerProject` + cadeia real na fila da simulação
5. Scheduler executa coleta → carpintaria (quando necessária) → transporte → preparação → construção
6. Cada tarefa emite evento com `projectId`, `assetId` e etapa; só a próxima tarefa vinculada avança o projeto
7. Todos os módulos ficam prontos apenas quando todas as tarefas terminam; então `readyPlacements` → `SocietyActors` (integração visual da PR #38)

## Arquivos

| Módulo | Papel |
|--------|--------|
| `orchestrator.ts` | Rotinas por profissão |
| `agentMemory.ts` | Histórico resumido |
| `cowilaCoordinator.ts` | Estratégia / blueprints |
| `societyAgentRuntime.ts` | Cola por tick |
| `worldAgentRuntimeRegistry.ts` | Isolamento por mundo |
| `worldConstructionRuntime.ts` | Placements autorizados |

## Segurança

- Sem LLM
- Registrar blueprint não consome recursos; materiais são produzidos/consumidos pelas tarefas reais
- IDs determinísticos e dependências impedem duplicação e avanço fora de ordem
- A obra não fica pronta até todas as tarefas vinculadas concluírem no scheduler
- Um runtime por mundo (sem vazar memória/Cowila entre mundos)
