# Servidor compartilhado — protocolo e autoridade (T-219, rascunho)

Primeiro passo das fases 6/9. **Nada está implantado nem integrado ao jogo.**

## Princípio
O cliente envia intenções; o servidor decide. O UID vem de token verificado no servidor, nunca da mensagem. Um UID tem uma só sessão (lease); a mais nova invalida a anterior (fencing).

## Código
- `src/game/net/protocol.ts` — mensagens v1 (`hello`, `move`, `ping` → `welcome`, `snapshot`, `reject`, `pong`, `error`) e `parseClientMessage` estrito. Não existe mensagem do cliente que conceda XP, moeda, item, construção ou dano.
- `src/game/net/authority.ts` — `WorldAuthority`, pura e determinística (tempo entra por parâmetro): lease, limite de jogadores, sequência crescente, limite de taxa, limites do mundo, velocidade máxima com folga, correção por `reject` e expulsão após violações repetidas. Testes em `net.test.ts`.
- `server/tomas-world/` — esqueleto de Worker + Durable Object (WebSocket hibernável) e `wrangler.toml` **sem D1 e sem deploy**. **Não compilado nem executado**: sem rede e sem wrangler neste ambiente. Autenticação falha fechada; verificação real do ID token Firebase é TODO.

## Fora de escopo desta etapa
Cliente de rede no `GameEngine`, interpolação/predição, verificação Firebase, D1, alarmes/relógio de fundo (T-010), combate/economia/construção autoritativos, interesse por região. Não afirmar multiplayer funcional.

## Próximos passos
1. Compilar/rodar o DO localmente (`wrangler dev`) e escrever teste de integração com dois clientes WebSocket. 2. Verificação Firebase. 3. Cliente de rede opt-in (flag) com predição. 4. D1 e persistência de personagem (T-103/T-105 antes). 5. Relógio de fundo.
