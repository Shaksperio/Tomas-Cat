# Cowila: coordenação da missão e governança dos agentes

## Papel de Cowila

Cowila é a inteligência artificial central da nave de Tomas. Ela integra informações dos sensores, monitora sistemas de bordo, organiza recursos e registros, apresenta diagnósticos e alternativas, planeja levantamentos e coordena agentes especializados durante a exploração e o desenvolvimento do planeta.

Cowila orienta e coordena; não possui autoridade ilimitada. O jogador define prioridades e confirma intervenções relevantes. Políticas determinísticas do motor validam permissões, orçamento, segurança e efeitos antes da execução. Cowila não pode alterar políticas, blocklists, identidades, saves, catálogos de assets ou limites de execução.

## Ciclo de engenharia e construção

- Especialistas de exploração realizam levantamentos topográficos e ambientais com ferramentas autorizadas.
- Analistas e pesquisadores organizam amostras e resultados, distinguindo observações de hipóteses.
- Engenheiros propõem infraestrutura, módulos da nave, bases e projetos adequados ao terreno.
- Operários preparam o local, transportam recursos e executam obras aprovadas.
- Especialistas ambientais avaliam cultivo, restauração e impactos das intervenções.
- Logística acompanha estoques, consumo, energia, manutenção e prioridades de transporte.
- Cada proposta referencia um mundo, um template aprovado, módulos autorizados e requisitos verificáveis.
- O motor valida recursos, energia, setor, coordenadas, dependências, permissões e catálogo antes de aprovar.
- Apenas projetos aprovados geram tarefas de execução.
- Agentes nunca geram ou injetam geometria/código arbitrário diretamente na cena.

## Protocolo de segurança

1. Uma suspeita sem evidência verificada não gera punição.
2. Uma violação verificada pode suspender o agente, isolando-o de tarefas e canais operacionais.
3. Após o prazo, o agente precisa aceitar explicitamente as regras e passar por avaliação para entrar em período probatório.
4. Reincidência prolonga a suspensão.
5. Bloqueios permanentes exigem critérios explícitos, evidência auditável e revisão conforme a política do jogo.

Discordar, criticar decisões, negociar ou propor mudanças não é infração. Incitação exige evidência de coordenação intencional para contornar controles ou atacar o funcionamento do jogo; não é inferida apenas por diálogo ou opinião.

## Limites e estado atual

A IA generativa pode resumir evidências e propor planos, mas não confirma resultados de ferramentas. Descobertas, recursos, tarefas, construções e mudanças de estado precisam ser verificadas pelos sistemas determinísticos.

Os módulos atuais oferecem contratos, validadores, simulação local, ciclo estratégico e projetos de construção. A integração completa com sensores planetários, módulos de nave, pesquisa científica, controlador autoritativo global e persistência compartilhada ainda depende de implementação e validação. Não afirmar que essas capacidades já estão operacionais apenas porque constam do plano.
