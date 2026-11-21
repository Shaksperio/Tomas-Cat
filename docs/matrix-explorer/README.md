# Matrix Explorer — especificação de implementação

## Objetivo

Construir uma ferramenta reutilizável que observe e explore jogos por navegador. O primeiro adaptador é Tomas Vagabundo (React, Three.js e Vite).

O Explorer combina duas fontes:
1. **Percepção visual:** capturas de Chromium em resoluções desktop e móvel.
2. **Percepção estruturada:** snapshots expostos pelo adaptador do jogo, com região, posição, fase, condições e eventos.

A imagem registra o que foi renderizado; o snapshot informa o estado conhecido pelo motor. Nenhuma fonte isolada prova que o mundo foi integralmente compreendido.

## Primeiro incremento

- `fixture.html` / `fixture.ts`: adaptador local que instancia o GameEngine sem alterar o jogo publicado. O adaptador fornece HUD e inventário estruturado do mundo ativo (interagíveis, predadores, portões, águas, colisores, agentes e tarefas).
- Usa o UID sintético `matrix-explorer-fixture`, sem Firebase, conta real ou sincronização de saves remotos.
- A API de automação é uma allowlist: movimento limitado por vetor ou destino X/Z, parar, pular, interagir, atacar, miar, sonar e câmera.
- O runner usa A* em grade de 1,25 unidade, expandindo colisores e impedindo cortes diagonais por cantos bloqueados; a primeira missão percorre todos os waypoints até a loja ativa mais próxima, verifica chegada em até 2,5 unidades e confirma a abertura da loja pelo estado do motor.
- `run.mjs`: inicia Vite e Chromium, captura telas, verifica deslocamento, produz mapa SVG X/Z e relatórios JSON/Markdown com os dados vivos do motor.
- O workflow próprio valida em PR e armazena evidências; não publica o jogo.

## Segundo incremento — inventário estruturado

O adaptador consulta o objeto de mundo e a simulação social ativos do GameEngine por uma interface interna tipada e validada em runtime. Isso evita duplicar catálogos ou criar uma segunda simulação paralela. Se os membros internos mudarem ou deixarem de cumprir o contrato, a observação falha explicitamente.

O relatório registra:
- Interagíveis com ID, nome, tipo, posição, estado ativo e temporizador de respawn.
- Predadores, chefes, rivais territoriais e criaturas amigáveis com posição, vida e fase.
- Portões de fase, lagos, rios, zonas internas e quantidade de colisores.
- Habitantes simulados, profissão, posição, status, tarefa ativa, fila de tarefas e recursos comunitários; o runner compara o tick social inicial e final para comprovar que a simulação avançou durante a observação.
- Mapa SVG X/Z com marcadores e legenda, gerado a partir dos dados observados, incluindo a rota A* planejada.

Os dados sociais são um snapshot da simulação local executada pelo GameEngine, não uma prova de persistência entre sessões ou de servidor compartilhado.

## Memória persistente e histórico

O Explorer registra visitas, entidades descobertas, agentes, tarefas e observações em `memory.json`. O arquivo pode ser mantido entre execuções locais com `--memory caminho/para/matrix-memory.json`; a cópia do artefato facilita transferir o histórico para outros agentes. O formato está em `scripts/matrix-explorer/memory.schema.json`.

## Protocolo de missões e observações

Missões JSON com limites explícitos são aceitas por `--mission`; o contrato e um exemplo executável estão em `scripts/matrix-explorer/mission.schema.json` e `mission.example.json`. O relatório segue `observation.schema.json`. Consulte `docs/matrix-explorer/PROTOCOL.md` para o contrato de integração de outros agentes e adaptadores.

## Limites explícitos

- O fixture não contorna o login do jogo publicado. Ele instancia o motor localmente, em ambiente descartável e com identidade sintética.
- O primeiro relatório cobre inicialização, renderização e movimento. Não declara exploração completa, entendimento semântico de imagens, lojas, missões ou autonomia persistente.
- Chromium com SwiftShader verifica compatibilidade e fluxo, não desempenho real de GPU, toque físico ou experiência em todos os aparelhos.
- Não cria Worker, Durable Object, D1, Queue, serviço externo ou infraestrutura paga.
- Nenhum agente altera código ou publica conteúdo automaticamente nesta etapa.

## Critérios de aprovação

1. Chromium inicia o fixture sem autenticação Firebase.
2. GameEngine cria canvas WebGL e fornece snapshot de HUD real.
3. Movimento altera a posição observada e o comando de parada permite medir a desaceleração até repouso.
4. Inventário estruturado contém entidades reais do mundo ativo e IDs únicos.
5. Planejador A* encontra rota válida em torno dos colisores e o controlador percorre os waypoints com correção de câmera, confirmando chegada e interação com o ponto de interesse.
5. Mapa SVG corresponde às coordenadas observadas e inclui jogador, pontos de interesse, predadores e agentes.
6. Capturas desktop, pós-movimento e viewport móvel são produzidas.
7. Relatório contém ambiente, estados, inventário, rota, distância, eventos, erros e nomes das capturas.
8. CI da PR fica verde e os artefatos podem ser inspecionados.

## Próximas capacidades

1. Inventário de pontos de interesse e entidades, reconciliado com os catálogos do jogo.
2. Navegação por objetivos, com limites de tempo e recuperação de obstáculos.
3. Percepção visual assistida por modelo, ligada às capturas e com confiança explícita.
4. Memória persistente de locais e descobertas, com IDs estáveis e histórico.
5. Missões coordenadas pela Cowila, com propostas validadas e relatórios por agente.
6. Adaptadores para outros jogos por contratos de observação e ações próprios.

## Segurança e integridade

- O adaptador expõe somente ações permitidas; não aceita JavaScript arbitrário de uma missão.
- Identidade sintética e armazenamento do navegador são descartáveis.
- Tokens, cookies, sessões e dados pessoais não entram nos relatórios.
- Adaptação a conta real ou jogo publicado exige autorização e autenticação própria.
