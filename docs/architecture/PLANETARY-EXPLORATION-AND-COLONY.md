# Arquitetura de exploração e desenvolvimento planetário

## Objetivo

Definir como o Mundo Virtual de Tomas sustenta uma experiência persistente de exploração espacial, sobrevivência, pesquisa e construção de um planeta habitável. A ficção começa após a chegada de Tomas em uma nave a um planeta inóspito. A nave é a primeira base; o planeta é o território que o jogador irá conhecer e transformar.

Este documento descreve sistemas de jogo e simulação. Não pressupõe que a realidade ficcional seja uma simulação dentro da própria história.

## Camadas do Mundo Virtual

1. **Planeta e ambiente:** regiões, setores, relevo, clima, atmosfera, água, minerais, riscos ambientais, fauna, habitats, territórios nativos e condições de habitabilidade.
2. **Identidade adaptativa de Tomas:** protagonista androide híbrido que chega em sua forma sintética e pode mapear organismos vivos para assumir formas orgânicas compatíveis. A primeira forma mapeada é a do gato nativo encontrado no início da aventura; essa forma corresponde ao modelo felino atual do jogo.
3. **Exploração e sensores:** mapa progressivamente revelado por sondas, sensores da nave, equipamentos e expedições. Diferenciar dados observados, estimativas e áreas desconhecidas.
4. **Nave e infraestrutura:** energia, suporte à vida, armazenamento, oficina, laboratório, comunicações, módulos habitacionais, sondas e veículos. A nave começa como abrigo e centro de operações.
5. **Recursos e produção:** coleta, extração, transporte, transformação, armazenamento, consumo, manutenção e custos energéticos.
6. **Pesquisa e tecnologia:** amostras, experimentos, projetos, requisitos, desbloqueios e validação de resultados. Pesquisa não deve conceder recursos ou construções sem custos.
7. **Construção e ecossistemas:** projetos tipados, terrenos aprovados, módulos autorizados, etapas de obra, cultivo, restauração ambiental e habitats.
8. **Agentes e automação:** especialistas com funções, ferramentas e permissões delimitadas. Eles observam e propõem; regras determinísticas validam e executam tarefas.
9. **Memória e persistência:** estado por mundo, eventos idempotentes, snapshots versionados e recuperação após desconexão.
10. **Percepção e interface:** painéis da nave, mapa, sensores, inventário, estado dos agentes, projetos e alertas da missão.

## Mapeamento orgânico e transformação de Tomas

Tomas é um androide híbrido cuja forma original é sintética. O mapeamento de um organismo vivo deve ser uma mecânica explícita, com etapas verificáveis: aquisição de amostra ou leitura biométrica autorizada, análise, verificação de compatibilidade, registro no catálogo de formas e ativação da transformação. O sistema não copia consciência, memória ou personalidade do organismo.

O primeiro encontro narrativo ocorre após o pouso: Tomas enfrenta um gato nativo e, ao vencer, completa o mapeamento que permite assumir a forma felina já utilizada pelo personagem no jogo. A transformação deve preservar identidade, inventário, progressão e save do jogador. O modelo felino atual é a representação visual dessa primeira forma adaptativa, não a forma original do androide.

Cada forma futura deve ter requisitos e limitações próprios e passar por validação do motor. A forma felina oferece discrição e acesso mais seguro a áreas habitadas, mas não torna Tomas invisível nem garante aceitação pelos nativos.

## Habitats, territórios e combate

Os habitantes nativos possuem habitats e territórios próprios. A IA de cada espécie ou grupo deve avaliar distância, comportamento de Tomas, ameaças ao habitat, disputa por recursos e histórico local. A reação pode variar entre observação, alerta, fuga, defesa ou confronto, conforme regras determinísticas e dados do mundo.

O modo de batalha existente continua sendo usado quando houver oponentes que efetivamente lutarão para defender um território específico. A entrada em batalha deve preservar o fluxo ATB, comandos, câmera, animações, recompensas e consequências já implementados. O conflito precisa manter vínculo com a região e o estado do habitat; não converter toda fauna em inimigos obrigatórios.

## Ciclo de uma missão de exploração

1. Cowila recebe ou agenda uma solicitação de levantamento.
2. Um agente ou equipamento autorizado coleta dados com ferramentas definidas.
3. O resultado é registrado como observação, com localização, tempo, instrumento e nível de confiança.
4. Cowila sintetiza os dados e apresenta hipóteses, riscos e alternativas.
5. Um projeto pode ser proposto com requisitos explícitos de materiais, energia, tempo e permissões.
6. O motor determinístico valida terreno, recursos, limites, dependências e autorização.
7. As tarefas são distribuídas aos agentes e executadas pela simulação.
8. O motor confirma o resultado, atualiza o mundo e registra eventos.
9. Cowila comunica o que foi concluído, o que falhou e o que ainda exige decisão.

