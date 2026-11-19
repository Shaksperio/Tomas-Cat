# Coordenação entre IAs — Tomas Vagabundo

**Atualizado:** 2026-11-19  
**Leitura obrigatória** antes de editar agentes, Cowila, skills, construção 3D ou workers.

> Preferência: copiar a tabela abaixo para o topo de `AGENTS.md` (seção 0) quando for seguro editar o arquivo grande.

## Trabalho em aberto (não colidir)

| Área | Quem | Branch / PR | Não editar enquanto aberto |
|------|------|-------------|----------------------------|
| **Skills estilo Hermes** + seleção de skill no orquestrador + Worker `agentRuntime` (delegação 1 hop, auditoria) | **Codex / ChatGPT** | `codex/hermes-inspired-agent-runtime` **[PR #62](https://github.com/Shaksperio/Tomas-Cat/pull/62)** | `src/game/society/agents/skills/**`, mudanças skill-based em `orchestrator.ts` / `policies.ts`, `workers/cowila-ai/src/agentRuntime.ts` |
| **Aprendizado de skills** (métricas sucesso/falha, `skillPriorityBias`) | **Grok** | `grok/skill-learning-metrics` | `skillLearning.ts` |
| Especialistas → fila + atividade 3D | **Codex** | **[PR #37](https://github.com/Shaksperio/Tomas-Cat/pull/37)** | `simulation.ts` (`scheduleSpecialistTasks`) |
| Construção modular / placements 3D | **Grok** | **#38 / #41** | fábrica de meshes / `applyReadyPlacements` |
| Agente de engenharia Gemini | **Codex** | **#46** | `scripts/engineering-agent/` |
| Família / linhagem NPC | **Codex** | **#35** | family subsystem |
| Embodiment Cowila / D1 | **Codex** (draft) | **#36** | identity Worker |

## Já na `main` (não reimplementar)

- `agentMemory.ts`, `cowilaCoordinator.ts`, `SocietyAgentRuntime`, `WorldAgentRuntimeRegistry`
- Integração parcial no `GameEngine` (tick da sociedade + runtime)
- Catálogo de construção e persistência de obras (conforme commits recentes)

## Regras

1. Uma IA **não** edita a coluna "Não editar" de PR alheia aberta.
2. Preferir **módulo novo** + testes a patch em arquivo grande já tocado por outra PR.
3. Skills **versionadas em código**; LLM **não** instala nem edita skill em produção (diretriz PR #62).
4. Determinismo: IA só propõe; motor valida e executa.
5. Atualizar esta tabela no mesmo commit quando abrir ou fechar frente de trabalho.

## Ordem sugerida de merge (agentes)

1. PR **#37** (fila especialistas)  
2. PR **#62** (skills + Worker Hermes-inspired)  
3. **skill-learning** (Grok) — liga `skillPriorityBias` após #62  
4. **#41** (placements 3D) após runtime estável  
