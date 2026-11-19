# Runtime multiagente da Cowila — inspirado no Hermes Agent

## Objetivo

Adotar padrões úteis do Hermes Agent sem embutir seu runtime Python no cliente React/Three.js nem no Cloudflare Worker. O runtime do jogo permanece TypeScript, pequeno, auditável e compatível com o motor atual.

## Entregue nesta primeira etapa

- **Skills versionadas:** cada profissão recebe uma skill identificada e versionada, com missão, tipos de tarefa permitidos e capacidades de ferramenta.
- **Catálogo de capacidades:** ferramentas são descritas por identificadores estáveis e efeitos `read` ou `propose`. Nesta etapa, o catálogo não executa código arbitrário.
- **Delegação limitada:** Cowila pode recomendar até três tarefas por ciclo; cada proposta só pode delegar um nível, para agente ocioso e tarefa autorizada simultaneamente pela skill e pela permissão do agente.
- **Auditoria:** o Worker devolve `delegationAudit` com agente, skill, tarefa, profundidade, decisão e motivo. Propostas recusadas não são encaminhadas ao jogo.
- **Compatibilidade:** os campos anteriores `tick`, `brief`, `proposals` e `model` permanecem. Os novos campos são aditivos.

## Limites de segurança

1. LLM não executa ferramentas nem altera o estado do mundo.
2. O catálogo de ferramentas é uma declaração de capacidades, não um executor de shell, SQL ou rede.
3. O motor determinístico continua validando tarefas, recursos, setor, estado do agente e concorrência.
4. Delegação recursiva é bloqueada; não há criação autônoma ilimitada de agentes.
5. A indisponibilidade do provedor não deve interromper a simulação local.
6. Skills são código versionado e revisado. O modelo não pode editar nem instalar skills em produção.

## Estado da memória

O jogo já possui memória resumida baseada em eventos (`agentMemory.ts`), mas ela depende do ciclo de salvamento da simulação. Esta entrega **não** afirma que existe memória durável compartilhada entre reinicializações do Worker. Memória persistente de sessões, memória compartilhada entre regiões, recuperação após falhas e scheduler durável exigem armazenamento persistente (por exemplo, Durable Objects ou D1) e desenho de migração separado. Não foi criado binding nem banco Cloudflare nesta etapa.

## Próximas etapas

1. Persistir memória individual e compartilhada com versionamento, TTL, limites e proteção contra prompt injection.
2. Criar executor de ferramentas tipadas, cada uma com schema, autorização e teste; nenhuma ferramenta de mutação deve contornar o motor.
3. Implementar delegação assíncrona com leases, idempotência, timeout e orçamento de tokens/custo.
4. Adicionar scheduler durável para ciclos offline, com avanço lógico e recuperação idempotente.
5. Criar fluxo de propostas de novas skills: rascunho isolado, testes, revisão e publicação controlada.
6. Integrar telemetria e painel de auditoria para o criador.

## Critérios de aceitação desta etapa

- Skills desconhecidas e tarefas não autorizadas são recusadas.
- Agentes ocupados não recebem delegação.
- Profundidade acima de um nível é recusada.
- Uma identidade recebe no máximo uma proposta no ciclo.
- Resposta mantém contrato antigo e inclui trilha de auditoria.
- Testes unitários cobrem skills, permissões, profundidade e disponibilidade.
