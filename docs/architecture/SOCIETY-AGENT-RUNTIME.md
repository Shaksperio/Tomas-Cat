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
4. Blueprint acessível → `WorldConstructionRuntime.registerProject` (sem auto-completar)
5. `notifyConstructionTaskComplete` quando a obra terminar no scheduler
6. `readyPlacements` → `SocietyActors` (PR #38)

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
- Sem gastar recursos no registro do blueprint
- Sem marcar obra concluída sem `notifyConstructionTaskComplete`
- Um runtime por mundo (sem vazar memória/Cowila entre mundos)