Nenhuma resposta de LLM, por si só, confirma uma descoberta, concede materiais ou marca uma obra como concluída.

## Habitabilidade progressiva

A habitabilidade é um conjunto de condições mensuráveis e não uma transformação instantânea. Cada região pode acompanhar, conforme os sistemas existentes evoluírem:

- pressão, temperatura e composição atmosférica;
- radiação, toxicidade e exposição a riscos;
- disponibilidade e qualidade da água;
- energia acessível e estabilidade de fornecimento;
- abrigo, suporte à vida e capacidade habitacional;
- solo, nutrientes e condições para cultivo;
- estabilidade ecológica e impacto das intervenções.

Os valores e limiares precisam ser definidos no código e cobertos por testes. Não assumir que uma única máquina torna todo o planeta habitável.

## Nave como base inicial

A nave deve evoluir em módulos, respeitando o escopo implementado. O primeiro conjunto funcional pode priorizar painel de missão, sensores, energia, inventário de carga, laboratório e oficina. Sistemas não implementados devem aparecer como indisponíveis ou bloqueados por progressão, não como recursos ficticiamente operacionais.

Falhas, alcance, capacidade, manutenção e consumo energético tornam a nave uma parte jogável da experiência, sem retirar do jogador a capacidade de decidir.

## Cowila e agentes

Cowila é a IA central de bordo. Ela integra dados da nave, organiza a missão e coordena especialistas. Agentes especializados executam apenas tarefas permitidas por contratos e políticas. A arquitetura separa:

- **Observação:** coleta de dados e eventos verificados.
- **Planejamento:** propostas, hipóteses e prioridades.
- **Validação:** regras determinísticas, permissões, orçamento e dependências.
- **Execução:** tarefas atribuídas ao runtime autorizado.
- **Verificação:** confirmação independente do resultado e registro.

A IA generativa não controla movimentos nem decide cada frame. Se o provedor estiver indisponível, rotinas determinísticas mantêm as funções essenciais.

## Isolamento e autonomia

Cada `worldId` deve manter relógio, recursos, projetos, construções, eventos e estado persistente próprios. Transições entre regiões ou mundos não podem misturar estados por acidente.

A região próxima pode usar simulação detalhada; regiões distantes podem avançar em passos abstratos, determinísticos e limitados. O avanço offline precisa de limites explícitos para impedir saltos ilimitados ou consumo retroativo inesperado.

## Compatibilidade com o jogo existente

Esta mudança redefine o contexto da aventura, não apaga os sistemas existentes. Preservar o modo de batalha e seu acionamento em conflitos territoriais, o modelo felino atual de Tomas, tarefas, itens, inventário, GPS, progressão, construção, portais, agentes e sistemas de sociedade já implementados. A primeira transformação explica por que Tomas aparece como o gato atual. Adaptar a apresentação e a progressão de forma incremental, sem quebrar IDs de saves ou contratos existentes.

## Estado conhecido e limites

O repositório já contém simulação de sociedade, catálogo de construções aprovado, alocação de terreno, projetos, tarefas de obra, runtime de agentes e restauração de placements. Esses sistemas foram originalmente concebidos para comunidades e estruturas existentes; sua adaptação para uma colônia planetária precisa ser incremental e testada.

Não declarar como implementados, sem prova no código e no CI:

- física planetária ou terraformação;
- nave pilotável, módulos de nave ou painel de sensores;
- análise real de atmosfera ou habitabilidade;
- mineração planetária e cadeia industrial completa;
- construção livre ou geração arbitrária de estruturas por IA;
- persistência autoritativa compartilhada, mundo evoluindo com o jogo fechado ou multiplayer global.

## Regras de segurança e compatibilidade

- O cliente 3D apresenta o estado, mas não é autoridade para recursos, inventário ou conclusão de obras.
- Agentes não podem injetar geometria, código ou mutações livres.
- Projetos usam catálogos e módulos aprovados.
- Recursos são consumidos atomicamente e eventos são idempotentes.
- Saves e APIs existentes devem permanecer compatíveis; migrações precisam de testes de leitura de saves antigos.
- Toda expansão começa por contratos puros e testes antes da integração com o motor.
