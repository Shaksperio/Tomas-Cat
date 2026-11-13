# Arquitetura — Sociedade Artificial e Mundo Persistente

**Projeto:** Tomas Vagabundo  
**Repositório:** `Shaksperio/Tomas-Cat`  
**Estado:** arquitetura proposta, ainda não implantada  
**Decisões aprovadas pelo usuário:**
- Mundo persistente: a simulação deve avançar mesmo quando um jogador estiver desconectado.
- Controle compartilhado: Cowila coordena; engenheiros, operários e agentes mantêm autonomia limitada por função e regras do mundo.

## 1. Objetivo

Evoluir o jogo atual para um mundo aberto habitado por jogadores humanos e personagens autônomos. A sociedade artificial deve construir e administrar o mundo, manter relações, produzir acontecimentos e interagir com os jogadores. A evolução deve preservar a experiência atual de Tomas Vagabundo e acrescentar sistemas em camadas, sem reescrever o jogo.

## 2. Estado atual verificado no repositório

A branch principal contém um jogo React + TypeScript + Three.js + Vite, publicado como site estático no GitHub Pages.

- `src/game/GameEngine.ts` concentra o loop de jogo, física, clima, combate, progressão e ciclo do mundo.
- `src/game/worldBuilder.ts` constrói uma cidade pré-definida; `WORLD_BOUNDS` é atualmente 220 e os cenários são montados durante a inicialização.
- `src/game/enemyModels.ts` define `PredatorActor`, atualmente voltado a predadores, rivais e gatos amigáveis.
- `src/types/game.ts` define o estado salvo e os dados de HUD.
- `GameEngine` persiste o progresso em `localStorage` usando a chave `felis09_save_v4`.
- `src/App.tsx` inicializa o motor e conecta a HUD; ainda não existe serviço de mundo compartilhado, autenticação multiplayer ou sincronização entre jogadores.
- O workflow atual compila e publica o front-end no GitHub Pages.

**Consequência:** hoje o jogo é essencialmente local e de jogador único. O save no navegador não torna o mundo persistente para todos nem faz a cidade evoluir enquanto o navegador está fechado. A arquitetura nova precisa introduzir autoridade de servidor e armazenamento durável, preservando o motor 3D existente.

## 3. Princípios não negociáveis

1. **Preservar o jogo atual:** React, TypeScript, Three.js, Vite, controles, câmera, sobrevivência, clima, abrigos, fases, chefes, progressão e personagens existentes continuam funcionando.
2. **Adicionar antes de substituir:** os sistemas sociais entram como módulos independentes; não converter todo `PredatorActor` em agente social.
3. **Servidor autoritativo para o mundo compartilhado:** clientes não podem declarar construções concluídas, conceder recursos, alterar relações ou decidir resultados de combate por conta própria.
4. **Simulação determinística sempre que possível:** movimentação, trabalho, necessidades, economia, regras e combate usam lógica TypeScript previsível. IA generativa não decide cada frame.
5. **Cowila coordena, não domina:** pode propor prioridades, delegar tarefas e interpretar acontecimentos, mas não pode ignorar regras, permissões, recursos ou limites de segurança.
6. **Persistência com recuperação:** mudanças importantes geram eventos e snapshots versionados; reconexões recuperam o estado sem depender do navegador original.
7. **IA degradável:** se o provedor de IA estiver indisponível, a sociedade continua com rotinas locais determinísticas e filas de decisões pendentes.
8. **Desempenho móvel:** simular detalhadamente apenas a região próxima aos jogadores; regiões distantes avançam em passos abstratos.

## 4. Arquitetura lógica

```text
React + Three.js (cliente atual)
  ├── GameEngine: movimento, câmera, combate e renderização
  ├── WorldClient: carrega setores e envia comandos
  ├── SocietyClient: recebe estado social e eventos
  └── Local cache: estado recente e fila temporária de comandos
             │ HTTPS / WebSocket
             ▼
World API (Cloudflare Worker, proposta)
  ├── autenticação e validação de comandos
  ├── autorização, regras e rate limits
  ├── roteamento para a região/instância
  └── adaptador de IA Cowila
             │
       ┌─────┴────────────┐
       ▼                  ▼
World Region DO       D1 (projeções e catálogo)
(estado autoritativo,  (jogadores, agentes,
WebSocket, coordenação, projetos, relações,
simulação da região)  eventos e índices)
       │
       ├── Queue: trabalhos demorados e notificações
       └── Cron: avanço de simulação offline
             │
             ▼
     AI Orchestrator / Cowila
     (planejamento estratégico e propostas limitadas)
```

