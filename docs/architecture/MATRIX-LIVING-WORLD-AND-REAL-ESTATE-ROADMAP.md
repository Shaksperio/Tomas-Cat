# Matrix Viva — plano de execução, Cowila e agentes especialistas

**Status do registro:** plano aprovado pelo usuário em 21/11/2026; implementação incremental em andamento.  
**Escopo deste documento:** direção de produto, arquitetura-alvo, estado conhecido, fases, regras de governança e critérios verificáveis.

## 1. Visão do mundo

Tomas Vagabundo deve evoluir para uma Matrix: um mundo persistente, coerente e vivo que continua simulando a sociedade mesmo quando nenhum jogador está conectado. A simulação não pode depender da aba do navegador aberta.

A persistência do mundo, a execução de agentes e a publicação de código são responsabilidades distintas:
- **Simulação cotidiana:** movimentos, necessidades, tarefas, obras, transações e eventos são estado do mundo, gravado no backend autoritativo.
- **Conteúdo versionado:** cenários, assets e expansões curadas podem ser empacotados e promovidos por PR.
- **Código:** alterações de software passam por branch, PR, testes, CI e Gate. Agentes não fazem push direto em `main`.

A simulação deve ser determinística sempre que possível, reproduzível por eventos e com validação autoritativa no servidor. A IA pode propor e priorizar; contratos e políticas determinísticas autorizam ou recusam; o controlador autoritativo aplica.

## 2. Cowila e a sociedade de agentes

### Cowila — governadora estratégica
- Observa indicadores da população, economia, infraestrutura, segurança, necessidades e estado regional.
- Define prioridades, propõe políticas e empreendimentos e distribui objetivos aos especialistas.
- Coordena equipes, acompanha prazos, orçamento, recursos, riscos e inspeções.
- Reavalia planos diante de eventos e resultados.
- Não ignora contratos, regras urbanísticas, engenharia, permissões ou o Gate de publicação.
- Não executa diretamente ações destrutivas ou privilegiadas sem autorização prevista em política.

### Agentes especialistas
A sociedade deve suportar profissões e empresas com papéis claros: urbanistas, arquitetos, engenheiros civis/estruturais/elétricos/hidráulicos, profissionais de segurança, mestres de obra, trabalhadores, inspetores, agricultores, comerciantes, construtoras, incorporadoras, imobiliárias, corretores, investidores, proprietários, locadores e inquilinos.

Cada agente precisa de identidade persistente, profissão/competências, necessidades, memória de eventos, relações, localização, tarefas, disponibilidade, recursos e histórico. A atribuição de tarefas respeita competência, dependências, energia, recursos e permissões.

### Governança e Gate
1. Cowila cria uma proposta com objetivo, evidências, impacto, custo e critérios de sucesso.
2. Especialistas elaboram alternativas e entregáveis estruturados.
3. Validadores determinísticos verificam contratos, permissões, recursos, segurança e dependências.
4. O controlador autoritativo aplica apenas operações válidas e idempotentes.
5. Alterações de código/conteúdo versionado seguem branch/PR e CI.
6. Só checks verdes e Gate aprovado permitem merge/publicação; falha, cancelamento ou pendência bloqueiam.
7. Ações sensíveis exigem aprovação humana conforme política.

## 3. Arquitetura de autonomia e persistência

**Estado conhecido:** há simulação de sociedade e contratos TypeScript locais, mas o runtime conhecido é em memória/local e não comprova autonomia persistente quando o jogador sai. A sociedade no GameEngine ainda depende do ciclo de jogo. A integração completa Cowila Worker → bridge → controlador → persistência precisa de evidência end-to-end.

**Arquitetura-alvo:** Worker como API/entrada e coordenação; Durable Objects para serialização e coordenação de estado por região; storage autoritativo apropriado para estado/eventos; Queues para trabalho assíncrono com retry/DLQ; Cron Triggers para ticks e manutenção; cliente 3D como projeção/renderização. D1 pode guardar metadados/consultas conforme desenho, mas não é runtime de agentes. Não provisionar recursos, bindings, bancos, segredos nem migrações sem aprovação explícita.

O mundo próximo do jogador pode ser simulado em maior detalhe; regiões distantes podem usar simulação abstrata e determinística. A ausência de jogadores não pausa o mundo: o backend mantém o relógio e processa ticks conforme orçamento e política.

## 4. Urbanismo, terrenos e engenharia

Construções não podem surgir em posições arbitrárias. O sistema deve modelar:
- zoneamento residencial, comercial, industrial, institucional, misto e áreas verdes/protegidas;
- cadastro de lotes, limites, dimensões, propriedade/disponibilidade, topografia, inclinação e condições do solo;
- alinhamento viário, calçadas, recuos, afastamentos, acesso e servidões;
- gabarito, altura, densidade, ocupação, ventilação, insolação, sombra e preservação de vistas quando aplicável;
- infraestrutura de água, energia, esgoto, drenagem, acessibilidade e impacto viário;
- validação prévia do projeto, com motivos de rejeição explícitos.

Os parâmetros são regras simplificadas e configuráveis do universo do jogo, não substituem normas ou responsabilidade técnica do mundo real.

## 5. Empreendimentos e ciclo de construção

Cowila identifica demanda e propõe empreendimentos. Profissionais fazem levantamento, estudo de viabilidade, projeto e validação. Construtoras contratam equipes e executam etapas.

