# AGENTS.md — Tomas Vagabundo (roteiro e guia para IAs)

> **Leia este arquivo primeiro.** Ele resume o que o jogo é, o que já existe no código, o que foi decidido pelo autor e o que falta fazer. Foi escrito para que qualquer IA (ChatGPT/Codex, Claude, Gemini, Cursor, Copilot, Google AI Studio etc.) entenda o projeto sem depender de conversas anteriores.
>
> Última atualização: 2026-11-16. Estado do código descrito: batalha ATB/cinematográfica, diálogos, missões cíclicas e GPS de missões publicados; inventário geral publicado; equipamentos em implementação.
> Quando mudar algo relevante, **atualize a seção 4 (estado atual) e a seção 5 (roteiro)** no mesmo commit.

## 1. Resumo do projeto

- **Nome:** Tomas Vagabundo (nome interno antigo: FELIS-09). O gato jogável se chama **Tomas Vagabundo**.
- **Repositório:** https://github.com/Shaksperio/Tomas-Cat — autor: Tom (Antonio), `Shaksperio`.
- **O que é:** jogo 3D de mundo aberto e sobrevivência, em terceira pessoa, com um gato abandonado numa metrópole devastada. Roda no navegador. **Diretriz de mundo (2026-11-17): Tomas Vagabundo será um mundo do tipo Matrix**: uma realidade simulada persistente, formada por ambientes e sociedades autônomas com regras consistentes. O termo descreve a ambição de simulação e autonomia; não autoriza copiar personagens, estética, narrativa, símbolos ou elementos protegidos da franquia Matrix.
- **Stack:** React 19, TypeScript, Three.js, Vite, Tailwind CSS 4. Sem engine externa.
- **Publicação:** GitHub Pages, https://shaksperio.github.io/Tomas-Cat/ (base `/Tomas-Cat/` em `vite.config.ts`). Deploy automático a cada push na `main`, pelo workflow `.github/workflows/deploy-pages.yml`.
- **Origem:** criado no Google AI Studio; versionado aqui. Mantenha a configuração do Vite e o workflow ao sincronizar.
- **Idioma:** textos de interface e comunicação com o autor em **português do Brasil**.
- **CI de pull requests:** o workflow `deploy-pages.yml` valida testes, TypeScript e build em PRs; publicação no Pages ocorre apenas em `push` para `main` ou execução manual.

## 2. Regras para qualquer IA que mexer no projeto

1. **Evolua, não substitua.** Preserve React, TypeScript, Three.js e Vite, e os sistemas atuais (movimento, câmera, combate, sobrevivência, clima, abrigos, fases, chefes, progressão). O jogo atual deve continuar jogável em todos os commits.
2. **Módulos independentes.** Novos sistemas entram como módulos (ex.: `src/game/society/`), sem converter os predadores atuais em agentes sociais.
3. **Determinismo.** Simulação, economia, tarefas, necessidades, conflitos e eventos usam lógica TypeScript previsível e testável. **IA generativa não controla movimentos nem decide cada frame.** A Cowila (IA estratégica) só propõe e coordena; regras determinísticas validam tudo antes de executar.
4. **Não afirme sucesso sem prova.** Só diga que testes, build ou deploy passaram se a execução do GitHub Actions estiver verde. Se não puder verificar, diga que não verificou.
5. **Servidor autoritativo (quando existir).** Clientes não declaram construções concluídas, recursos, relações ou resultados de combate.
6. **Infraestrutura própria.** O backend do Tomas (Cloudflare Worker, Durable Objects, D1, Cron Triggers) deve ter recursos próprios. **Não reutilizar** os bancos de dados do Shakstory nem do Guardião/Cowila.
7. **Desempenho móvel.** Simular em detalhe só a região próxima aos jogadores; o resto em passos abstratos.
8. **IA degradável.** Se o provedor de IA cair, a sociedade continua com rotinas locais determinísticas.
9. **Sem violência gratuita nem discriminação.** Rivalidade e conflito existem, mas por personalidade e ações individuais, nunca por espécie ou aparência. Brigas estilizadas, sem ferimentos gráficos; mediação e reconciliação são caminhos válidos.
10. **Transparência.** Segredos de mundo podem existir; regras de segurança, probabilidades relevantes e critérios de reconhecimento dos jogadores não podem ser escondidos.
11. **Não refaça o que já funciona.** Verifique a seção 4 antes de reimplementar algo.
12. **O roteiro da seção 5 é fixo.** O autor decidiu seguir este roteiro sem alterações; ele só será reavaliado depois que o jogo estiver concluído e tiver sido jogado. Não proponha cortar, trocar ou reordenar fases por conta própria; implemente o que está descrito.

## 3. Como executar e verificar

```bash
npm install          # o repositório tem bun.lock, não package-lock.json; o workflow usa npm install
npm run dev          # servidor local na porta 3000
npm test             # tsx --test: society, survival, dayCycle e battle
npm run lint         # tsc --noEmit
npm run build        # gera dist/
```

O workflow roda, nesta ordem: instalação, `npm test`, `npm run lint`, `npm run build`, publicação no Pages. Em `Settings → Pages`, a fonte deve ser **GitHub Actions**.

## 4. Estado atual do código (o que existe)

### 4.1 Jogo base (`src/game/`, `src/components/`)
- `GameEngine.ts`: laço principal, física, câmera, combate, sobrevivência, clima, progressão e salvamento. O save local agora é particionado por UID Firebase (`felis09_save_v4_{uid}`); o documento remoto do personagem fica em `users/{uid}/gameSaves/main`.
- `worldBuilder.ts`: cidade pré-construída (limite do mundo `WORLD_BOUNDS = 220`), 4 distritos, 6 abrigos, prédios ocos acessíveis (`addAccessibleBuilding`), colisores, gates de fase, terminais de lore.
- `catModel.ts`, `enemyModels.ts`, `textures.ts`, `audio.ts`: modelos, texturas e áudio procedurais (sem arquivos de asset).
- `GameHUD.tsx`, `TitleScreen.tsx`, `App.tsx`: interface em React.
- **Progressão:** níveis 1–99, 4 estágios de evolução do gato, 5 chances, checkpoints após cada chefe. A barra existente (`starProgress`, XP até a próxima estrela) continua sendo a fonte única de XP; `src/game/progression/unlocks.ts` define técnicas liberadas automaticamente por nível. Os IDs liberados são persistidos opcionalmente em `SavedGameState.unlockedMoves`; saves v4 antigos são migrados em memória usando o nível atual. A HUD mostra as técnicas aprendidas sem substituir o painel de evolução.
- **Fases e chefes:** 1 Subúrbio (Rei Rato Gigante), 2 Telhados (Gato Cicatriz), 3 Hospital (Cão Alfa Cibernético), 4 Estádio (Leão Apex).
- **Sobrevivência:** vida, fome, sede, calor, energia/resistência e oxigênio real (consome com a cabeça submersa, recupera na superfície, afogamento a 0; ver `src/game/survival/water.ts`). Fome, sede e exaustão reduzem mobilidade e a desidratação/fome extremas reduzem a recuperação de resistência. Interações: comida, presas, pesca renovável, água, abrigo, sucata, terminais.
- **Ciclo do dia:** 7 períodos (Madrugada 0–5h, Alvorecer 5–7, Manhã 7–11, Dia 11–16, Tarde 16–18, Anoitecer 18–20, Noite 20–24), definidos em `src/game/dayCycle.ts` (puro, testado) e usados pela HUD e pelo motor. Cada período tem cor de céu/névoa própria (keyframes `SKY_KEYFRAMES`) e o sol esquenta de cor perto do horizonte.
- **Lua:** da Noite (20h) até o fim da Madrugada (5h) aparece uma lua com luz própria; o modo "força lunar" dá 1,65× de dano e 1,22× de salto, e o gato mia ao ativar.
- **Clima:** chuva, neve, vento gelado, frio congelante e chuva ácida, em ciclo, com partículas, neblina e perda de calor.
- **Abrigos climáticos:** prédios ocos (`indoorZones`) e abrigos protegem do clima; a câmera não atravessa as paredes por dentro.
- **Extras:** o gato dorme abrigado à noite e se lambe parado; gatos amigos Mingau e Canela.
- Exposição do renderizador e luzes foram aumentadas para o jogo não ficar escuro demais.

