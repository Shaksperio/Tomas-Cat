# Skills determinísticas da sociedade

## Princípio

As Skills do Tomas são procedimentos versionados em TypeScript, não prompts livres. O scheduler local as consulta sem rede e continua operando quando Cowila LLM ou Worker estão indisponíveis.

## Formato

Cada Skill define identidade e versão, profissão, gatilhos determinísticos (`whenToUse`), sequência de passos, armadilhas, verificações, tarefas permitidas e toolset. `listSocietySkills()` expõe apenas metadados; `getSocietySkill(id)` carrega a definição completa sob demanda (progressive disclosure).

## Skills iniciais

- `engineer.survey-and-design`: levantamento, projeto e preparação.
- `worker.construction-execution`: coleta, transporte e construção.
- `agent.security-and-mediation`: patrulha, investigação e mediação.
- `farmer.food-security`: segurança alimentar.
- `lumberjack.sustainable-forestry`: manejo florestal.
- `miner.resource-extraction`: extração mineral.
- `carpenter.material-processing`: processamento de materiais.
- `merchant.community-economy`: economia comunitária.

## Autorização

O orquestrador seleciona Skill por profissão, disponibilidade e gatilhos baseados no snapshot. A tarefa escolhida precisa constar simultaneamente na Skill e no perfil do especialista; depois passa por `authorizeSpecialistProposal`. O motor determinístico continua sendo a autoridade final. `skillId` é proveniência e telemetria, nunca uma permissão.

## Limites desta fase

- Os passos descrevem a cadeia de trabalho; esta fase seleciona o primeiro passo elegível. Cadeias reais de construção continuam usando o scheduler de projetos e suas dependências existentes.
- Memória ainda não persiste entre reinicializações do jogo/Worker.
- O learning loop nesta etapa ainda não altera Skills ou prioridades automaticamente.
- Não há execução genérica de ferramentas nem código gerado por agentes.
- Novas versões de Skills exigem revisão e testes.

## Próximas entregas

1. Associar `skillId` aos eventos de conclusão/falha e criar métricas idempotentes por versão.
2. Usar métricas como nudges determinísticos sem permitir autoedição de código.
3. Persistir memória e métricas no save versionado; depois avaliar Durable Objects/D1 com migração aprovada.
4. Ligar os toolsets a executores tipados e auditados.
5. Implementar propostas de Skills em sandbox, com testes e aprovação antes da publicação.
