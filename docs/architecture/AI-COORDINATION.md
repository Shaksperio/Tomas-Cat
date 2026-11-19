# Coordenação entre IAs — Tomas Vagabundo

**Atualizado:** 2026-11-19

## Estado recente

| Item | Estado |
|------|--------|
| **PR #62** Skills Hermes + orquestrador + Worker agentRuntime | **MERGEADA** na `main` |
| **PR #63** / `skillLearning` métricas isoladas | Aberta / supersedida pela wire |
| **Grok** `grok/skill-learning-wire` | Liga `skillPriorityBias` no orquestrador + módulo de métricas |

## Trabalho em aberto

| Área | Quem | PR / branch | Não editar |
|------|------|-------------|------------|
| Especialistas → fila + placas 3D | Codex | **#37** | `simulation.ts` scheduleSpecialistTasks |
| Construção 3D placements | Grok | **#38 / #41** | meshes / applyReadyPlacements |
| Agente engenharia Gemini | Codex | **#46** | `scripts/engineering-agent/` |
| Família NPC | Codex | **#35** | family |
| Embodiment / D1 | Codex (draft) | **#36** | identity Worker |
| Skill learning wire | Grok | `grok/skill-learning-wire` | — |

## Já na main (não reimplementar)

- `skills/` (catálogo Hermes-like)
- orquestrador com `selectSkillForAgent` + `skillId` nas propostas
- `agentMemory`, `cowilaCoordinator`, `SocietyAgentRuntime`
- Worker docs de governança Cowila/Hermes

## Regras

1. Não colidir com PRs abertas na tabela.
2. Skills versionadas em código; LLM não edita skills em produção.
3. Determinismo: IA propõe; motor valida.
