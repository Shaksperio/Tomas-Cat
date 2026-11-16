# Cowila: governança dos agentes e expansão do mundo

## Autoridade

Cowila é a autoridade estratégica central: define prioridades, coordena equipes, avalia riscos e recomenda decisões. A aplicação de permissões e sanções é responsabilidade de políticas determinísticas do motor. Agentes não podem alterar políticas, blocklists, identidades, saves, catálogos de assets ou limites de execução.

## Engenharia e obras

- Engenheiros exploram, levantam terrenos, projetam bairros e propõem novos cenários.
- Operários preparam o terreno, transportam recursos e executam construção, pontes e infraestrutura.
- Cada proposta de expansão referencia um mundo jogável, um template de cenário aprovado e módulos 3D autorizados.
- O motor valida recursos, setores, coordenadas, dependências e catálogo antes de aprovar.
- Apenas projetos aprovados podem gerar tarefas de execução dos operários.
- Agentes nunca geram ou injetam geometria/código arbitrário diretamente na cena.

## Disciplina e recuperação

1. Uma suspeita sem evidência verificada não gera punição.
2. Uma violação verificada suspende o agente, isolando-o de tarefas e canais operacionais.
3. Após o prazo, o agente precisa aceitar explicitamente as regras e passar por avaliação para entrar em período probatório.
4. Reincidência prolonga a suspensão.
5. Duas ocorrências verificadas de incitação deliberada para coordenar violações levam a bloqueio permanente da identidade.

Discordar, criticar decisões, negociar ou propor mudanças não é infração. Incitação exige evidência de coordenação intencional para contornar controles ou atacar o funcionamento do jogo; não é inferida apenas por diálogo ou opinião.

## Escopo e limites atuais

Os módulos desta fase implementam contratos e validadores puros. Ainda precisam ser ligados ao controlador autoritativo da simulação, ao gerenciador de cenas e à persistência global. O bloqueio é global por identidade quando o registro/blocklist global é fornecido; sem persistência compartilhada, não se deve alegar que já bloqueia em todos os servidores ou mundos. Cowila generativa, observabilidade, revisão de incidentes e interface administrativa também são etapas de integração.
