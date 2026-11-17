# Módulos de construção aprovados

## Arquivos
- `constructionCatalog.ts` — assetIds autorizados (abrigo, armazém, oficina, canteiro, torre, mercado, ponte, estrada)
- `moduleMeshFactory.ts` — meshes low-poly por assetId
- `SocietyActors_modules.patch` — alterações em `SocietyActors.ts`
- `worldConstructionRuntime.ts` (já na main) — emite placements quando o projeto completa

## Aplicar visual no SocietyActors

```bash
# Preferir aplicar manualmente o bloco documentado no patch
# (o arquivo SocietyActors é grande; evite sobrescrever por engano)
```

1. Importar `createModuleMesh`, `createModuleMeshForTask`, `isApprovedConstructionAsset`, `ReadyConstructionPlacement`.
2. Substituir a geometria inline de `build_module` por `createModuleMeshForTask(task.id)`.
3. Adicionar `applyReadyPlacements(placements)`.

## Ligar ao simulador (depois da PR #37)

No tick / após conclusões de tarefa:

```ts
const ready = constructionRuntime.getReadyPlacements();
if (ready.length) {
  societyActors.applyReadyPlacements(ready);
  for (const projectId of new Set(ready.map((p) => p.projectId))) {
    constructionRuntime.markProjectPublished(projectId);
  }
}
```

## Segurança
- Nenhum asset fora do catálogo é renderizado.
- Sem LLM, sem geometria generativa.
- Não colide com `simulation.ts` da PR #37.
