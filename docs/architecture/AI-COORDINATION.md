# Coordenação entre IAs — Tomas Vagabundo

**Atualizado:** 2026-11-20

## Já mergeado (não reimplementar)

| PR | Conteúdo |
|----|----------|
| #62–#69 | Skills Hermes, Worker IDs, skillLearning, ciclo no `step`, memória, persistência learning, AGENTS |

Na `main`: especialistas + learning no tick; Cowila IA a cada 25 ticks no GameEngine.

## Aberto

| Área | Quem | PR |
|------|------|-----|
| Agent Gate health check | Codex | #73 |
| Offline contingency | Codex | #72 |
| Engineering agent v2 | Codex | #70 |
| Família NPC | Codex | #35 |
| Embodiment / D1 | Codex draft | #36 |
| Portais | Grok | #6 |
| **Bridge Cowila IA → skillId** | **Grok** | `grok/cowila-ai-skill-bridge` |

## Gap desta branch

Propostas remotas no GameEngine iam **sem** `skillId`. `cowilaAiBridge.ts` alinha ao catálogo canônico antes de `scheduleAiSpecialistTask`. Ver `GameEngine_cowilaAiBridge.patch`.

## Regras

1. Não editar PRs abertas de outra IA.
2. Skills só em código versionado.
3. Determinismo: IA propõe; motor valida.
