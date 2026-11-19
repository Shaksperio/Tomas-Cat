# Aprendizado de skills (loop Hermes-like)

## Coordenação

| Trabalho | Dono | Branch / PR |
|----------|------|-------------|
| Catálogo de skills + orquestrador por skill + Worker Hermes | **Codex / ChatGPT** | `codex/hermes-inspired-agent-runtime` **PR #62** |
| Métricas de sucesso/falha e viés de prioridade | **Grok** | `grok/skill-learning-metrics` |
| Memória de eventos + Cowila estratégica + runtime | Já na `main` / PRs anteriores | `agentMemory`, `SocietyAgentRuntime` |

**Não editar** `skills/index.ts`, `orchestrator.ts` skill-based nem `workers/cowila-ai/` enquanto a PR #62 estiver aberta — isso é área do Codex.

## Este módulo

`skillLearning.ts` mantém contadores determinísticos por `skillKey`:

- sucesso ← `task_completed`
- falha ← `task_failed` / `resource_blocked` (quando existirem)
- chave preferencial: `payload.skillId` (PR #62); fallback: `task:${kind}`

`skillPriorityBias` devolve −10…+10 para o orquestrador/Cowila ponderarem propostas **sem** reescrever skills.

## Integração futura (após merge #62)

```ts
let learning = emptySkillLearning();
let seen = new Set<string>();
// a cada tick:
({ book: learning, seenEventIds: seen } = ingestEventsIntoSkillLearning(
  learning, snap.events, snap.tick, seen,
));
const bias = skillPriorityBias(learning, proposal.skillId ?? `task:${proposal.taskKind}`);
proposal.priority = clamp(proposal.priority + bias, 0, 100);
```

## O que isto **não** faz

- Não cria nem edita skills em runtime (skills continuam versionadas em código)
- Não chama LLM
- Não persiste sozinho no save (próximo passo opcional)
