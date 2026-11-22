# Contrato de integração — primeira chegada de Tomas

Este documento define como o runtime deverá conversar com `src/game/opening/openingFlow.ts`.
Ele não substitui os sistemas existentes nem simula seus resultados.

## Sequência e fonte de verdade

| Evento do fluxo | Deve ser emitido por | Condição de emissão |
|---|---|---|
| `ship_landed` | sistema de início de missão / navegação | nave realmente posicionada no ponto de pouso inicial |
| `organism_observed` | scanner/percepção do mundo | organismo nativo identificado por ID estável |
| `combat_started` | controlador de batalha ATB | batalha real iniciada contra o mesmo organismo |
| `combat_won` / `combat_lost` | resultado da batalha ATB | resultado final confirmado pelo controlador |
| `mapping_completed` | scanner/arquivo biológico | leitura concluída para o mesmo organismo |
| `form_unlocked` | sistema de progressão | forma validada e persistida no perfil do jogador |
| `exploration_started` | navegação/início da exploração | personagem liberado no mesmo ponto de pouso |

## Regras de integração

1. O fluxo não pode emitir vitória por conta própria. Só aceita confirmação do sistema ATB.
2. Uma derrota permite nova tentativa, mas não libera o scanner de catalogação nem a forma.
3. O ID do organismo precisa permanecer estável entre observação, combate e mapeamento.
4. A forma desbloqueada representa uma adaptação biológica de Tomas; não transfere consciência, memórias, personalidade ou identidade do organismo.
5. O animal nativo continua existindo no mundo, com estado próprio. Não deve ser removido ou substituído pela forma do jogador.
6. A progressão deve ser persistida no mecanismo de save existente. A reidratação do save deverá reconstruir o estado sem repetir eventos já processados.
7. Falha de save não deve anunciar desbloqueio ao jogador. A confirmação visual só ocorre após persistência bem-sucedida.
8. O jogador pode pular a cinematografia, mas isso não deve pular os pré-requisitos jogáveis nem conceder a forma.

## Adaptadores a implementar quando os arquivos estiverem liberados

- `LandingAdapter`: emite o pouso real e garante spawn no local correspondente.
- `NativeOrganismAdapter`: associa o ID do organismo observado ao encontro.
- `BattleOutcomeAdapter`: converte apenas o resultado terminal do ATB em vitória/derrota.
- `BiologicalArchiveAdapter`: solicita e confirma o mapeamento após vitória.
- `FormUnlockAdapter`: persiste a forma adaptativa e mantém o organismo nativo intacto.
- `ExplorationStartAdapter`: inicia exploração no ponto de pouso.

## Limites desta PR

Os adaptadores não são implementados nesta etapa porque os pontos de integração no motor, batalha, HUD, scanner e save estão reservados por outros agentes. A camada aqui entregue é um contrato determinístico e testável, não uma integração funcional end-to-end.
