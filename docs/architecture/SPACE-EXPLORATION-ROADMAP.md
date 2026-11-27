# Roteiro de exploração espacial — Tomas Vagabundo

**Status:** arquitetura proposta em revisão; não implementada no runtime.  
**Tarefa:** T-224 — branch `codex/space-exploration-foundation`.  
**Decisão do autor (2026-11-26):** incluir todas as áreas de um jogo de exploração espacial, com implementação progressiva e validação por etapa.

## 1. Visão do jogo

Tomas deve evoluir de uma aventura iniciada em um planeta para uma experiência de exploração espacial contínua: descobrir sistemas estelares, pousar em planetas, investigar ecossistemas, coletar recursos, desenvolver a nave, construir bases, encontrar civilizações e realizar expedições. Cowila é a inteligência central da nave e coordena agentes especializados.

A referência de escala e liberdade é *No Man's Sky*, não uma especificação para copiar sua implementação, conteúdo, arte, interface ou propriedade intelectual. Tomas mantém identidade própria: protagonista androide híbrido com formas biológicas mapeadas, exploração científica e Cowila como copiloto operacional.

## 2. Princípios não negociáveis

1. **Evoluir sem substituir:** preservar React, TypeScript, Three.js, Vite, os sistemas de gameplay e os contratos já existentes.
2. **Progresso incremental:** cada etapa deve ser jogável, testável, reversível e compatível com saves anteriores.
3. **Geração procedural determinística:** mesmo seed + mesma versão de regras = mesmo mundo. Registrar versão do gerador e parâmetros necessários para reconstrução.
4. **Simulação em camadas:** detalhe alto perto do jogador; regiões distantes em passos abstratos, com limites de custo.
5. **Autoridade:** cliente apresenta e solicita ações; regras determinísticas validam recursos, inventário, combate, viagens e construção.
6. **Cowila consultiva e governada:** agentes observam e propõem; políticas, permissões e contratos validam antes de executar. Nenhuma LLM controla cada frame ou escreve estado autoritativo diretamente.
7. **Degradação segura:** funções essenciais continuam com lógica local quando rede ou provedor de IA estiver indisponível.
8. **Desempenho móvel:** orçamento explícito de memória, draw calls, entidades ativas, streaming e frequência de simulação.
9. **Originalidade:** inspiração em gênero e escala, sem reproduzir assets, nomes, mapas, música, textos ou interfaces de outros jogos.
10. **Verdade de implementação:** catálogo, documentação e interface distinguem recursos implementados, planejados e indisponíveis.

## 3. Sistemas abrangidos

### 3.1 Universo e geração procedural

- Galáxias, setores, sistemas estelares, estrelas, planetas e luas.
- Catálogo navegável com coordenadas/IDs estáveis, distâncias, sementes e descoberta.
- Parâmetros planetários: gravidade, raio, rotação, órbita, temperatura, atmosfera, água, radiação e composição.
- Classes de mundo e biomas derivados de parâmetros, não de escolhas aleatórias desconexas.
- Geração por seed, versionamento do algoritmo, testes de invariantes e capacidade de reconstruir locais descobertos.
- Descobertas persistentes e registro de quem mapeou cada local.
- Streaming de regiões e descarte seguro de cenas fora de uso.

### 3.2 Nave e viagem espacial

- Nave como primeira base, laboratório, oficina, armazenamento e centro de missão.
- Sistemas modulares: energia, combustível/propulsão, suporte à vida, navegação, sensores, comunicações, carga e reparos.
- Controles de pilotagem, orientação, aceleração, frenagem e limites físicos compreensíveis.
- Decolagem, voo atmosférico, saída para espaço, navegação entre corpos, aproximação e pouso.
- Viagem longa com transição controlada e carregamento de destino; não exigir simular cada quilômetro.
- Dano, manutenção, consumo e upgrades com regras determinísticas.
- Interface de nave e mapa galáctico, com rota, alcance, risco e destino.

### 3.3 Planetas, biomas e ecossistemas

- Terreno procedural com regiões, elevação, água, cavernas, ilhas e pontos de interesse.
- Atmosfera, céu, ciclo dia/noite, clima e fenômenos ambientais.
- Flora e fauna com habitats, necessidades, ciclos, alimentação, fuga, territorialidade e predação.
- Espécies pacíficas, defensivas, predadoras, raras e especiais, sem transformar toda criatura em inimigo.
- Sensores e scanner para observações, amostras, classificação e catálogo científico.
- Ecologia com regras de população e recursos; simulação distante simplificada e limitada.
- Biomas e espécies devem ser consistentes com as condições ambientais e a seed.

### 3.4 Sobrevivência, recursos e construção