- **Água, natação e mergulho:** `src/game/survival/water.ts` (lógica pura, com testes em `water.test.ts`). Tomas tem animação própria de nado com remadas alternadas das quatro patas; bolhas subaquáticas usam partículas reutilizadas e efeito sonoro procedural com controle de mute. A animação de nado é integrada ao estado real de água do motor. As 8 poças viraram bacias reais (o chão tem buracos; parede, fundo e superfície rebaixada em y = −0,3). Tomas cai na bacia, flutua com a cabeça fora; **Espaço** sobe, **Shift** (ou botão de sprint) mergulha. Velocidade cai na água; oxigênio dura ~28 s submerso, recupera a 45/s na superfície e a 0 causa afogamento (9 de vida/s). Debaixo d'água a névoa fica azul-esverdeada. Saindo da bacia, o gato sobe suavemente à calçada.
- **Direção de arte (2026-11-15):** aventura 3D clássica low-poly (inspiração de ESTILO: aventuras 3D de 32/64 bits; combate em turnos com barra ATB). Relva estilizada no chão, estradas de terra, fachadas de reboco com vigas de madeira, skyline pastel facetado, céu saturado por período (`SKY_KEYFRAMES`), resolução levemente suave. `src/game/style/artDirection.ts` (paleta, RNG determinístico, posicionamento testado) e `vegetation.ts` (árvores, arbustos, flores, pedras e 4 santuários de pedra, tudo instanciado). **REGRA DE ORIGINALIDADE:** nunca copiar mapas, personagens, nomes, texturas, modelos, músicas ou cenários de outros jogos; só linguagem visual geral. Verificado por capturas headless (dia e tarde).
- **Iluminação (ajuste de 2026-11-14):** o escuro vinha das texturas de asfalto e fachadas, quase pretas; foram clareadas, junto com as estradas e o piso ambiente noturno (hemisfério 1,55+). Verificado renderizando o GameEngine headless (manhã, meio-dia, noite).

- **Modo batalha 1x1 (cinematográfico, estilo RPG por turnos com barra ATB):** regras de aposta em `src/game/battle/duel.ts`; combate por turnos em `src/game/battle/atb.ts` (puro, determinístico, testado); cena 3D em `src/game/battle/BattleStage.ts` (só apresentação). **B** (ou botão "Desafiar") convida o habitante mais próximo (até 7 m); os dois apostam o mesmo valor: moedas, sucata, energia vital ou oxigênio. Ao aceitar, o mundo congela e entra a cena cinematográfica já descrita. Comandos: **Arranhar**, **Garra Furiosa**, **Defender**, **Especial: Garra Meteoro**, **Ração energética** (I), **Orbe Arcano** (tecla 8, 25 MP), **Rasante Duplo** (nível 25, tecla 6, 35 MP) e **Tempestade de Garras** (nível 55, tecla 7, 70 MP). Quando Tomas fica pronto, há 10 segundos para escolher; o contador aparece na HUD e, se expirar, ele defende automaticamente. A câmera cinematográfica enquadra dinamicamente todos os duelistas, considerando o grupo, as investidas e a proporção da tela para não cortar os personagens. Cada coleta de comida, peixe ou presa concede uma ração gratuita; uma ração recupera até 28 pontos de vigor, limitada a 100, consome um turno ATB e não enche maná. Inventário e consumo são persistidos. Os combos `combo_a`/Rasante Duplo e `combo_b`/Tempestade de Garras estão implementados e desbloqueiam nos níveis 25 e 55; custam 35 e 70 MP, respectivamente, consomem o turno e usam sequências cinematográficas próprias. O ATB só avança quando ninguém está agindo (modo espera). Regras de aposta, limites de segurança e resolução permanecem em `duel.ts`.

### 4.2 Sociedade artificial (`src/game/society/`) — simulação local
- `contracts.ts`: tipos `SocietyAgent`, `AgentTask`, `ConstructionProject`, `WorldEvent` (com chave de idempotência), 8 profissões (`engineer`, `worker`, `agent`, `farmer`, `lumberjack`, `miner`, `carpenter`, `merchant`), validações.
- `simulation.ts`: `SocietySimulation`, determinística, em ticks lógicos (1 por segundo no jogo, avanço limitado por chamada). 9 habitantes: Íris (engenheira), Tico e Nina (operários), Bento (agente), Amora (agricultora), Cedro (lenhador), Brita (mineira), Serafim (carpinteiro) e Mercê (mercadora). Cada profissão tem um local de trabalho fixo (`WORKPLACES`), ao redor do qual sorteia os alvos das tarefas.
  - Necessidades (fome, convivência, moral), descanso, deslocamento até o local de trabalho.
  - Cadeia engenheiro → operário → construção, com custos.
  - Recursos comunitários: comida, madeira, pedra, tábuas e moedas, com capacidade máxima de armazém (60 por recurso; moedas até 999).
  - Produção: agricultura (cultivo e colheita), lenhador (+6 madeira), mineiro (+4 pedra), carpinteiro (3 madeira → 2 tábuas; nunca usa os 4 de madeira reservados à construção).
  - Consumo: refeições comunitárias (1 comida por habitante a cada 40 ticks), lenha (1 madeira a cada 60) e manutenção (1 tábua a cada 120); necessidade não atendida reduz o moral de todos.
  - Comércio: a mercadora vende o excedente acima do estoque-alvo (comida 20, madeira 12, pedra 8, tábuas 6) por moedas e compra comida quando ela fica abaixo de 8.
  - Salários: a cada 100 ticks o cofre paga quem concluiu trabalho no período (engenheiro 6, agente 5, carpinteiro 5, mercadora 5, demais 4) para a carteira (`wallet`) do habitante; sem moedas, o salário não é pago e o moral cai. Evento `wage_paid`.
  - Tarefas concluídas são arquivadas após 200 ticks, para o estado não crescer sem limite.
  - Relações (confiança e afinidade, limite 100), interações sociais e eventos.