### Componentes propostos

- **Cloudflare Worker:** API de jogo, autenticação, validação de comandos e conexão com clientes. O GitHub Pages continua servindo o cliente nesta fase; não migrar hospedagem sem necessidade.
- **Durable Objects:** autoridade de cada região/servidor lógico, coordenação concorrente, presença e WebSockets. Cada região serializa alterações para evitar dois jogadores ou agentes sobrescreverem o mesmo estado.
- **Durable Object Storage:** estado operacional e checkpoints da região, com recuperação após reinicialização.
- **D1 dedicado ao Tomas Vagabundo:** catálogo consultável de habitantes, jogadores, projetos, relações, eventos e histórico. Não reutilizar banco de Shakstory/Guardião.
- **Queues:** tarefas de construção, notificações e trabalhos que precisem de retry sem bloquear o loop do jogo.
- **Cron Triggers:** avançar o mundo em intervalos quando não houver jogadores conectados. O avanço offline será por etapas agregadas, não por simulação de 60 FPS.
- **Adaptador Cowila:** interface independente do fornecedor de modelo. Permite conectar a inteligência usada no Guardião sem acoplar o motor do jogo a um modelo ou endpoint específico.

Esta é uma proposta de infraestrutura, não uma declaração de recursos já criados. Nenhum Worker, banco, binding, segredo ou migração foi provisionado.

## 5. Sociedade artificial

Todos os habitantes sociais devem ter identidade estável, profissão, atributos, necessidades, memória resumida, relações, objetivos, localização, estado atual e versão de dados. A identidade não deve depender do nome visível.

### 5.1 Engenheiros

Responsáveis por avaliar terrenos, planejar bairros e gerar projetos usando peças e regras arquitetônicas aprovadas.

Fluxo:
1. Identificar necessidade ou oportunidade de expansão.
2. Consultar terreno, recursos, acessibilidade, clima e restrições.
3. Produzir um projeto estruturado (tipo de construção, dimensões permitidas, módulos, custo e pré-requisitos).
4. Submeter o projeto às regras determinísticas e ao orçamento.
5. Aprovar ou encaminhar para revisão da Cowila.
6. Criar ordens de trabalho para os operários.

A IA não deve enviar geometria ou código arbitrário ao cliente. Construções são montadas com módulos 3D previamente definidos e validados.

### 5.2 Operários

Executam tarefas concretas: buscar materiais, transportar recursos, preparar terreno, montar módulos, reparar e limpar.

Cada projeto é decomposto em tarefas com dependências, custo, local, prazo simulado e estado. A conclusão só é registrada pelo servidor após validação dos requisitos. Os operários podem pausar ou replanejar diante de falta de material, perigo ou bloqueio.

### 5.3 Agentes

Agentes de segurança, mediação, investigação, diplomacia, orientação e controle de acesso. Podem conversar, dar pistas, iniciar missões, mediar conflitos e impor desafios de progressão.

Um agente pode bloquear uma passagem somente por uma regra explícita do mundo (missão, risco, autoridade territorial ou condição de fase), sempre apresentando ao jogador um motivo e uma forma possível de resolver a restrição. Agentes não podem bloquear arbitrariamente nem alterar progresso do jogador sem regra auditável.

### 5.4 Autonomia compartilhada

- A Cowila define prioridades estratégicas e pode propor redistribuição de tarefas.
- Engenheiros escolhem soluções de projeto dentro do catálogo e das regras.
- Operários escolhem a sequência viável de execução dentro de suas ordens.
- Agentes escolhem respostas sociais dentro de seus mandatos.
- O servidor valida recursos, permissões, transições e consequências.
- Conflitos entre grupos são resolvidos por políticas determinísticas; a Cowila pode recomendar, mas não contornar a política.

