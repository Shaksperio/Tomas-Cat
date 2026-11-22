# Tour visual headless do jogo (T-223)

Ferramenta de **somente leitura** para uma IA (ou pessoa) ver o que existe no mundo sem abrir o jogo à mão.

```bash
scripts/game-tour/run.sh [pasta-de-saida]   # requer esbuild, playwright + chromium e three; não roda no CI
```

Saída: `inventory.json` (contagem e posição de objetos, setores, habitantes, predadores, colisores, águas) e `shots/*.png` (uma captura por tipo de objeto, loja e habitante). O tour teleporta Tomas até cada ponto, espera ~0,7 s e captura. Não altera `GameEngine`, mundo ou saves.

## O que o primeiro passeio mostrou (2026-11-21, SwiftShader, 0 erros de página)

- Interativos: água 12, peixe 4, comida 12, sucata 10, itens (pickup) 22, lojas 6, abrigos 6, terminais 4. 24 predadores/animais, 9 habitantes da sociedade, 4 distritos.
- O visual é low-poly claro e saturado (relva, céu azul, prédios pastel). **Não lembra uma metrópole devastada**; o contraste com o texto "cidade devastada" do jogo antigo precisa ser resolvido pela nova narrativa.
- Habitantes e Mingau/Canela são criaturas coloridas com cara de gato. Isso deve ser decidido junto com a história do gato nativo.
- Limites: o enquadramento é o da câmera padrão atrás de Tomas (o alvo nem sempre fica centralizado); renderização por software, não GPU real; não exercita HUD, batalha nem interior de prédios.
