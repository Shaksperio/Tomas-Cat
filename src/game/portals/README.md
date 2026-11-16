# Portais e Galáxia de Mundos

## O que existe
- `../worlds/worldRegistry.ts` — catálogo de mundos, desbloqueio por flags
- `portalSystem.ts` — portais locais e entre mundos, estado runtime
- Testes determinísticos

## Flags previstas
- `tasks_world_hub_complete` — libera `world_flood` e o Portal do Canal
- `tasks_world_flood_complete` — libera `world_scrap`

## Integração futura (GameEngine)
1. Persistir `PortalRuntimeState` no save (`flags`, `currentWorldId`, `activatedIds`)
2. Spawnar meshes de portal nas `position` de `HUB_PORTALS`
3. Em proximidade + interação: `resolveTravel` → teleportar ou trocar mundo
4. UI da Galáxia: `listUnlockedWorlds(flags)`

Não colidir com PR #3 (diálogos) nem com a lógica ATB.
