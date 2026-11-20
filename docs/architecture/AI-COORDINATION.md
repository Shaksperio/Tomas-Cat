# Coordenação entre IAs — Tomas Vagabundo

**Atualizado:** 2026-11-20

> **Antes de editar:** listar PRs abertas. Não reimplementar nem apagar trabalho de Codex/Claude.

## Já na `main` (não refazer)

Skills Hermes (#62), Worker skill IDs (#64), skillLearning (#65), ciclo no `step` (#66), memória (#67), persistência learning (#68), AGENTS (#69).

## PRs abertas — donos

| PR | Quem | Área | Grok NÃO edita |
|----|------|------|----------------|
| **#74 / #75** | **Claude** | Testes Agent Gate (descartáveis) | `claude/gate-test-*` |
| **#73** | **Codex** | Agent Gate health check skipped | `scripts/agent-gate/**` |
| **#72** | **Codex** | Contingência offline Firestore | `src/game/offline/**`, `gameSave` |
| **#70** | **Codex** | Engineering agent Gemini | `scripts/engineering-agent/**` |
| **#35 / #36** | **Codex** | Família / embodiment | family, D1 identity |
| **#76** | **Grok** | Bridge Cowila IA → skillId | — |
| **#6** | **Grok** | Portais (base antiga; `portalWorlds` já na main) | revisar antes de reabrir |

## #76 — uso no GameEngine

```ts
import { applyCowilaAiDecision } from './society/agents/cowilaAiBridge';
// no then de requestCowilaDecision:
const result = applyCowilaAiDecision(targetSociety, decision);
if (result.accepted > 0) onToast(`Cowila IA: ${result.accepted}… ${result.brief}`, 'info');
```

## Regras

1. Uma IA não edita a coluna de PR alheia aberta.
2. Preferir módulo novo a patch em arquivo grande já tocado por outra PR.
3. Skills só em código versionado; determinismo: IA propõe, motor valida.
