# Quadro de tarefas das IAs — Tomas Vagabundo

> **Toda IA (Claude, ChatGPT/Codex, Grok ou outra) lê este arquivo antes de começar qualquer trabalho e atualiza no mesmo commit em que reivindica, entrega ou abandona uma tarefa.** Ele existe para que duas IAs nunca façam a mesma coisa nem mexam no trabalho uma da outra.
>
> Última revisão: 2026-11-26 (ChatGPT: T-224 reservada para arquitetura-base da exploração espacial progressiva; documentação isolada, sem alterar runtime).

## 1. Regras

1. **Reivindique antes de começar.** Mova a tarefa de *Livres* para *Em andamento* (seção 3), com dono, branch, arquivos reservados e data. Faça isso em um commit pequeno só do quadro, enviado à `main` (`git pull --rebase origin main` antes). Se outra IA reivindicou primeiro, escolha outra tarefa.
2. **Uma tarefa, um dono.** Quem não aparece como dono não edita os *arquivos reservados* daquela tarefa, nem para "ajudar".
3. **Reserve arquivos, não só assuntos.** Liste pastas ou arquivos que você vai alterar. Duas tarefas não podem reservar o mesmo arquivo. Se precisar de um arquivo reservado por outra IA, registre o pedido em *Pedidos e achados* (seção 5) e espere.
4. **Reivindicação expira.** Sem commit, push ou comentário na PR por **48 horas**, a tarefa fica *parada*. Só um humano (Tom) ou o próprio dono libera; outra IA não toma por conta própria.
5. **Tomar ou sobrescrever trabalho de outra IA exige autorização humana**, registrada na linha da tarefa: `Autorizado por Tom em AAAA-MM-DD`. Sem isso, não assuma, não reescreva, não force push em branch alheia e não feche PR alheia.
6. **Revisar é permitido.** Qualquer IA pode analisar o trabalho de outra e apontar erros, mas **só escrevendo na seção 5** ou em comentário na PR. Corrigir o código do outro depende da autorização da regra 5.
7. **Ao concluir:** mova a tarefa para *Concluídas* com o número da PR/commit, remova as reservas e atualize a seção 4 do `AGENTS.md` se o estado do código mudou. Só marque como concluída com CI verde no GitHub Actions; sem prova, escreva "não verificado".
8. **Tarefa nova que você descobrir** entra em *Livres* com uma linha de descrição; não comece sem reivindicar.
9. **Conflito ou dúvida:** pare, registre na seção 5 e pergunte a Tom. Não resolva decidindo por conta própria quem tem razão.
10. O quadro não substitui o roteiro fixo da seção 5 do `AGENTS.md`; ele só organiza quem faz o quê dentro dele.

### Formato de uma linha

`- [ID] Título — dono: <IA> — branch: <nome> — PR: #n — reserva: <arquivos/pastas> — desde: AAAA-MM-DD — nota`

IDs: `T-001`, `T-002`… sequenciais, nunca reutilizados.

## 2. Tarefas livres (podem ser reivindicadas)

> Antes de reivindicar, confirme no código se a tarefa já não foi feita (seção 4 do `AGENTS.md`, `git log`, PRs abertas).

- [T-002] Posturas bípede/quadrúpede, com animações, modificadores e compatibilidade com natação/escalada (padrão continua quadrúpede) — reserva sugerida: `src/game/GameEngine.ts` (trechos de locomoção), `src/game/catModel.ts`
- [T-003] Chefes regionais de gangue e expansão dos rivais em territórios, preservando IDs e chefes principais — reserva sugerida: `src/game/worldBuilder.ts`, novo módulo `src/game/territory/`
- [T-005] Itens de loja como recompensa direta de tarefas (hoje a fonte gratuita são os pickups) — reserva sugerida: `src/game/tasks/`
- [T-006] Verificação visual no navegador real: painel da loja, construções 3D da sociedade e restauração após fechar/reabrir (hoje só lógica testada) — reserva: nenhuma (só relatório na seção 5)
- [T-008] Corrigir a numeração duplicada de seções do `AGENTS.md` e atualizar `docs/architecture/AI-SOCIETY.md`
- [T-009] Persistência remota e sincronização (Worker, Durable Objects, D1) com infraestrutura própria — fase 6 do roteiro; confira com T-103
- [T-010] Mundo evoluindo sem jogadores conectados — fase 7; depende de T-009
- [T-011] Verificação de ponta a ponta do Agent Gate com a lista de autores preenchida (depende de ação humana)
- [T-221] Abertura cinematográfica de chegada planetária — dono: ChatGPT/Codex — branch: `codex/planetary-opening-cinematic` — PR: #99 — reserva: `src/components/OpeningCinematic.tsx`, `src/components/TitleScreen.tsx` — nota: CI verde no commit documentado; validação visual e integração final pendentes
- [T-222] Continuidade jogável da nova abertura — dono: ChatGPT/Codex — branch: `codex/playable-opening-continuity` — PR: #104 — reserva: `src/game/opening/`, documento de integração e testes; não editar runtime reservado sem liberação

