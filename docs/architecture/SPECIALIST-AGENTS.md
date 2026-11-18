# Agentes especialistas — Tomas Vagabundo

## Origem e licença

A organização por especialidades foi inspirada no repositório
[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents), distribuído
sob licença MIT. O Tomas não incorpora os arquivos de prompt do projeto de origem:
os perfis abaixo são uma adaptação própria para React, TypeScript e Three.js e para
as profissões que já existem na simulação. Consulte a licença MIT do projeto original
antes de redistribuir trechos dele.

## O que foi integrado

- Catálogo tipado dos oito papéis profissionais já presentes na sociedade.
- Princípios operacionais e lista de tarefas permitidas por profissão.
- Validação de propostas: identidade, tick, prioridade, setor, alvo, recursos,
  disponibilidade do habitante e ausência de trabalho duplicado.
- Orquestrador local determinístico que gera propostas para habitantes ociosos.
- Caminho de fallback sem provedor generativo, rede ou aleatoriedade.

## Limites de segurança

Os especialistas não recebem ferramentas arbitrárias, não executam código, não
alteram geometria, não teleportam habitantes, não concedem recursos e não editam
saves. Uma proposta aceita significa apenas que passou pelas políticas locais;
ela ainda precisa ser encaminhada a um controlador autoritativo para atribuição,
consumo atômico de recursos e emissão de eventos.

A Cowila é uma coordenadora estratégica, não um executor irrestrito. O ciclo
implementado nesta fase é deliberadamente local e determinístico. Não existe ainda
conexão com um LLM, Cloudflare Worker, Durable Object, D1 ou simulação offline
compartilhada.

## Perfis disponíveis

| Perfil | Profissão existente | Responsabilidade |
|---|---|---|
| Engenheiro comunitário | engineer | levantamento, projeto e reparo |
| Operário de construção | worker | coleta, transporte e construção |
| Guardião comunitário | agent | patrulha, investigação e mediação |
| Agricultor | farmer | cultivo e colheita |
| Lenhador | lumberjack | produção de madeira |
| Minerador | miner | extração de pedra |
| Carpinteiro | carpenter | transformação de madeira excedente |
| Comerciante | merchant | comércio e equilíbrio de estoque |

## Arquivos

- `src/game/society/agents/catalog.ts`
- `src/game/society/agents/policies.ts`
- `src/game/society/agents/orchestrator.ts`
- `src/game/society/agents/agents.test.ts`

Os habitantes exibem sobre a cabeça uma etiqueta de atividade em português, atualizada quando a tarefa muda e diferenciada para tarefas bloqueadas. Isso torna observável no mundo 3D o trabalho atribuído sem acoplar a simulação ao Three.js.

A integração local agora converte propostas aprovadas em tarefas da fila autoritativa
por IDs determinísticos. O scheduler existente continua responsável por atribuição,
dependências, deslocamento, consumo de recursos, conclusão e eventos. A execução é
idempotente por identidade da proposta e continua sem LLM/rede.

Próximas etapas: expor um relatório de ciclo para observabilidade/HUD; adicionar
memória resumida e adaptador Cowila com contexto mínimo e saídas estruturadas; depois
conectar persistência compartilhada. Nenhuma chamada generativa deve ocorrer por frame.
