# Matrix Explorer — protocolo para agentes

## Objetivo

Permitir que diferentes IAs solicitem uma exploração limitada e recebam evidências em um formato comum. A IA não injeta código no navegador: ela envia uma missão JSON validada. O executor mantém a autoridade sobre movimento, navegação, interação e limites.

## Mission v1

O contrato formal está em `scripts/matrix-explorer/mission.schema.json`. Nesta versão, a missão implementada é `visit_shop`.

Exemplo:

```json
{
  "version": 1,
  "id": "visit-emporio",
  "goal": {
    "type": "visit_shop",
    "targetKind": "shop",
    "targetId": "shop-emporio"
  },
  "constraints": {
    "maxDurationSeconds": 60,
    "maxWaypoints": 40,
    "sprint": false,
    "interact": true
  }
}
```

Execução local:

```bash
npm install
npm install --prefix scripts/matrix-explorer
npm exec --prefix scripts/matrix-explorer -- playwright install chromium
node scripts/matrix-explorer/run.mjs --mission scripts/matrix-explorer/mission.example.json
```

Se `targetId` for omitido, o executor escolhe a loja ativa mais próxima. A missão é rejeitada se houver propriedades desconhecidas, tipo não suportado, limites fora do intervalo ou destino inexistente.

### Limites e autoridade

- Duração: 10–120 segundos.
- Waypoints: 1–80.
- Sprint e interação são opções booleanas.
- O executor usa A* 8-direções sobre grade de 1,25 m, colisores expandidos e proteção contra corte diagonal.
- Ações permitidas: mover para destino X/Z, parar e interagir com o ponto de interesse validado.
- Não são aceitos JavaScript, comandos de console, URLs, tokens, callbacks ou código arbitrário enviados pela missão.
- O executor encerra se o personagem não progride, se o prazo acaba ou se o destino não pode ser validado.

## Observation Bundle v1

O contrato está em `scripts/matrix-explorer/observation.schema.json`. Cada execução produz:

- `report.json`: missão, ambiente, estado inicial/final, inventário, rota, interação, ticks sociais, erros e referências de evidência.
- `report.md`: resumo legível.
- `world-initial.png`, `world-after-movement.png`, `world-mobile.png`: capturas do jogo.
- `world-map.svg`: coordenadas X/Z, pontos de interesse, habitantes, predadores, água e rota planejada.

Outro agente pode consumir o relatório e as imagens sem precisar entender a implementação interna do GameEngine. A próxima missão pode ser criada a partir do inventário observado.

## Contrato de adaptador v1

Um novo jogo precisa fornecer um adaptador com:
- `ready` e versão do contrato;
- `getSnapshot()`: estado resumido do jogador;
- `getWorldSnapshot()`: entidades e pontos de interesse com IDs e coordenadas;
- ações explicitamente permitidas;
- `dispose()` para encerrar a sessão.

O adaptador Tomas atual é local, descartável e autenticado com UID sintético. Ele não usa Firebase, cookies, sessão real ou saves de produção.

## Memória portátil v1

O contrato está em `scripts/matrix-explorer/memory.schema.json`. Cada execução faz merge dos dados observados em um arquivo JSON versionado:
- histórico de visitas a pontos de interesse;
- entidades conhecidas (interagíveis, predadores, agentes e tarefas), com primeira/última observação e contador de aparições;
- histórico limitado às últimas 100 missões e 100 observações;
- última região e posição do jogador.

Por padrão, a memória fica em `.artifacts/memory.json` e é incluída no artefato do workflow. Para manter o histórico entre execuções locais, passe `--memory caminho/para/matrix-memory.json`. Se o arquivo estiver ausente, uma memória nova é criada; se estiver corrompido ou for de versão incompatível, a execução falha sem sobrescrevê-lo.

O runner também coloca uma cópia da memória no pacote de evidências. Assim, um agente pode baixar a memória, analisá-la e fornecê-la à execução seguinte.

## Limites atuais

- Só existe o adaptador Tomas e a missão `visit_shop`.
- A execução é local/CI, não um serviço multiusuário hospedado.
- Não há análise semântica automática por modelo de visão nesta versão. O Explorer entrega capturas e estado estruturado prontos para um modelo de visão consumir.
- Não há integração automática com Cowila nem credenciais de provedores externos.
- O relatório demonstra o estado observado nesta sessão, não persistência do mundo entre sessões.