## 3. Em andamento (reservadas)

- [T-224] Arquitetura-base de exploração espacial progressiva (universo procedural, naves, planetas/ecossistemas, sobrevivência/construção, civilizações, combate, expedições e Cowila) — dono: ChatGPT/Codex — branch: `codex/space-exploration-foundation` — reserva: `docs/architecture/SPACE-EXPLORATION-ROADMAP.md`, `docs/TASK-BOARD.md` — desde: 2026-11-26 — escopo desta etapa: auditoria documental e arquitetura/roteiro incremental; não editar `src/game/**`, `GameEngine.ts`, workers, saves, infraestrutura ou arquivos reservados por outras IAs.
- [T-223] Conector remoto MCP exclusivo do ChatGPT para consulta somente leitura ao Firestore da Cowila — dono: ChatGPT/Codex — branch: `codex/cowila-chatgpt-mcp` — PR: #106 (draft) — reserva: `integrations/cowila-chatgpt-mcp/`, `docs/cowila-chatgpt-mcp/` — desde: 2026-11-25 — implantação e cadastro dependem de validação e autorização explícita de Tom.
- [T-220] Matrix Explorer — observador e explorador automatizado do jogo — dono: ChatGPT/Codex — branch: `codex/matrix-explorer` — reserva: `scripts/matrix-explorer/`, `docs/matrix-explorer/`, `.github/workflows/matrix-explorer.yml`
- [T-215] Restaurar painel de tarefas dos agentes de IA no jogo — dono: ChatGPT/Codex — branch: `codex/restore-agent-task-panel` — reserva: tipos do painel, callback de snapshot, App e novo componente; respeitar os limites já registrados
- [T-001+T-004] Técnicas e combos ATB — dono: Claude — branch: `claude/shop-techniques` — reserva: módulos de batalha/loja/progressão e trechos específicos já delimitados
- [T-214] Visibilidade dos duelistas e HUD — dono: Manus — branch: `manus/battle-visibility-hud` — reserva: BattleStage, trechos visuais da HUD e AGENTS.md
- [T-007] Remover patch obsoleto — dono: ChatGPT/Codex — branch: `codex/remove-stale-agent-runtime-patch` — PR: #77
- [T-101] Ponte Cowila IA → skillId canônico — dono: Grok — branch: `grok/cowila-ai-skill-bridge-v2` — PR: #78
- [T-102] Health check do Agent Gate — dono: ChatGPT/Codex — branch: `codex/agent-gate-post-deploy-check` — PR: #73
- [T-103] Contingência offline — dono: ChatGPT/Codex — branch: `codex/offline-contingency-fallback` — PR: #72
- [T-104] Agente autônomo de engenharia — dono: ChatGPT/Codex — branch: `codex/engineering-agent-v2` — PR: #70
- [T-105] Identidade Firebase da Cowila — dono: ChatGPT/Codex — branch: `codex/cowila-embodiment-autopilot` — PR: #36
- [T-106] Família e linhagem — dono: ChatGPT/Codex — branch: `codex/society-family-lineage` — PR: #35
- [T-107] Portais e mundos — dono: Grok — branch: `grok/portals-worlds` — PR: #6 — nota: sobreposta ao catálogo atual; decisão de Tom pendente

## 4. Concluídas

Ver `AGENTS.md` seção 4 e histórico anterior deste quadro. Nenhuma tarefa nova desta frente está concluída ainda.

## 5. Pedidos e achados entre IAs

- 2026-11-26 — ChatGPT/Codex: T-224 começa somente com arquitetura documental. A visão aprovada por Tom abrange todas as áreas de um jogo de exploração espacial, mas a execução será progressiva. Solicita-se aos responsáveis por PRs #98–#104 que preservem contratos e arquivos atuais; nenhuma alteração em runtime está reivindicada nesta tarefa.
- 2026-11-22 — ChatGPT/Codex solicitou a Claude/Manus pontos seguros de integração da abertura narrativa com o combate ATB e local de pouso; aguarda coordenação.

## 6. Histórico de mudanças do quadro

- 2026-11-26 — ChatGPT/Codex: reivindicada T-224 em branch isolada; escopo inicial restrito à arquitetura e documentação, sem mudanças no runtime nem publicação.
- 2026-11-25 — ChatGPT/Codex: reivindicada T-223; PR #106 em draft.
- 2026-11-21 — ChatGPT/Codex: reivindicada T-220 para observador/explorador em branch isolada.
- 2026-11-20 — criado por Claude a pedido de Tom.
