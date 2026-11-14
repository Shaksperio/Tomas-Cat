# AGENTS.md — Tomas Vagabundo (roteiro e guia para IAs)

> **Leia este arquivo primeiro.** Ele resume o que o jogo é, o que já existe no código, o que foi decidido pelo autor e o que falta fazer. Foi escrito para que qualquer IA (ChatGPT/Codex, Claude, Gemini, Cursor, Copilot, Google AI Studio etc.) entenda o projeto sem depender de conversas anteriores.
>
> Última atualização: 2026-11-13. Estado do código descrito: commit `8d8f247` da branch `main`.
> Quando mudar algo relevante, **atualize a seção 4 (estado atual) e a seção 5 (roteiro)** no mesmo commit.

## 1. Resumo do projeto

- **Nome:** Tomas Vagabundo (nome interno antigo: FELIS-09). O gato jogável se chama **Tomas Vagabundo**.
- **Repositório:** https://github.com/Shaksperio/Tomas-Cat — autor: Tom (Antonio), `Shaksperio`.
- **O que é:** jogo 3D de mundo aberto e sobrevivência, em terceira pessoa, com um gato abandonado numa metrópole devastada. Roda no navegador.
- **Stack:** React 19, TypeScript, Three.js, Vite, Tailwind CSS 4. Sem engine externa.
- **Publicação:** GitHub Pages, https://shaksperio.github.io/Tomas-Cat/ (base `/Tomas-Cat/` em `vite.config.ts`). Deploy automático a cada push na `main`, pelo workflow `.github/workflows/deploy-pages.yml`.
- **Origem:** criado no Google AI Studio; versionado aqui. Mantenha a configuração do Vite e o workflow ao sincronizar.
- **Idioma:** textos de interface e comunicação com o autor em **português do Brasil**.

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
npm test             # tsx --test src/game/society/*.test.ts
npm run lint         # tsc --noEmit
npm run build        # gera dist/
```

O workflow roda, nesta ordem: instalação, `npm test`, `npm run lint`, `npm run build`, publicação no Pages. Em `Settings → Pages`, a fonte deve ser **GitHub Actions**.

## 4. Estado atual do código (o que existe)

### 4.1 Jogo base (`src/game/`, `src/components/`)
- `GameEngine.ts`: laço principal, física, câmera, combate, sobrevivência, clima, progressão, salvamento. Salva em `localStorage` com a chave `felis09_save_v4`.
- `worldBuilder.ts`: cidade pré-construída (limite do mundo `WORLD_BOUNDS = 220`), 4 distritos, 6 abrigos, prédios ocos acessíveis (`addAccessibleBuilding`), colisores, gates de fase, terminais de lore.
- `catModel.ts`, `enemyModels.ts`, `textures.ts`, `audio.ts`: modelos, texturas e áudio procedurais (sem arquivos de asset).
- `GameHUD.tsx`, `TitleScreen.tsx`, `App.tsx`: interface em React.
- **Progressão:** níveis 1–99, 4 estágios de evolução do gato, 5 chances, checkpoints após cada chefe.
- **Fases e chefes:** 1 Subúrbio (Rei Rato Gigante), 2 Telhados (Gato Cicatriz), 3 Hospital (Cão Alfa Cibernético), 4 Estádio (Leão Apex).
- **Sobrevivência:** vida, fome, sede, calor, energia/resistência e oxigênio (reserva e recuperação na superfície; consumo e asfixia preparados para submersão). Interações: comida, presas, água, abrigo, sucata, terminais.
- **Ciclo do dia:** a HUD mostra 7 períodos (Madrugada, Alvorecer, Manhã, Dia, Tarde, Anoitecer, Noite). A iluminação só tem paletas de dia, crepúsculo e noite.
- **Lua:** à noite aparece uma lua com luz própria; o modo "força lunar" dá 1,65× de dano e 1,22× de salto, e o gato mia ao ativar.
- **Clima:** chuva, neve, vento gelado, frio congelante e chuva ácida, em ciclo, com partículas, neblina e perda de calor.
- **Abrigos climáticos:** prédios ocos (`indoorZones`) e abrigos protegem do clima; a câmera não atravessa as paredes por dentro.
- **Extras:** o gato dorme abrigado à noite e se lambe parado; gatos amigos Mingau e Canela.
- Exposição do renderizador e luzes foram aumentadas para o jogo não ficar escuro demais.

### 4.2 Sociedade artificial (`src/game/society/`) — simulação local
- `contracts.ts`: tipos `SocietyAgent`, `AgentTask`, `ConstructionProject`, `WorldEvent` (com chave de idempotência), 8 profissões (`engineer`, `worker`, `agent`, `farmer`, `lumberjack`, `miner`, `carpenter`, `merchant`), validações.
- `simulation.ts`: `SocietySimulation`, determinística, em ticks lógicos (1 por segundo no jogo, avanço limitado por chamada). 9 habitantes: Íris (engenheira), Tico e Nina (operários), Bento (agente), Amora (agricultora), Cedro (lenhador), Brita (mineira), Serafim (carpinteiro) e Mercê (mercadora). Cada profissão tem um local de trabalho fixo (`WORKPLACES`), ao redor do qual sorteia os alvos das tarefas.
  - Necessidades (fome, convivência, moral), descanso, deslocamento até o local de trabalho.
  - Cadeia engenheiro → operário → construção, com custos.
  - Recursos comunitários: comida, madeira, pedra, tábuas e moedas, com capacidade máxima de armazém (60 por recurso; moedas até 999).
  - Produção: agricultura (cultivo e colheita), lenhador (+6 madeira), mineiro (+4 pedra), carpinteiro (3 madeira → 2 tábuas; nunca usa os 4 de madeira reservados à construção).
  - Consumo: refeições comunitárias (1 comida por habitante a cada 40 ticks), lenha (1 madeira a cada 60) e manutenção (1 tábua a cada 120); necessidade não atendida reduz o moral de todos.
  - Comércio: a mercadora vende o excedente acima do estoque-alvo (comida 20, madeira 12, pedra 8, tábuas 6) por moedas e compra comida quando ela fica abaixo de 8.
  - Tarefas concluídas são arquivadas após 200 ticks, para o estado não crescer sem limite.
  - Relações (confiança e afinidade, limite 100), interações sociais e eventos.
- `SocietyActors.ts`: personagens 3D, placas de nome, indicadores de estado, balões de conversa, plantação 3D (3 fileiras de 12 plantas) e armazém comunitário com estoque visual.
- Testes: `contracts.test.ts` e `simulation.test.ts`.
- Documento de arquitetura: `docs/architecture/AI-SOCIETY.md` (parte dele está desatualizada: diz "ainda não implantada").

### 4.3 O que NÃO existe ainda
Backend e persistência remota; a sociedade não entra no salvamento; mundo que evolui sem jogador; Cowila integrada; multiplayer; salários e preços dinâmicos; organizações, gangues, lei e justiça; catástrofes e alertas; colapso e Era Selvagem; oxigênio, mergulho, pesca, caça, barracas e predadores por bioma; piloto automático; eras; brasões e distinções de jogadores; multiverso.

### 4.4 Lacunas de jogabilidade conhecidas
- Alvorecer, tarde, anoitecer e madrugada não têm paleta própria de iluminação.
- A lua e a força lunar começam às 17h17 e terminam às 5h17 (`timeOfDay > 0.72 || < 0.22`), o que não bate com os rótulos da HUD (Tarde 16–18h, Alvorecer 5–7h).
- O céu não tem sol visível nem estrelas; a lua é uma esfera simples.
- Oxigênio está exposto na HUD e possui consumo/recuperação determinísticos, mas o mundo ainda não possui volumes de água profunda nem mergulho jogável.
- Só os prédios protegem do clima; os abrigos ao ar livre não têm cobertura (marquises).
- A última execução do Actions (nº 59, commit `8d8f247`) estava em andamento quando este arquivo foi escrito.

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
| 5 | Profissões especializadas, economia com salários e comércio | Parcial (4 profissões produtivas, consumo e comércio básico; faltam salários, preços dinâmicos, saúde, ensino etc.) |
| 6 | Persistência remota e sincronização (Worker, DO, D1) | Pendente |
| 7 | Mundo evoluindo sem jogadores conectados | Pendente |
| 8 | Integração da Cowila | Pendente |
| 9 | Multiplayer e conflitos entre jogadores humanos e animais de IA | Pendente |

### 5.3 Diretrizes de design (a implementar)

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

### 5.4 Sequência recomendada (a partir de agora)
1. Sistema de sobrevivência do gato (fome, sede, oxigênio, energia vital, resistência).
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