## 6. Ciclo de decisão da Cowila

A Cowila não recebe o fluxo bruto de cada frame. Ela trabalha com eventos relevantes e resumos de estado:

1. O servidor detecta um evento (escassez, dano, conflito, expansão, comportamento incomum).
2. Um agregador cria um contexto mínimo e remove dados pessoais desnecessários.
3. A Cowila recebe objetivo, fatos disponíveis, limites e ferramentas permitidas.
4. A Cowila devolve uma proposta estruturada, não uma execução livre.
5. Um validador determinístico verifica esquema, autorização, orçamento, segurança e consistência.
6. A ação aprovada é executada pelo sistema de jogo e registrada.
7. O resultado alimenta a memória resumida e o próximo ciclo.

A Cowila não deve receber credenciais, acesso ao banco irrestrito, shell, execução de código ou permissão para editar arquivos do jogo. Saídas inválidas são rejeitadas e o comportamento padrão determinístico assume o controle.

## 7. Mundo persistente e avanço offline

O mundo terá relógio lógico próprio, independente do relógio do navegador.

- O servidor salva checkpoints e eventos relevantes.
- Ao desconectar o último jogador, a região passa para simulação econômica/abstrata.
- Em intervalos agendados, o sistema calcula trabalho realizado, consumo de recursos, necessidades, relações e eventos elegíveis.
- Ao retornar, o cliente recebe um snapshot e os eventos desde sua última sincronização.
- Limites de tempo offline e de trabalho por ciclo impedem crescimento infinito ou consumo descontrolado.
- Eventos críticos (combates com jogadores, decisões irreversíveis, punições e mudanças de fase) podem aguardar presença humana ou política específica.

A passagem do tempo deve ser configurável e transparente. Não usar o relógio local do dispositivo como fonte de verdade.

## 8. Expansão do mundo e conteúdo 3D

O mapa atual continua sendo o setor inicial. A expansão passa gradualmente para setores/chunks com identificadores estáveis.

Cada setor tem:
- coordenadas e limites;
- seed determinística;
- manifesto de construções e objetos;
- colisores e pontos de navegação;
- estado de construção e versão;
- requisitos de carregamento e descarregamento.

O servidor persiste o manifesto e o estado; o cliente instancia os modelos Three.js. Setores distantes podem ser descarregados da memória e reconstruídos pela seed e pelo manifesto. Projetos de construção só entram no mundo após validação de colisão, navegação, orçamento e limites.

## 9. Jogadores humanos, animais de IA e conflitos

- Jogadores humanos controlam seus próprios personagens.
- Habitantes de IA têm identidades, objetivos e capacidades próprias.
- Regras de combate e colisão são validadas pelo servidor em áreas compartilhadas.
- Animais hostis, rivais territoriais e habitantes amigáveis permanecem categorias distintas.
- Agentes podem intervir em brigas conforme regras conhecidas.
- Não permitir que agentes sociais sejam tratados automaticamente como inimigos ou alvos de combate.
- Progresso, recompensas e acesso a fases são decididos pelo servidor; a IA pode criar desafios, mas não alterar critérios de forma oculta.

## 10. Modelo de dados inicial

Tabelas/coleções lógicas propostas (nomes sujeitos a revisão antes da migração):

- `world_regions`: regiões, seed, versão e estado.
- `world_snapshots`: checkpoints e metadados de recuperação.
- `world_events`: eventos ordenados e idempotentes.
- `players`: identidade de jogo e progresso.
- `society_agents`: habitantes, profissão, personalidade e estado.
- `agent_memories`: memória resumida e referências a eventos.
- `agent_relationships`: confiança, rivalidade, alianças e reputação.
- `construction_projects`: projetos, orçamento e estado.
- `construction_tasks`: tarefas, dependências, responsável e resultado.
- `world_assets`: catálogo de módulos e construções aprovadas.
- `agent_policies`: permissões e limites por função.
- `ai_decision_log`: proposta, validação, decisão e resultado, com dados sensíveis redigidos.

