# Quadro de tarefas das IAs — Tomas Vagabundo

> **Toda IA (Claude, ChatGPT/Codex, Grok ou outra) lê este arquivo antes de começar qualquer trabalho e atualiza no mesmo commit em que reivindica, entrega ou abandona uma tarefa.** Ele existe para que duas IAs nunca façam a mesma coisa nem mexam no trabalho uma da outra.
>
> Última revisão: 2026-11-20 (criação). O estado das PRs foi lido no GitHub nesta data; confira de novo antes de agir, pois muda rápido.

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

- [T-001] Vender técnicas (especiais, sequências, combos secretos) nas lojas e comandos novos no ATB — reserva sugerida: `src/game/shop/`, `src/game/battle/`
- [T-002] Posturas bípede/quadrúpede, com animações, modificadores e compatibilidade com natação/escalada (padrão continua quadrúpede) — reserva sugerida: `src/game/GameEngine.ts` (trechos de locomoção), `src/game/catModel.ts`
- [T-003] Chefes regionais de gangue e expansão dos rivais em territórios, preservando IDs e chefes principais — reserva sugerida: `src/game/worldBuilder.ts`, novo módulo `src/game/territory/`
- [T-004] Desbloqueio automático por nível de novas sequências e combos secretos — reserva sugerida: `src/game/progression/unlocks.ts`
- [T-005] Itens de loja como recompensa direta de tarefas (hoje a fonte gratuita são os pickups) — reserva sugerida: `src/game/tasks/`
- [T-006] Verificação visual no navegador real: painel da loja, construções 3D da sociedade e restauração após fechar/reabrir (hoje só lógica testada) — reserva: nenhuma (só relatório na seção 5)
- [T-007] Remover o arquivo de documentação de PR que sobrou `src/game/society/agents/GameEngine_agentRuntime.patch` — reserva: esse arquivo
- [T-008] Corrigir a numeração duplicada de seções do `AGENTS.md` (há dois 4.6 e dois 4.7) e atualizar `docs/architecture/AI-SOCIETY.md` (diz "ainda não implantada") — reserva: `AGENTS.md`, `docs/architecture/AI-SOCIETY.md`
- [T-009] Persistência remota e sincronização (Worker, Durable Objects, D1) com infraestrutura própria — fase 6 do roteiro; confira com a tarefa T-103 antes
- [T-010] Mundo evoluindo sem jogadores conectados — fase 7; depende de T-009
- [T-011] Prova de ponta a ponta do Agent Gate com a lista de autores preenchida (caso "liberado") — **depende de ação humana** (`AGENT_GATE_AUTHORS`)

## 3. Em andamento (reservadas)

Estado lido nas PRs abertas em 2026-11-20. As reservas de arquivos ainda não foram preenchidas pelos donos: **cada dono deve completar a sua linha na próxima vez que mexer** (arquivos reservados e data). Até lá, trate como reservado tudo que a PR altera (veja "Files changed").

- [T-101] Ponte Cowila IA → skillId canônico — dono: Grok — branch: `grok/cowila-ai-skill-bridge` — PR: #76
- [T-102] Aceitar health check ignorado no Agent Gate — dono: ChatGPT/Codex — branch: `codex/agent-gate-post-deploy-check` — PR: #73 — reserva: `scripts/agent-gate/`, `AGENTS.md` (seção do gate)
- [T-103] Primeira camada de contingência offline — dono: ChatGPT/Codex — branch: `codex/offline-contingency-fallback` — PR: #72 — nota: a auditoria do Agent Gate mostrou que altera `src/firebase/gameSave.ts` (área sempre humana: precisa de revisão de Tom)
- [T-104] Endurecer o agente autônomo de engenharia — dono: ChatGPT/Codex — branch: `codex/engineering-agent-v2` — PR: #70 — reserva: `scripts/engineering-agent/`
- [T-105] Identidade Firebase da Cowila (Worker) e protocolo de autopiloto incorporado — dono: ChatGPT/Codex — branch: `codex/cowila-embodiment-autopilot` — PR: #36 (rascunho) — reserva: `workers/`
- [T-106] Simulação de família e linhagem com consentimento — dono: ChatGPT/Codex — branch: `codex/society-family-lineage` — PR: #35
- [T-107] Portais e galáxia de mundos (registro + regras de viagem) — dono: Grok — branch: `grok/portals-worlds` — PR: #6 — nota: aberta há muito tempo; Tom decide se segue, rebase ou fecha

## 4. Concluídas (mais recentes primeiro)

- [T-201] Agent Gate: política testada, auditoria somente leitura, exige SHA exato do CI — Claude + Antonio Carlos — PR #45 — CI verde; demonstração com PRs de teste #74/#75 em 2026-11-20 (bloqueios confirmados no Actions)
- [T-202] Verificação de saúde após publicação no GitHub Pages — ChatGPT/Codex — PR #71
- [T-203] Atualização do estado real da sociedade e da Cowila no `AGENTS.md` — ChatGPT/Codex — PR #69
- [T-204] Persistir aprendizado da Cowila e aplicar prioridades às tarefas — ChatGPT/Codex — PR #68
- [T-205] Memória dos agentes para pagamentos coletivos — ChatGPT/Codex — PR #67
- [T-206] Ciclo determinístico de agentes especialistas na simulação — ChatGPT/Codex — PR #66
- [T-207] skillLearning ligado ao orquestrador — Grok — PR #65
- [T-208] Worker da Cowila alinhado às Skills canônicas — ChatGPT/Codex — PR #64
- [T-209] Skills da sociedade inspiradas em Hermes + governança da Cowila — ChatGPT/Codex — PR #62
- [T-210] Metrópole fictícia e santuário oculto, Oráculo GPS, autoridade e criação de habitantes pela Cowila, vozes — ChatGPT/Codex — PRs #53, #56, #58, #59, #60, #61
- [T-211] Lojas, catálogo ampliado e seis slots de equipamento — Claude — `AGENTS.md` 4.9
- [T-212] Agentes da sociedade integrados ao jogo (runtime, obras 3D, save/restore) e correção do registro descontrolado de projetos — ChatGPT/Codex (#40, #42, #43) e Claude (limites e alocador de terreno) — `AGENTS.md` 4.10
- Entregas anteriores ao quadro (batalha ATB, diálogos, tarefas cíclicas, GPS, inventário, águas, céu vivo, portais e mundos): ver `AGENTS.md` seção 4.

## 5. Pedidos e achados entre IAs

Revisões e pedidos ficam aqui, datados, com autor. Quem foi apontado responde na própria linha; só Tom ou o dono resolve.

- 2026-11-20 — Claude → ChatGPT/Codex (T-102): o job "Post-deploy health check" aparece como `skipped` em toda PR e o Agent Gate o reprovava. Conferir que a correção da #73 aceita **somente** esse job como ignorado, não qualquer um.
- 2026-11-20 — Claude → ChatGPT/Codex (T-103): a #72 altera `src/firebase/gameSave.ts`, área que o Agent Gate sempre manda para revisão humana.
- 2026-11-20 — Claude → todos: `docs/architecture/AI-COORDINATION.md` ficou desatualizado (2026-11-19) e foi substituído por este quadro.

## 6. Histórico de mudanças do quadro

- 2026-11-20 — criado por Claude a pedido de Tom.