- Coleta, mineração, pesca e amostragem, com localização e quantidade verificáveis.
- Inventário, carga da nave, armazenamento de bases e cadeia de transformação.
- Ferramentas, trajes, módulos, fabricação e manutenção.
- Sobrevivência ligada a riscos ambientais e suporte à vida.
- Bases e postos científicos construídos com catálogo de módulos aprovados, terreno validado, custos e etapas.
- Habitabilidade gradual, mensurável e regional; nenhuma máquina torna automaticamente um planeta inteiro habitável.
- Cultivo e restauração ecológica com efeitos e limites observáveis.

### 3.5 Civilizações, comércio e missões

- Povos e grupos com culturas originais, assentamentos, profissões, necessidades e relações.
- Estações, postos, rotas de comércio e pontos de encontro.
- Economia com estoque, oferta, demanda, produção, transporte e preços dentro de limites.
- Missões científicas, exploração, resgate, diplomacia, comércio, construção e defesa.
- Reputação e consequências persistentes; escolhas do jogador influenciam relações sem eliminar agência dos NPCs.
- Conflitos territoriais ligados a contexto e comportamento, mantendo o combate ATB existente onde aplicável.

### 3.6 Combate e perigos

- Ameaças ambientais, fauna defensiva, rivais, segurança de instalações e perigos espaciais.
- Combate terrestre e ATB como evolução do sistema já existente.
- Confrontos espaciais somente após existir navegação e voo confiáveis.
- Equipamentos e habilidades com custos, cooldowns e regras testadas.
- Rotas não violentas: fuga, negociação, furtividade, mediação e pesquisa quando fizer sentido.

### 3.7 Expedições e progressão

- Expedições com objetivos, duração, recursos, riscos e retorno.
- Diário científico e atlas de planetas, espécies, recursos e locais.
- Descobertas com autoria, evidência, instrumento, horário e nível de confiança.
- Marcos, coleções, recompensas e desbloqueios persistentes.
- Eventos sazonais ou comunitários somente quando existir infraestrutura apropriada; não depender deles para o ciclo central.

### 3.8 Cowila e agentes especializados

- Cowila como copiloto: contexto de nave, estado da missão, navegação, riscos e recomendações.
- Especialistas: cosmologia, navegação, pilotagem assistida, geologia, biologia, clima, engenharia, construção, economia, diplomacia, segurança e exploração.
- Cada agente possui identidade, ferramentas permitidas, orçamento, escopo e trilha de auditoria.
- Ciclo obrigatório: observar → propor → validar → autorizar → executar → verificar → registrar.
- O jogador mantém controle manual e pode interromper assistência; operações irreversíveis, compras relevantes e compromissos de alto risco exigem aprovação.
- Fallback determinístico se IA/rede estiver indisponível.

## 4. Arquitetura conceitual

Separar os domínios para que a expansão não transforme `GameEngine.ts` em um monólito:

- **Cosmos:** catálogo de galáxias/sistemas/corpos, seeds e coordenadas.
- **Generation:** regras versionadas para planetas, biomas, terreno, flora, fauna e pontos de interesse.
- **World lifecycle:** construção, ativação, streaming, cache, descarte e restauração de cenas por `WorldId`.
- **Navigation:** mapa, rotas, órbitas abstratas, aproximação e transições.
- **Ship:** estado, módulos, combustível/energia, manutenção e comandos.
- **Planet environment:** clima, atmosfera, gravidade, água e riscos.
- **Ecology:** espécies, habitats, população e comportamento.
- **Discovery:** scanner, amostras, observações e atlas.
- **Resources & crafting:** recursos, inventários, armazenamento, receitas e transações.
- **Colonies:** bases, obras, habitabilidade e restauração ambiental.
- **Civilizations:** habitantes, economia, diplomacia, missões e conflitos.
- **Expeditions:** objetivos, planejamento, diário e recompensas.
- **Cowila orchestration:** propostas e agentes, submetidos a políticas e interfaces de comando validadas.
- **Persistence:** saves versionados por mundo, eventos idempotentes e, futuramente, autoridade de servidor.

Os módulos de domínio devem começar com contratos TypeScript puros e testes. A integração com Three.js/GameEngine ocorre por adaptadores estreitos. A geração procedural deve ser separada da renderização para permitir testes sem WebGL.

## 5. Sequência de implementação proposta

A sequência abaixo é um plano de engenharia para esta nova visão; não altera automaticamente o roteiro fixo já aprovado em `AGENTS.md`. Dependências e pontos de integração devem ser conciliados com o autor e com os donos de tarefas existentes antes de editar arquivos reservados.