O estado operacional concorrente pertence à instância regional autoritativa; D1 mantém registros consultáveis e projeções. O desenho físico final deve evitar duas fontes de verdade concorrentes.

## 11. Segurança, economia e governança

- Toda ação recebida do cliente é validada no servidor.
- Recursos e recompensas são transacionais e idempotentes.
- Orçamento, inventário, propriedade, combate e progressão têm limites explícitos.
- Cada agente tem permissões mínimas por profissão.
- A Cowila só usa ferramentas tipadas e allowlisted.
- Decisões que afetam jogadores são auditáveis e contestáveis.
- A memória guarda apenas informações de jogo necessárias; evitar dados pessoais.
- Proteções contra spam, duplicação de eventos, exploração econômica e abuso multiplayer.
- Backups, migrações versionadas e estratégia de rollback antes de qualquer lançamento.

## 12. Plano de implantação incremental

### Fase 0 — Fundação e compatibilidade
Documentar interfaces atuais, versionar o save local, criar testes de regressão e definir contratos de mundo. Nenhuma mudança visual ou de gameplay obrigatória nesta fase.

### Fase 1 — Sociedade local determinística
Introduzir interfaces separadas para habitantes, profissões, tarefas, projetos e relações. Criar um pequeno núcleo de engenheiros, operários e agentes controlados por regras locais. Não chamar IA externa ainda.

### Fase 2 — Construção modular
Adicionar catálogo de módulos 3D, projetos validados, tarefas de operários e construção progressiva em um setor de teste. Preservar o cenário atual como setor inicial.

### Fase 3 — Persistência remota
Criar Worker e recursos de dados exclusivos do Tomas, autenticação, snapshots, eventos e sincronização. Migrar progresso local com compatibilidade e consentimento, sem apagar saves antigos.

### Fase 4 — Mundo persistente offline
Adicionar relógio lógico, avanço agregado por Cron e recuperação de estado. Validar que o mundo avança sem jogador e não duplica tarefas ao reiniciar.

### Fase 5 — Cowila coordenadora
Conectar o adaptador de IA para planejamento de alto nível, com propostas estruturadas, limites, validação, logs e fallback determinístico.

### Fase 6 — Multiplayer e agentes sociais avançados
Adicionar presença, WebSockets, regiões compartilhadas, diálogos contextuais, reputação, mediação e desafios de progressão. Testar concorrência e anti-abuso.

### Fase 7 — Expansão contínua
Desbloquear novos chunks, profissões, organizações, biomas, construções e eventos dinâmicos após telemetria e testes de desempenho.

## 13. Critérios de aceitação

A arquitetura só será considerada implantada quando:
- O jogo atual continuar iniciando e mantendo seus sistemas existentes.
- Um habitante tiver identidade e estado persistentes entre sessões.
- Um engenheiro gerar um projeto válido e um operário executá-lo por tarefas observáveis.
- Uma construção sobreviver a reinício e reconexão.
- O mundo avançar de forma controlada quando nenhum jogador estiver conectado.
- A Cowila emitir propostas estruturadas que possam ser aceitas ou rejeitadas pelo validador.
- Uma indisponibilidade da IA não interromper o jogo.
- Dois clientes enxergarem estado consistente na mesma região.
- Testes cobrirem concorrência, duplicação, recuperação, permissões e desempenho móvel.

## 14. Fora do escopo da primeira entrega

- Gerar malhas 3D arbitrárias com IA em tempo real.
- Deixar um LLM controlar diretamente o loop de física ou cada NPC a 60 FPS.
- Permitir que a Cowila execute código, SQL livre ou comandos administrativos.
- Substituir o motor atual ou migrar React/Three.js/Vite.
- Migrar imediatamente o site do GitHub Pages.
- Criar um MMO de grande escala antes de validar uma única região persistente.

---

**Próxima entrega de engenharia recomendada:** Fase 0, começando por contratos TypeScript isolados para `SocietyAgent`, `Profession`, `AgentTask`, `ConstructionProject` e `WorldEvent`, acompanhados de testes e sem alterar ainda a lógica de combate, o mapa atual ou a HUD.
