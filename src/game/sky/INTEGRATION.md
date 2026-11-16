# Integração do céu vivo no GameEngine

Os módulos em `src/game/sky/` estão prontos e testados (lógica pura + `SkyVisuals`).

Para ligar no `GameEngine.ts` (edição pequena, ~10 linhas):

1. Imports:
```ts
import { sampleSkyAtmosphere } from './sky/skyAtmosphere';
import { SkyVisuals } from './sky/skyVisuals';
```

2. Campo da classe:
```ts
private readonly skyVisuals: SkyVisuals;
```

3. No construtor, após `this.moonLight = ...; this.scene.add(this.moonLight);`:
```ts
this.skyVisuals = new SkyVisuals(this.scene);
```

4. Em `updateEnvironmentLighting`, substituir `this.moonLight.intensity = moonStrength * 3.6;` por:
```ts
const skySample = sampleSkyAtmosphere(this.day, this.timeOfDay, this.weather);
this.moonLight.intensity = moonStrength * 3.6 * (0.55 + skySample.moonIllumination * 0.55);
this.skyVisuals.update(dt, this.catPos.x, this.catPos.z, skySample, this.moonMesh);
```

5. Em `dispose()`:
```ts
this.skyVisuals.dispose();
```

Não alterar `atb.ts`, `dialogue/` nem o PR #3.

Usar a branch `grok/sky-atmosphere-v2`. A branch `grok/sky-atmosphere` (v1) corrompeu o GameEngine com placeholder e deve ser ignorada.