| Etapa | Entrega verificável | Critério para avançar |
|---|---|---|
| 0. Auditoria e contratos | Inventário do que existe, lacunas, IDs e compatibilidade; contratos de Cosmos/Planet/Seed | Sem duplicar sistemas existentes; testes de determinismo e invariantes |
| 1. Primeiro planeta jogável | Planeta procedural limitado, biomas coerentes, pontos de interesse e descoberta | Seed reproduz o mesmo mundo; exploração e retorno continuam jogáveis |
| 2. Nave funcional inicial | Estado da nave, painel, energia/carga e sequência de decolagem/pouso controlada | Ciclo planeta → nave → planeta com save/restore |
| 3. Voo atmosférico e espaço local | Controles, transições e navegação entre corpo e órbita | Sem queda de frames crítica; transições sem perda de estado |
| 4. Segundo corpo celeste | Lua ou planeta independente, WorldId, carregamento, retorno e descoberta | Dois destinos jogáveis com isolamento de saves |
| 5. Ecossistema científico | Scanner, espécies, habitats, catálogo e amostras | Observações rastreáveis e população limitada por regras |
| 6. Recursos e colônia | Mineração, cadeia de produção, base modular e habitabilidade | Custos atômicos, construção validada e save retrocompatível |
| 7. Civilizações e comércio | NPCs, assentamentos, economia e missões | Simulação determinística e limites de desempenho |
| 8. Combate ampliado | Perigos terrestres e espaciais integrados aos sistemas existentes | Regras testadas; ATB preservado; fuga/alternativas |
| 9. Expedições e atlas | Diário, objetivos, descobertas e progressão | Fluxo completo com recompensas verificadas |
| 10. Cowila copiloto ampliada | Agentes de bordo, planejamento e assistência de navegação | Políticas, aprovações, logs, fallback e interrupção pelo jogador |
| 11. Persistência de universo | Autoridade remota, continuidade limitada e sincronização | Segurança, concorrência, recuperação e custos comprovados |
| 12. Escala e otimização | Streaming, LOD, budgets e testes de longa duração | Perfil em dispositivos móveis e critérios de desempenho atendidos |

## 6. Auditoria inicial do repositório (fonte: `main` consultada em 2026-11-26)

### Já documentado ou presente na base

- React, TypeScript, Three.js e Vite; motor 3D e mundo atual.
- Catálogo `WorldId`, catálogo de mundos e `WorldSceneManager`.
- Cidade da Quarentena como mundo jogável; Arquipélago de Cristal possui construtor procedural, mas sua disponibilidade como mundo jogável deve ser confirmada no código atual.
- Portais e contratos de viagem, com persistência de posição por mundo; não equivalem, por si só, a voo espacial ou viagem galáctica integrada.
- Sociedade local, agentes especialistas, tarefas, projetos e construções com validação determinística.
- Sobrevivência, água, clima, ciclo do dia, inventário, GPS, missões e combate ATB.
- Abertura cinematográfica e continuidade de primeiro contato estão em PRs abertas, não devem ser tratadas como integradas na `main` sem merge verificado.
- A PR #98 contém uma proposta narrativa/arquitetural planetária, mas permanece aberta em branch própria. Este roteiro não a incorpora automaticamente nem altera seus arquivos.

### Ainda não comprovado como funcional

- Universo/galáxia procedural navegável.
- Nave pilotável, decolagem, voo atmosférico, órbita e pouso em gameplay.
- Geração procedural de planetas em runtime com seeds estáveis.
- Ecossistemas planetários em escala, mineração e cadeia industrial espacial.
- Estações/civilizações espaciais, comércio interplanetário e combate espacial.
- Persistência autoritativa compartilhada e universo avançando com todos os jogadores desconectados.

A lista é uma auditoria documental preliminar; cada item deverá ser confirmado por leitura de código, testes e execução no navegador antes de virar afirmação de produto.

## 7. Compatibilidade e limites de escopo

- Não alterar `GameEngine.ts`, `worldBuilder.ts`, `worldCatalog.ts`, `WorldSceneManager`, `GameHUD.tsx`, `TitleScreen.tsx`, saves ou Workers nesta tarefa documental.
- Respeitar as reservas de Claude, Manus, Grok e demais agentes registradas no quadro.
- Não criar novos bancos, bindings, Workers, secrets ou custos de infraestrutura nesta fase.
- Não usar serviços pagos nem gerar mídia paga sem autorização explícita.
- Não reordenar ou substituir o roteiro fixo de `AGENTS.md` por decisão unilateral. Este documento registra a visão aprovada e propõe como executá-la em incrementos, sujeito à conciliação com o roteiro já existente.
- Toda futura mudança de runtime deve reivindicar uma tarefa específica, reservar caminhos exatos, incluir testes e ser validada em GitHub Actions antes de ser considerada concluída.
