# Integração de lagos e rios

## Módulo
`waterBodies.ts` — dados + `sampleExpandedWater` + correnteza.

## No GameEngine (futuro)
1. Manter as 8 bacias legadas.
2. `const lakes = mergeLakeBodies(legacyBasins, currentPhase)`.
3. Trocar `sampleWater(bodies, ...)` por:
   ```ts
   sampleExpandedWater(lakes, riversForPhase(currentPhase), x, y, z, headHeight)
   ```
4. Se `sample.currentDx/Dz !== 0` e `inWater`, somar ao deslocamento horizontal do gato neste frame.
5. Malhas: cilindros achatados para lagos; caixas alongadas ou extrusão do segmento para rios (low-poly).

## Coordenação
Não altera `dialogue/`, `sky/`, `atb.ts`. PR #5 / branch `grok/water-bodies`.
