# Coordenação entre IAs — Tomas Vagabundo

**Atualizado:** 2026-11-19

## Estado recente

| Item | Estado |
|------|--------|
| **PR #62** Skills Hermes + orquestrador + skillId | **MERGEADA** |
| **PR #64** Codex — Worker com IDs canônicos de skills | **Aberta** |
| **PR #65** Grok — skillLearning + bias + SkillLearningHost | **Aberta** |
| **PR #63** métricas isoladas | Fechar em favor da #65 |
| **PR #37** especialistas → fila | Aberta (Codex) |

## Divisão (não colidir)

| Área | Quem | PR | Não editar |
|------|------|-----|------------|
| Worker skill IDs + bounds | **Codex** | **#64** | `workers/cowila-ai/**` |
| skillLearning + orchestrator bias + host | **Grok** | **#65** | `skillLearning*.ts` |
| scheduleSpecialist / placas | **Codex** | **#37** | trechos `simulation.ts` da PR |
| placements 3D | **Grok** | **#38/#41** | meshes |
| engineering agent | **Codex** | **#46** | `scripts/engineering-agent/` |

## Encaixe após #64 + #65

```ts
const host = new SkillLearningHost();
const learning = host.observe(simulation.snapshot());
const report = runSpecialistCycle(snapshot, learning);
for (const p of report.proposals) simulation.scheduleAiSpecialistTask(p);
```

## Regras

1. Grok não edita `workers/cowila-ai/` com #64 aberta.
2. Codex não reimplementa `skillLearning.ts`.
3. Skills só em código versionado.
4. Determinismo: IA propõe; motor valida.
