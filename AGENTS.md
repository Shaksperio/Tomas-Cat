# AGENTS.md — Tomas Vagabundo (roteiro e guia para IAs)

> **Leia este arquivo primeiro.**
>
> Última atualização: 2026-11-15. Estado: `main` após batalha 1x1 + direção de arte.
> Quando mudar algo relevante, **atualize a seção 4 e a seção 5** no mesmo commit.

## 0. AVISO DE COORDENAÇÃO ENTRE IAs (ler antes de editar)

**Trabalho em paralelo ativo — não colidir.**

| Frente | Responsável / branch | Status | Arquivos / área |
|--------|----------------------|--------|-----------------|
| **Diálogos Fase 0** | Codex/ChatGPT — PR #3 `codex/dialogue-phase0` | **Em andamento** | `src/game/dialogue/**`, extensões de `types/game.ts`, testes do runner |
| **Céu vivo** | Grok — branch `grok/sky-atmosphere-v2` | **Em andamento** | `src/game/sky/**`, testes, `package.json` (script test). Integração no GameEngine: ver `src/game/sky/INTEGRATION.md` |
| Batalha cinematográfica (`BattleStage`) | Livre | Pendente | Só apresentação; **não** alterar `atb.ts` enquanto o PR de diálogos estiver aberto |
| Rios / lagos | Livre | Pendente | `survival/water.ts`, `worldBuilder.ts` |
| Portais / galáxia | Livre | Pendente | `src/game/portals/`, `src/game/worlds/` |

**Regras:** (1) Não editar área marcada "Em andamento". (2) Mudanças em `types/game.ts`/`AGENTS.md` só aditivas. (3) Branches nomeadas. (4) Após merge, atualizar esta tabela. (5) **Ignorar** a branch `grok/sky-atmosphere` (v1) — GameEngine foi corrompido por placeholder; usar só **v2**.

## 1–7

O restante do AGENTS.md (resumo, regras, estado atual, roteiro, mapa de arquivos, contexto do autor) permanece como na `main`. Esta atualização adiciona a **seção 0** e marca céu vivo + diálogos.

### Lacunas 4.4 (atualização)
- Lua/nuvens/aves: módulo `src/game/sky/` em progresso (lógica + SkyVisuals + testes). Integração GameEngine documentada em `INTEGRATION.md`.
- Diálogos estruturados: PR #3 — não reimplementar.