- `SocietyActors.ts`: personagens 3D, placas de nome, indicadores de estado, balões de conversa, plantação 3D (3 fileiras de 12 plantas) e armazém comunitário com estoque visual.\n- `worldSocietyRegistry.ts`: registro em memória que mantém uma `SocietySimulation` independente por `worldId`; avançar um mundo não altera os ticks, habitantes, tarefas ou recursos de outro. Ainda não persiste, não executa mundos em background e não está conectado ao `GameEngine` ou `WorldSceneManager`.
- Testes: `contracts.test.ts` e `simulation.test.ts`.
- Documento de arquitetura: `docs/architecture/AI-SOCIETY.md` (parte dele está desatualizada: diz "ainda não implantada").

- **Diálogos locais (branch `codex/dialogue-phase0`, PR #3):** `src/game/dialogue/` contém contratos, dados escritos e runner puro para os nove habitantes, com nove nós por habitante (saudação, clima, pedido de ajuda, moral baixa e ramificações contextuais). A interação por proximidade abre uma janela clássica na HUD (inclusive durante a pausa do motor); opções condicionais verificam ferimento do jogador, noite, território conquistado, chuva ácida e flags de encontros anteriores. As nove falas contextuais por habitante têm testes de coerência textual. Afinidade, confiança, flags e IDs de pedidos aceitos são salvos em campos opcionais retrocompatíveis. A condição `night` usa o relógio normalizado do motor (0–1). **Tarefas dos diálogos (incremento atual):** `src/game/tasks/playerTasks.ts` define nove pedidos concretos, um por habitante, com objetivos ligados a eventos reais do jogo (coleta de comida/água/sucata, derrotar inimigos e melhorar abrigos). `GameEngine` aceita pedidos uma única vez, avança progresso pelos eventos, conclui automaticamente e concede XP pela barra de progressão existente + sucata como recompensa. O estado ativo/concluído é salvo em `SavedGameState.playerTasks`, opcional para compatibilidade retroativa; a HUD mostra progresso e conclusão. Testes puros cobrem catálogo, aceitação idempotente, avanço por evento, conclusão única e entradas inválidas. **Limitações restantes:** não há objetivos em múltiplas etapas, marcadores/rotas para tarefas, nem testes dedicados de integração do motor/HUD. A conversa ativa não é retomada após recarregar o save.
- `src/game/battle/commands.ts` descreve metadados cinematográficos da ração e dos dois combos; `atb.ts` executa item, Rasante Duplo e Tempestade de Garras com custos de turno/maná e desbloqueio por nível. Campos opcionais de diálogo, comandos e inventário mantêm compatibilidade com saves antigos.

### 4.3 Diretriz Matrix — realidade simulada\n- O mundo deve comportar-se como uma realidade coerente, não como um cenário que só reage ao jogador. Habitantes e sistemas têm rotinas, necessidades, relações, economia, memória de eventos, governança e consequências verificáveis.\n- Camadas-alvo: mundo físico (regiões, clima, construções e recursos); sociedade (habitantes, profissões, relações e tarefas); economia (produção, estoque, comércio e salários); governança (regras, conflitos, proteção e justiça); memória (eventos e estado persistente); interface/percepção (o que o jogador observa, descobre e pode influenciar).\n- Cada mundo precisa de identidade, relógio lógico, estado e sociedade isolados. Portais conectam mundos sem misturar inventários, habitantes ou eventos por acidente.\n- O jogador participa da realidade; sua ausência não deve congelar o mundo quando a simulação de background for implantada. Para desempenho móvel, regiões distantes usam passos abstratos e determinísticos.\n- A IA Cowila poderá aconselhar, investigar e propor mudanças; apenas regras determinísticas e serviços autoritativos podem confirmar efeitos no mundo.\n- O `WorldSocietyRegistry` atual é somente uma base local em memória. Não representa ainda persistência, execução autônoma fora da sessão, multiplayer, consciência real dos agentes ou integração com a cena 3D.\n\n### 4.4 O que NÃO existe ainda
Portais físicos e transição jogável entre mundos; carregamento de cenas independentes por worldId; snapshots completos por mundo; Galáxia visual. Backend autoritativo para validar transações e anti-cheat; a sociedade ainda não entra no salvamento; mundo que evolui sem jogador; Cowila integrada; multiplayer; preços dinâmicos; organizações, gangues, lei e justiça; catástrofes e alertas; colapso e Era Selvagem; caça, barracas e predadores por bioma; piloto automático; eras; brasões e distinções de jogadores; multiverso.

### 4.5 Lacunas de jogabilidade conhecidas
- Sol (disco) e estrelas existem (estrelas à noite com tempo limpo), mas a lua ainda é uma esfera simples e não há nuvens nem fases lunares.
- Duelos: só contra habitantes da sociedade local (sem multiplayer); habitantes não desafiam o jogador por conta própria; os modelos dos habitantes não têm esqueleto (golpes do oponente são investidas e recuos do corpo inteiro) e os sons da batalha reaproveitam sons existentes.
- Natação/mergulho existem nas 8 bacias de água (profundidade 1,0–3,4 m), mas faltam predadores aquáticos, animação de nado própria no modelo do gato, bolhas/sons e água em escala de lago/rio.
- Só os prédios protegem do clima; os abrigos ao ar livre não têm cobertura (marquises).
- A pesca está funcional como coleta renovável, mas ainda não há animação de nado própria para o gato, bolhas/sons, predadores aquáticos nem água em escala de lago/rio.

### 4.6 Tarefas cíclicas (incremento em desenvolvimento — branch `codex/task-cycles-600s`)
- `src/game/tasks/taskCycles.ts` implementa geração determinística em ciclos de 600 segundos de jogo ativo, objetivos em duas ou três etapas, progresso por eventos reais (comida, água, sucata e inimigos), histórico de modelos emitidos para impedir repetição e recompensas de XP/sucata.
- O motor avança o relógio somente em `updateGameplay`, portanto pausa, tela de título e batalha não contam como tempo ativo. O estado é salvo em `SavedGameState.taskCycle`; saves antigos recebem estado inicial compatível.
- A HUD exibe até três missões ativas e o tempo estimado até o próximo ciclo. Os pedidos dos nove habitantes permanecem separados e preservados. O sistema de recompensas físicas está em implementação na branch `codex/physical-task-rewards`: sucata da missão é criada como pickup próximo a Tomas e persiste em `SavedGameState.taskRewardDrops` até a coleta.
- **Tarefas e navegação publicadas:** ciclos de 600 segundos ativos, objetivos em múltiplas etapas, histórico anti-repetição, persistência local, recompensas XP/sucata e HUD. `taskNavigation.ts` seleciona alvo válido; `gridRoute.ts` calcula A* em grade de 4 m que contorna colisores terrestres, com margem conservadora. A HUD mostra direção/distância e o motor desenha a rota. Alvos elevados usam orientação direta (navegação vertical ainda não modelada); sem caminho terrestre a linha fica oculta. Waypoints manuais e navegação entre distritos continuam pendentes.




### 4.7 Conta Google e salvamento protegido (integração em código; configuração externa pendente)

- `src/firebase/client.ts` inicializa Firebase Authentication/Firestore usando somente variáveis `VITE_FIREBASE_*` de build. `LoginScreen.tsx` bloqueia a montagem do jogo até existir sessão Google válida.
- O UID autenticado é passado ao `GameEngine`; cada cópia local usa chave exclusiva por UID. Não existe modo anônimo nem fallback para jogar sem autenticação.
- `src/firebase/gameSave.ts` carrega e sincroniza `SavedGameState` em `users/{uid}/gameSaves/main`, com fila de escrita curta para agrupar salvamentos frequentes.
- `firestore.rules` permite acesso somente ao proprietário (`request.auth.uid == userId`) e bloqueia todos os outros caminhos. `docs/FIREBASE-AUTH.md` descreve criação do projeto, secrets, domínios autorizados e publicação das regras.
- O save legado sem proprietário pode ser migrado uma única vez pela primeira conta autenticada no navegador; após gravação local no espaço da conta, a chave antiga é removida. Não compartilhe a mesma cópia local entre UIDs.
- **Configuração ainda necessária antes de publicar/usar:** criar projeto Firebase próprio para Tomas, habilitar Google Authentication, criar Firestore, publicar as regras e cadastrar os secrets `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` e `VITE_FIREBASE_APP_ID` no GitHub Actions. O build sem essas variáveis mantém o login bloqueado intencionalmente.
- **Limite de segurança:** Auth + Firestore Rules protegem a identidade e a propriedade/acesso aos saves, mas o cliente ainda calcula XP, moedas e combate. Anti-cheat forte requer backend autoritativo e validação de transações.

- **HUD sem botões duplicados (2026-11-16):** em dispositivos de toque, o painel inferior de habilidades mostra apenas Sonar e Diários; Azunhar, Miar e Desafiar/Duelo ficam só nos botões de ação do canto. No desktop o painel continua completo, com as teclas indicadas.
- **Ações durante o movimento (2026-11-16):** os botões de toque (Azunhar, Miar, Duelo, Correr, Pular e Sonar) disparam em `pointerdown` (helper `instantPress` em `GameHUD.tsx`). Com o dedo no joystick, o segundo toque não gerava `click`, e o gato não pulava nem atacava enquanto andava. Não verificado em aparelho real.
- **Banco Firestore nomeado (2026-11-16):** `client.ts` lê `VITE_FIREBASE_DATABASE_ID`; o workflow agora injeta essa variável (secret ou, na falta dele, o ID `ai-studio-780f41f1-7f4e-40c2-91b7-1ac37ba9bac6`). Sem ela o app consultava o banco `(default)` e a leitura do save dava timeout. As regras de `firestore.rules` precisam estar publicadas nesse banco.
- **Proteção do progresso (2026-11-16):** `saveGame` não grava na tela de título (antes, o `pagehide` gravava um personagem de nível 1 no Firestore e ele vencia o save antigo). `src/game/saves/saveSelection.ts` escolhe o save mais avançado entre nuvem, cópia local, save legado e backup (`felis09_save_v4_backup`); o save legado nunca é apagado sem backup, e "Novo jogo" arquiva o save existente. Testes em `saveSelection.test.ts`. O Firestore guarda só a última versão do documento; sem histórico, não há como restaurar o que foi sobrescrito lá.
- **Conversas discretas (2026-11-17):** o painel de conversa deixou de ocupar a tela: é um balão pequeno ancorado acima da cabeça do habitante (`dialogueAnchor` no `HudSnapshot`, projetado pela câmera). A conversa só abre quando o jogador toca/clica no habitante (`pickResidentAt`, tolerância de 56 px, alcance de 9 m; mais longe, aparece aviso para se aproximar). Removidos o aviso "[E] Conversar" por proximidade e os balões sociais automáticos entre habitantes. O habitante continua visível durante a conversa. Não verificado em aparelho real.
- **Cartões da HUD móveis (2026-11-17):** `src/components/DraggablePanel.tsx` envolve Tarefas, Status, Radar e Mochila com uma alça (⠿) para arrastar; duplo toque na alça devolve ao lugar, o cartão arrastado fica por cima dos outros, a posição é lembrada em `localStorage` (`tomas_hud_pos_v1_*`) e é mantida visível ao redimensionar. O painel de tarefas ficou estreito (`min(56vw,15rem)`, não alcança a coluna da mochila), começa recolhido e rola internamente quando expandido. Não verificado em aparelho real.
- **Correção do loop de login (2026-11-16):** `client.ts` usa `initializeAuth` com cascata de persistência (IndexedDB → localStorage → sessionStorage → memória) e `browserPopupRedirectResolver`. O login usa `signInWithPopup`; `signInWithRedirect` só é fallback automático fora de iframe com `auth/popup-blocked`. Erros de popup sempre aparecem na tela e, em iframe, há link "Abrir em nova aba". O usuário autenticado é aplicado ao estado logo após o popup e `getRedirectResult` é aguardado antes de `onAuthStateChanged`. `accountReady` só é reiniciado quando o UID muda (refs `currentUidRef`/`loadedAccountUidRef`), pois a renovação de token reemitia o evento e desmontava o jogo. `firestore.rules` usa `allow get` para o dono. Layout: `App.tsx` tem cabeçalho estrutural (foto, nome, Sair) e a área do jogo `relative`; `GameCanvas`, `TitleScreen` e `GameHUD` usam `absolute` em vez de `fixed`. Não verificado em navegador real nem no Actions; as regras precisam ser republicadas no Firebase.

### 4.6 Inventário geral (incremento em desenvolvimento — branch `codex/general-item-inventory`)
- `src/game/items/itemCatalog.ts` define IDs e efeitos tipados para erva medicinal (saúde), frasco de água limpa (sede) e fruta energética (resistência); `inventory.ts` valida, limita pilhas e consome um item por vez.
- `worldBuilder.ts` posiciona pickups físicos nos distritos; `GameEngine` coleta, concede XP, persiste o inventário em save opcional retrocompatível e impede consumo quando o atributo já está cheio.
- A HUD possui mochila minimizável com quantidades e botão de uso, posicionada na coluna superior direita logo abaixo dos controles da câmera 3D e do radar, sem sobrepor esses elementos. A ração energética de batalha permanece separada e compatível com saves antigos.
- Lojas, crafting e equipamentos ainda estão fora do incremento inicial do inventário; o sistema de equipamentos está em desenvolvimento separado na branch `codex/equipment-system`.



### 4.7 Recompensas físicas de missões (incremento em desenvolvimento — branch `codex/physical-task-rewards`)
- `src/game/tasks/taskRewards.ts` valida e normaliza drops persistentes, com IDs únicos e quantidades limitadas.
- Ao concluir uma missão cíclica, XP continua sendo creditado pela progressão existente; a sucata da recompensa aparece como objeto físico próximo a Tomas, com brilho/anel e interação de coleta.
- O drop fica em `SavedGameState.taskRewardDrops`, é recriado ao carregar o save e só é removido da lista após coleta. Não é contado como sucata de objetivo para evitar progresso recursivo em outras missões.
- Recompensas dos pedidos de habitantes permanecem como antes neste incremento; lojas, crafting e equipamentos ainda não foram implementados.



### 4.8 Equipamentos (incremento em desenvolvimento — branch `codex/equipment-system`)
- O catálogo adiciona coleira reforçada (+15 saúde máxima) e arreio de explorador (+20 resistência máxima), cada um em seu slot independente.
- Os equipamentos são pickups físicos nos distritos, ocupam inventário persistente, podem ser equipados/removidos pela mochila e devolvidos à mochila ao trocar de item no mesmo slot.
- Bônus entram nas funções centrais de máximo de saúde/resistência; `SavedGameState.equipment` é opcional para compatibilidade com saves antigos.
- Lojas, crafting, atributos defensivos e mais slots/tipos de equipamento continuam pendentes.

## 5. Roteiro e decisões do autor

### 5.1 Decisões de arquitetura (definidas)
- **Mundo persistente**, administrado por uma **sociedade artificial** com **controle compartilhado**: a **Cowila** coordena (objetivos, prioridades, propostas), mas engenheiros, operários e agentes têm autonomia dentro de suas atribuições. Ela não é onipotente.
- **Duas camadas de inteligência:** operacional (TypeScript determinístico: movimento, tarefas, necessidades, conflitos) e estratégica (Cowila: análise, prioridades, projetos).
- **Camadas de engenharia:** Mundo, Sociedade, Inteligência, Simulação, Multiplayer.
- **Infraestrutura prevista:** Cloudflare Worker (API), Durable Objects por região (estado autoritativo, WebSocket), D1 (jogadores, agentes, projetos, relações, eventos, histórico), Cron Triggers (evolução do mundo sem jogadores).
- **Escalas de simulação:** próxima (regiões com jogadores, em detalhe), distante (resumida), cósmica (mundos e galáxias em escala abstrata).
- Construções usam **módulos 3D aprovados previamente**; a IA nunca gera geometria arbitrária.

### 5.2 Fases de engenharia (ordem planejada)
| # | Fase | Estado |
|---|------|--------|
| 0 | Contratos TypeScript e testes | Feito |
| 1 | Sociedade local determinística (habitantes, necessidades, tarefas, relações) | Feito |
| 2 | Visualização 3D dos habitantes, interação social, balões | Feito |
| 3 | Economia básica e agricultura (estoque, custos, colheita, refeições) | Feito |
| 4 | Projetos e construções modulares visíveis no mundo | Parcial (falta catálogo de módulos aprovados) |
| 5 | Profissões especializadas, economia com salários e comércio | Parcial (8 profissões, salários, consumo e comércio básico; faltam preços dinâmicos, saúde, ensino etc.) |
| 6 | Persistência remota e sincronização (Worker, DO, D1) | Pendente |
| 7 | Mundo evoluindo sem jogadores conectados | Pendente |
| 8 | Integração da Cowila | Pendente |
| 9 | Multiplayer e conflitos entre jogadores humanos e animais de IA | Pendente |

### 5.3 Diretrizes de design (a implementar)

**Expansão de jogabilidade solicitada pelo autor (incremental, sem substituir sistemas existentes)**
- Progressão: preservar níveis/estrelas e a barra `starProgress`; evoluir a partir dela, sem criar XP paralelo. Técnicas são liberadas por nível e persistidas retrocompativelmente.
- Economia: catálogo único de itens, inventário e equipamentos; lojas e pickups devem compartilhar os mesmos IDs e efeitos. Todo item de loja deve ter ao menos uma fonte gratuita no mundo ou em tarefas.
- **HUD do inventário:** o atalho da mochila fica abaixo da câmera 3D e do radar na coluna superior direita; manter o painel minimizável e sem sobreposição com controles de navegação.
- Tarefas: geração em ciclos de 600 segundos de jogo ativo, com estado persistente, painel aceito minimizado, rota navegável e recompensa física coletável. Nunca repetir tarefas concluídas.
- Posturas: alternância quadrúpede/bípede com animações, modificadores e compatibilidade com natação/escalada; preservar a locomoção atual como postura padrão.
- Territórios: expandir os rivais existentes em gangues e líderes regionais; preservar IDs, chefes principais e progresso de conquista.



**Sociedade animal complexa, como uma cidade real**
- Profissões e cargos: construção e engenharia; agricultura e produção; saúde; segurança e justiça; comércio e economia; educação e cultura. Cada uma com especializações, níveis, horários, ferramentas, locais de trabalho e hierarquia.
- Cada habitante é um **indivíduo** (personalidade, habilidades, opiniões, relações, produtividade, história), não uma unidade de trabalho.
- Organizações: gangues, grupos comunitários, associações profissionais, grupos comerciais, organizações de proteção, facções territoriais.
- Lei e ordem: leis, patrulhamento, investigação, mediação, justiça proporcional, reabilitação.
- Conflitos: discussões, disputas territoriais, competições, brigas estilizadas, perseguições, disputas de liderança, tréguas. Resolver por reputação, influência e negociação também conta.
- Agentes da Cowila (fiscal, mediador, investigador, diplomata, mentor, guardião, desafiador, controlador): podem ajudar, testar ou bloquear Tomas, sem trapacear (capacidades e limites definidos).
- Habitantes agem sem o jogador: trabalham, descansam, trocam de profissão, abrem negócios, formam famílias e organizações, lembram eventos.

**Catástrofes e equilíbrio mundial**
- Eventos: enchentes, terremotos, nevascas, secas, incêndios florestais, tempestades.
- **Nenhuma catástrofe surpreende injustamente:** alerta meteorológico, alerta de risco, preparação e evacuação, perigo iminente, catástrofe, recuperação. Prazos configuráveis por evento.
- Habitantes reagem sozinhos (abrigo, socorro, reforço de estruturas, evacuação, migração de animais).
- Crescimento controlado por capacidade (alimento, água, moradia, empregos, recursos), com migração; sem destruir população artificialmente.
- Módulos: **World Director**, **Natural Disaster Engine**, **Early Warning System**, **Emergency Response System**. Geração de eventos e cálculo de risco determinísticos e auditáveis.
- Consequências permanentes, mas recuperação sempre possível; nenhuma região fica irrecuperável.

**Era Selvagem — sobrevivência e renascimento**
- Ciclo: Civilização → Colapso → Era Selvagem → Renascimento → Nova civilização (pode repetir).
- Colapso progressivo: preserva população sobrevivente e recursos mínimos; não apaga o progresso do jogador.
- Sobrevivência do gato: energia vital, oxigênio, fome, sede, temperatura, resistência, saúde, sono.
- Pesca e mergulho (oxigênio, profundidade, predadores aquáticos), caça com cadeia alimentar dinâmica, construção de barracas, abrigos, fogueira, depósito, cercado e acampamento comunitário.
- Predadores por bioma (ursos, leões e hienas na savana, lobos, cães selvagens, raposas, tubarões e crocodilos na água). Evitar, fugir e se esconder são tão válidos quanto lutar.
- Reconstrução em etapas: acampamentos → comunidades → povoados → cidades → nova civilização, feita pelos NPCs com autonomia.

**Piloto automático**
- Estados: humano → IA → retorno com relatório de atividades.
- Modos: sobrevivência, exploração, construtor, caçador e pescador, equilibrado, personalizado.
- Prioridades: preservar a vida, evitar riscos, manter alimentação e descanso, proteger recursos, cumprir atividades autorizadas.
- Limites de autonomia: não gasta recursos raros, não abandona propriedades, não assume compromissos irreversíveis.
- Exige estado persistente no servidor. Sem servidor, usar simulação local segura ou suspender; **nunca fingir** que o personagem jogou.

**Eras da civilização**
- Selvagem → Tribal → Antiga → Medieval → Industrial → Tecnológica → Futurista → Espacial → Galáctica. Cada era com construções, profissões, equipamentos, transporte, organizações e governo próprios.
- Catástrofes podem causar **regressão**, mas história, ruínas, artefatos, brasões e reconhecimento dos jogadores permanecem.

**Reconhecimento dos jogadores**
- Veteranância (conta tempo de participação efetiva, não horas com o jogo aberto): Novato → Experiente → Veterano → Veterano lendário.
- Brasão permanente por era conquistada.
- Distinções **VIP**, **PREMIUM** e **MASTER**, indicadas por agentes da Cowila com critérios transparentes, auditáveis, revisáveis e sem discriminação. Recomendação: não são compradas e não dão vantagem em combate, sobrevivência ou recursos (privilégios sociais e cosméticos).
- Módulos previstos: `CivilizationEvolution`, `WorldHistory`, `PlayerVeterancy`, `PlayerHeraldry`, `CowilaSelection`, `PlayerDistinctions`, `AchievementLedger`.

**Multiverso Eterno (diretriz máxima)**
- O universo existe independentemente dos jogadores e continua simulando quando todos saem. Não há fase final obrigatória.
- A sequência de eras muda a cada simulação (continentes, biomas, espécies, recursos, civilizações, catástrofes), por geração procedural com regras adaptativas. Algumas regras ficam ocultas, mas nunca as de segurança, as probabilidades relevantes ou os critérios de reconhecimento.
- Cowila coordena agentes especializados (Cosmológico, Civilizacional, Ecológico, Climático, Econômico, Histórico, Segurança, Exploração). Eles propõem; regras determinísticas validam.
- "Infinito" na prática: mundos procedurais, simulação por regiões, arquivo histórico comprimido, estados resumidos, instâncias criadas e encerradas, IDs permanentes, relógio lógico independente dos jogadores, recuperação automática.

### 5.4 Roteiro de diálogos e batalha cinematográfica (decisão do autor)
1. Fase 0 — **feito**: contratos tipados, dados iniciais, runner puro, testes e campos opcionais retrocompatíveis.
2. Fase 1 — **parcial, ampliada**: interação por proximidade, janela de diálogo, opções condicionais, relações/flags persistentes e nove tarefas com objetivos reais, progresso por eventos, conclusão, recompensas e HUD. Faltam tarefas em múltiplas etapas, rotas/waypoints e testes dedicados de integração do motor/HUD.
3. Fase 2 — **parcial**: ração energética integrada ao inventário persistente, obtida gratuitamente por coleta, utilizável na batalha para recuperar até 28 pontos de vigor, com custo de turno, HUD/tecla I, animação e testes determinísticos. Faltam mais itens e expansão das apresentações cinematográficas; os dois primeiros combos desbloqueáveis já estão integrados.
4. Fase 3 — diálogos de provocação e resultado conectados às batalhas e às flags de história.
5. Fase 4 — conteúdo, acessibilidade, desempenho móvel e regressão.

A batalha existente em `atb.ts` e `BattleStage.ts` é a base a evoluir, não a ser substituída. O ATB executa `attack`, `flurry`, `guard`, `limit` e `item` (ração energética, adquirida ao recolher comida/peixe/presa). `combo_a` e `combo_b` são os IDs internos dos combos jogáveis Rasante Duplo e Tempestade de Garras.

### 5.5 Sequência recomendada (a partir de agora)
1. Sistema de sobrevivência do gato (fome, sede, oxigênio, energia vital, resistência). **Oxigênio, natação e mergulho: feitos (ver 4.1).**
2. Recursos naturais, coleta, pesca, caça e construção de abrigos.
3. IA de predadores, presas e ecossistemas.
4. Máquina de estados da civilização (normal, crise, colapso, Era Selvagem, reconstrução, renascimento).
5. Construção física das comunidades pelos trabalhadores (catálogo de módulos aprovados).
6. Persistência mundial e integração da Cowila.
7. Piloto automático, eras, brasões, distinções e multiverso.

Em paralelo, os ajustes de jogabilidade da seção 4.4.

## 6. Mapa de arquivos

```
src/
  App.tsx, main.tsx, index.css
  components/        GameCanvas, GameHUD, TitleScreen
  game/
    GameEngine.ts    motor, física, câmera, clima, sobrevivência, save
    worldBuilder.ts  cidade, colisores, abrigos, interiores
    catModel.ts, enemyModels.ts, textures.ts, audio.ts
    society/         contracts, simulation, SocietyActors (+ testes)
  types/game.ts      tipos de jogo, estágios de evolução, fases
docs/architecture/AI-SOCIETY.md   arquitetura detalhada da sociedade artificial
.github/workflows/deploy-pages.yml
```

## 7. Contexto sobre o autor
O autor, Tom, comunica-se em português do Brasil e prefere que as tarefas pedidas sejam executadas diretamente. Os textos de design acima vieram de conversas dele com o ChatGPT e foram consolidados aqui; em caso de conflito entre este arquivo e uma conversa antiga, vale o que o autor decidir por último.


## Atualização de engenharia — céu vivo (2026-11-16)

- **Integração inicial concluída em código:** `src/game/sky/skyAtmosphere.ts` fornece amostragem determinística de fase/iluminação lunar, cobertura e deriva de nuvens e atividade de aves conforme clima e hora. `SkyVisuals` mantém nuvens e bandos leves em limites fixos (14 nuvens e 24 posições de aves), centrados no jogador para reduzir custo de renderização.
- **GameEngine:** a amostragem é conectada ao ciclo ambiental existente; a intensidade lunar acompanha a fase e nuvens/aves são atualizadas durante a iluminação ambiental. A lógica visual não altera física, combate, diálogos nem saves.
- **Testes:** incluído o conjunto `src/game/sky/*.test.ts` no comando geral, preservando os testes de progressão, diálogos e tarefas já existentes.
- **Correções de integração:** a regra de janela lunar reutiliza `dayCycle.ts`; corrigido literal de seed inválido no módulo visual; recursos compartilhados das nuvens são liberados uma única vez.
- **Limites conhecidos:** o céu usa o clima e o ciclo globais atuais; perfis artísticos específicos por distrito/mundo, cintilação estelar avançada, aves em silhueta articulada e corona solar ainda precisam de incrementos próprios. Esta entrega não declara concluídos rios/lagos, portais, save multi-mundo nem Galáxia.

### Sequência imediata
1. Validar céu vivo integrado em CI e publicar após CI verde.
2. Auditar e integrar o catálogo de águas sem confundir dados de lago/segmento com malhas já jogáveis; correnteza exige integração física explícita e testes.
3. Auditar os contratos de portais/WorldId, persistência retrocompatível e transição real antes da Galáxia visual.


## Atualização de engenharia — catálogo de águas (2026-11-16)

- **Contrato determinístico adicionado:** `src/game/survival/waterBodies.ts` define lagos por fase, segmentos de rios, distância ponto-segmento, direção/velocidade da corrente e amostragem combinada com as bacias legadas.
- **Escopo desta entrega:** somente catálogo e regras puras, sem afirmar que rios/lagos já estejam renderizados ou conectados à física do jogador. A integração visual no `worldBuilder` e o empurrão real da corrente no `GameEngine` permanecem pendentes e serão entregues separadamente com testes de colisão/natação.
- **Precisão temporal:** o cálculo do deslocamento da corrente recebe `dt`; não presume um segundo por chamada. O chamador deve fornecer o delta real do frame.
- Os oito corpos d'água legados permanecem intactos; o catálogo novo é complementar e não substitui `sampleWater` até a integração completa.


## Atualização de engenharia — águas integradas (2026-11-16)

- **Lagos:** os quatro lagos médios do catálogo foram posicionados em áreas abertas dos quatro distritos e adicionados ao mesmo pipeline de geometria, profundidade, natação e pesca das oito bacias existentes. As oito bacias originais foram preservadas.
- **Rios navegáveis:** canais low-poly recortam o piso e possuem superfície e leito próprios nas fases 1, 3 e 4. A amostragem por segmento retorna um corpo d'água compatível com a física de natação/oxigênio já existente.
- **Fase 2:** o Canal Elevado dos Telhados é visual, com bordas metálicas e sem volume de natação ao nível da rua; as cisternas/lago continuam como água navegável. Não se deve ativar física de água para esse canal suspenso sem implementar suporte vertical/colisão de plataformas.
- **Correnteza:** aplicada ao deslocamento horizontal do jogador somente dentro dos rios navegáveis, proporcional a `dt`, respeitando colisões e limites do mundo.
- **Validação:** os testes de catálogo verificam a presença de lago e rio/canal em cada fase, a exclusão de natação no canal suspenso e o corpo navegável/correnteza. CI ainda precisa confirmar integração completa.


## Atualização de engenharia — acabamento do céu vivo (2026-11-16)

- **Sol:** o módulo `src/game/sky/skyVisuals.ts` adiciona uma corona procedural sutil, sem textura ou asset externo, sincronizada à posição e visibilidade do disco solar.
- **Aves:** bandos procedurais são ocultados durante duelos/batalhas cinematográficas, evitando sobreposição visual e reforçando a reação do ambiente ao combate; voltam a aparecer quando a batalha termina e as condições de clima/horário permitem.
- **Nuvens e lua:** as camadas existentes continuam limitadas a 14 meshes reutilizados; a fase e a iluminação lunar permanecem determinísticas em `skyAtmosphere.ts`.
- **Limite desta entrega:** variações artísticas específicas por distrito/mundo e cintilação individual das estrelas ainda são pendências; não declarar o céu vivo concluído até cobrir esses pontos e validar visualmente as sete fases do dia.


## HUD de tarefas e navegação GPS

- O painel do sistema de tarefas fica na coluna superior esquerda, imediatamente abaixo do cartão compacto de energia, oxigênio e vida; não deve ocupar a coluna da mochila/inventário.
- Quando um alvo GPS de missão passa a existir, abrir automaticamente o radar e recolher a lista de tarefas para um resumo compacto com destino e distância. O jogador pode expandir/recolher manualmente sem perder o acompanhamento.
- O radar apresenta o rumo até o destino em azul, com marcador terminal. A rota navegável calculada no mundo 3D usa linha azul de alto contraste e continua sendo atualizada conforme o jogador se desloca.
- Preservar o roteamento por obstáculos (A*) existente; o indicador 2D do radar é uma representação de rumo, não deve substituir nem falsificar a rota calculada no mundo.


## Atualização de engenharia — contratos iniciais de portais e mundos (2026-11-16)

- `src/game/worlds/portalWorlds.ts` introduz contratos puros para `WorldId`, pontos, portais, requisitos de desbloqueio, progresso por mundo e âncora de retorno.
- `currentPhase` permanece independente de `WorldId`. O mundo legado é `quarantine-city`; isso não cria uma segunda cena nem altera as quatro fases existentes.
- A resolução de viagem exige origem ativa correspondente, destino registrado, coordenadas válidas e todos os requisitos determinísticos (chefes, tarefas e flags). O retorno usa a posição salva no portal de origem.
- `SavedGameState.worldTravel` foi adicionado como campo opcional, preservando a leitura de saves v4 antigos. A normalização ignora mundos não registrados e dados malformados.
- Testes puros cobrem compatibilidade de save legado, bloqueio, validação de destino, retorno e normalização. O comando `npm test` inclui `src/game/worlds/*.test.ts`.
- **Limite desta entrega:** contratos e testes apenas. A transição ainda não está conectada ao `GameEngine`, não há portal físico/HUD nem carregamento de outro mundo. Não anunciar viagem entre mundos como funcional até existir carregamento, salvamento automático e retorno jogável.


## Atualização de engenharia — Combo Breakers (2026-11-16)

- A câmera cinematográfica usa enquadramento adaptativo do conjunto de duelistas e distância ajustada pelo campo de visão e proporção da tela, inclusive em ataques, investidas e especiais.
- O jogador recebe 10 segundos por decisão ATB; ao expirar, a defesa é executada automaticamente.
- Combo Breaker automático: se Tomas estiver defendendo e bloquear um ataque simples fraco (até 14 pontos de dano após redução), rebate e derruba temporariamente o agressor.
- Combo Breaker manual: durante a carga de um especial inimigo, uma janela entre 0,72 s e 1,62 s permite interromper a sequência antes do primeiro impacto, por meio da tecla 9 ou botão na HUD.
- O contra-ataque causa dano determinístico, interrompe o especial, restaura o vigor que o especial ainda não chegou a exibir, lança o oponente para longe e o derruba com faíscas, clarão, tremor e câmera aberta.
- Testes de regras cobrem ativação defensiva, ausência de ativação sem defesa/contra sequência e finalização de alvo.


## Atualização de engenharia — persistência de viagem entre mundos (2026-11-16)

- `GameEngine` agora inclui `worldTravel` no save principal e atualiza a posição do jogador no mundo ativo durante o salvamento.
- Saves antigos sem `worldTravel` são normalizados para `quarantine-city` sem alterar `currentPhase`, inventário, tarefas ou progresso de campanha.
- A atualização de posição é imutável e preserva os registros e âncoras de retorno dos outros mundos; coordenadas inválidas são ignoradas.
- O motor permanece limitado ao mundo legado nesta etapa. O catálogo/loader de cenas, portais físicos, troca de mundo e retorno jogável ainda não estão conectados; não anunciar essas funções como concluídas.
- Testes cobrem preservação de posição por mundo, âncora de retorno, dados legados e rejeição de coordenadas inválidas.


## Atualização de engenharia — catálogo de mundos e carregamento seguro (2026-11-16)

- `src/game/worlds/worldCatalog.ts` passa a ser a fonte explícita dos IDs, nomes, pontos de surgimento, chaves de cena e disponibilidade dos mundos.
- `quarantine-city` é o único mundo jogável nesta entrega; `crystal-archipelago` está registrado como planejado, sem fingir que sua cena 3D ou viagem já existem.
- O carregamento de saves normaliza contra todos os IDs registrados, preservando posições e desbloqueios de mundos planejados.
- Antes de iniciar a simulação, o motor seleciona apenas um mundo marcado como jogável. Se um save apontar para um mundo ainda planejado, o jogo inicia na cidade original sem apagar o progresso salvo daquele mundo.
- `currentPhase` continua sendo progressão interna da campanha, não identidade de mundo.
- Testes cobrem IDs únicos, disponibilidade, separação entre fase e mundo e preservação de progresso quando um mundo planejado não pode ser carregado.
- Próxima etapa: definir contrato de ciclo de vida da cena (construção, ativação, descarte e restauração de estado), então construir o primeiro ambiente independente e ligar os portais a esse ciclo.


## Atualização de engenharia — ciclo de vida de cenas independentes (2026-11-16)

- `WorldSceneManager` gerencia raízes 3D separadas por `WorldId`, constrói cenas sob demanda, ativa uma única raiz por vez, mantém cenas carregadas para retorno rápido e permite descarregar cenas inativas.
- Cada definição declara seu próprio ponto de surgimento e fábrica de `BuiltWorld`; colisores, NPCs, predadores, água e interativos pertencem à raiz do mundo.
- O construtor da Cidade da Quarentena foi movido para uma raiz gerenciada, sem alterar seu conteúdo ou os sistemas globais do jogador, câmera, HUD e renderizador.
- O descarte de uma cena libera geometrias e materiais da raiz. Texturas compartilhadas continuam sob responsabilidade do motor.
- A implementação ainda registra somente a Cidade da Quarentena. O Arquipélago continua planejado e ainda não existe como cena jogável; a viagem e os portais não foram ativados nesta etapa.
- Testes cobrem construção lazy, alternância de visibilidade, cache, descarte/reconstrução, destinos desconhecidos e IDs duplicados.


## Atualização de engenharia — cenário procedural do Arquipélago de Cristal (2026-11-16)

- `src/game/worlds/crystalArchipelago.ts` cria um cenário 3D original com cinco ilhas, quatro pontes atravessáveis, oceano visual, cristais ressonantes, observatório central, setores nomeados e colisores para estruturas sólidas.
- A construção é determinística e isolada em uma raiz `THREE.Group`, compatível com `WorldSceneManager`.
- Os testes validam composição da cena, setores e limites de colisão.
- Esta etapa entrega o construtor da cena, mas ainda não a registra como jogável no motor. O mundo permanece `planned` até a integração de spawn/retorno, física de água, navegação e transição persistente.



## Atualização de engenharia — agentes especialistas da sociedade (2026-11-16)

- Criado `src/game/society/agents/catalog.ts` com perfis tipados para as oito profissões já existentes, incluindo missão, princípios operacionais, prioridade e allowlist de tarefas.
- Criado `policies.ts` para validar propostas quanto a identidade, tick, prioridade, profissão, setor, alvo, recursos disponíveis, disponibilidade do habitante e duplicidade de trabalho.
- Criado `orchestrator.ts` com ciclo determinístico de propostas e fallback local sem LLM, rede ou aleatoriedade.
- Criados testes específicos em `agents/agents.test.ts`; o comando `npm test` agora os inclui.
- A organização dos papéis foi inspirada em `msitarzewski/agency-agents` (licença MIT), mas os perfis são uma adaptação própria para as profissões e tarefas existentes no Tomas. Não foram copiados prompts de motores Unity/Godot.
- **Limite desta fase:** o orquestrador produz propostas e não modifica a simulação. Uma proposta aceita ainda precisa ser aplicada por controlador autoritativo; não há integração com HUD/GameEngine, LLM/Cowila remoto, Worker, Durable Objects, D1 ou simulação offline compartilhada. Não anunciar habitantes autônomos integrados ao jogo até concluir essa ligação e testá-la no mundo 3D.
- Documentação: `docs/architecture/SPECIALIST-AGENTS.md`.


## Atualização de engenharia — Cowila, expansão territorial e governança (2026-11-16)

- Engenheiros recebem mandato explícito para explorar territórios, desenhar bairros, propor cenários e planejar expansão urbana.
- Operários recebem mandato explícito para executar obras, ampliar bairros, abrir caminhos e construir infraestrutura após aprovação.
- `agents/expansion.ts` define propostas de expansão que precisam referenciar mundo jogável, template de cenário aprovado e módulos 3D autorizados pelo catálogo do motor.
- `agents/governance.ts` implementa estado disciplinar determinístico: suspensão por violações verificadas, reintegração condicionada a aceite das regras e avaliação, período probatório e bloqueio permanente após incitação reiterada comprovada.
- Discordância, crítica e propostas alternativas não são infrações. Evidência não verificada e eventos duplicados não geram punição.
- O bloqueio global exige persistência compartilhada da identidade/blocklist; a integração com backend e execução real de projetos ainda não está concluída.
- Documentação detalhada em `docs/architecture/COWILA-GOVERNANCE-AND-WORLD-EXPANSION.md`.