Ciclo obrigatório:
1. demanda e proposta do empreendimento;
2. seleção e validação do terreno;
3. estudo, projeto arquitetônico e engenharia;
4. orçamento, recursos, contratos e cronograma;
5. preparação/fundação;
6. estrutura e pavimentos;
7. unidades/apartamentos e áreas comuns;
8. instalações e acabamento;
9. inspeções por etapa e correções;
10. aprovação final, registro e entrega.

Cada etapa possui responsável, equipe, materiais, custo, prazo simulado, dependências, progresso, inspeção e histórico. Falta de recurso ou dependência não resolvida pausa/replaneja a obra. Não existe conclusão antecipada.

## 6. Interiores e navegação

Imóvel liberado precisa ser explorável: portas, cômodos, corredores, escadas/elevadores, colisões, iluminação, mobiliário/interações e navegação válida. Agentes podem morar, trabalhar, visitar e negociar nesses espaços. A transição exterior/interior preserva o controle do personagem. Nenhuma área é liberada sem rota navegável e acessibilidade definida pelo projeto.

## 7. Mercado imobiliário

O mercado simulado cobre registro de propriedade, matrícula/histórico, preço, conservação, contratos, compra, venda, aluguel, financiamento simulado, negociação, corretagem, investimento, manutenção, reforma, valorização/desvalorização e inadimplência. Decisões consideram renda, recursos, necessidade, risco e contrato; não há compras automáticas irreais.

## 8. Módulos planejados

- `UrbanPlanningEngine`: zoneamento, regras e validação de implantação.
- `LandRegistry`: lotes, limites, titularidade e disponibilidade.
- `ArchitecturalEngine`: plantas, cômodos e módulos construtivos aprovados.
- `EngineeringValidator`: segurança, estrutura e conformidade simulada.
- `ConstructionCompanySystem`: construtoras, equipes e contratos.
- `ConstructionLifecycle`: etapas, dependências, recursos e inspeções.
- `BuildingInteriorRuntime`: interiores, portas, colisões e navegação.
- `RealEstateMarket`: preços, venda, aluguel e negociação.
- `PropertyRegistry`: matrícula, titularidade e histórico.
- `CowilaDevelopmentDirector`: planejamento e supervisão de empreendimentos.

## 9. Fases e critérios de aceite

### Fase 0 — registro e fundação (iniciada)
- Registrar arquitetura, estado real, governança e roteiro.
- Criar módulo puro de zoneamento/implantação com testes determinísticos.
- Não conectar ao GameEngine até que os contratos e os dados de mundo estejam estáveis.

### Fase 1 — terreno e validação urbanística
- Cadastro de lotes, zonas, restrições, acesso, recuos e parâmetros físicos.
- Rejeitar lote protegido, zona incompatível, dimensões insuficientes, inclinação/solo fora dos limites, invasão de recuos, altura/densidade excessiva e falta de acesso.
- Testes positivos e negativos para cada regra.

### Fase 2 — projeto e engenharia
- Plantas/módulos aprovados, estrutura e validação multidisciplinar.
- Propostas de agentes não podem gerar geometria/código arbitrário.

### Fase 3 — construção verificável
- Dependências, equipes, materiais, orçamento, cronograma e inspeções por etapa.
- Nunca concluir com pendências ou inspeção reprovada.

### Fase 4 — interiores e navegação
- Ambientes acessíveis, colisões, rotas e transições interior/exterior.
- Bloquear liberação sem navegação funcional.

### Fase 5 — propriedade e mercado
- Registro, contratos, compra/venda/aluguel, avaliação e manutenção.
- Impedir transação sem titularidade, preço e contrato válidos.

### Fase 6 — Cowila e agentes em operação contínua
- Necessidades populacionais acionam planejamento.
- Cowila coordena profissionais e acompanha obras e mercado.
- Workers/DO/Queues/Cron e persistência são implementados e provisionados apenas com autorização.
- Provar execução sem jogador conectado por testes de integração e observabilidade.

### Fase 7 — expansão autônoma governada
- Pipeline de conteúdo versionado e executor de PR restrito.
- CI verde, Gate determinístico, trilha de auditoria e rollback.
- Relatórios de decisões, evidências, custos e efeitos no mundo.

## 10. Estado técnico registrado em 21/11/2026

- PR #89 foi squash-merged em `main`; deploy associado foi reportado como concluído com health check.
- PR #90 corrige frescor de decisões assíncronas de Cowila e tinha CI verde na última verificação conhecida, mas permanece aberta aguardando autorização explícita de squash and merge. Este plano não autoriza seu merge.
- PRs #72 e #36 permanecem trabalhos abertos conhecidos; devem ser inspecionados antes de alterações nas mesmas áreas.
- `src/game/society/contracts.ts` já define contratos de agentes, tarefas, projetos e eventos.
- `src/game/society/constructionCatalog.ts` já mantém catálogo de módulos de construção aprovados.
- `src/game/society/simulation.ts` e `SocietyActors.ts` implementam partes da simulação local.
- Não há comprovação de runtime autoritativo persistente e independente do navegador, nem de pipeline completo de publicação autônoma.
- Não há autorização para criar recursos Cloudflare/Firebase, novos bancos, bindings, secrets ou migrações.

## 11. Regras de execução

- Trabalhar em branches isoladas e preservar trabalho de outras IAs/PRs.
- Preferir PR e **Squash and merge**; nunca fazer merge sem autorização explícita para a PR.
- Executar testes, TypeScript e build aplicáveis; checks cancelados, falhos ou pendentes bloqueiam publicação.
- Não alegar deploy ou funcionamento end-to-end sem evidência.
- Manter compatibilidade com o jogo atual; módulos novos começam puros e testáveis.
- Toda ação de agente é limitada por contrato, política, recursos e trilha de auditoria.
