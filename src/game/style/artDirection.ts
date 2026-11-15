/**
 * Direção de arte: aventura 3D clássica (era 32/64 bits) — formas simples e
 * facetadas, cores vivas, relva, árvores redondas, pedra com musgo, névoa suave.
 *
 * REGRA: tudo aqui é ORIGINAL. Inspiração de estilo é permitida; copiar mapas,
 * personagens, nomes, texturas, modelos ou músicas de outros jogos não é.
 */

export const PALETTE = {
  grass: '#5fae3f',
  grassDark: '#3f8a34',
  grassLight: '#86c95a',
  dirt: '#b08a56',
  stone: '#b9b2a2',
  stoneDark: '#8f897c',
  moss: '#5d9b45',
  plaster: '#e8d9b4',
  roofTerracotta: '#c4582f',
  timber: '#7a5230',
  water: '#2fa7d6',
  lantern: 0xffc15a,
} as const;

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlacementRules {
  bounds: number;
  /** Área livre ao redor da origem (spawn). */
  spawnRadius: number;
  /** Meia-largura das avenidas principais, mais margem. */
  roadHalfWidth: number;
  isBlocked: (x: number, z: number, margin: number) => boolean;
}

export interface Placement {
  x: number;
  z: number;
  scale: number;
  rot: number;
  variant: number;
}

/** Sorteia posições livres (fora de prédios, água, avenidas e spawn). */
export function scatterPlacements(
  count: number,
  seed: number,
  margin: number,
  rules: PlacementRules,
  scaleRange: [number, number] = [0.8, 1.4],
): Placement[] {
  const rng = createRng(seed);
  const out: Placement[] = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 25) {
    attempts += 1;
    const x = (rng() * 2 - 1) * (rules.bounds - 8);
    const z = (rng() * 2 - 1) * (rules.bounds - 8);
    if (Math.hypot(x, z) < rules.spawnRadius) continue;
    if (Math.abs(x) < rules.roadHalfWidth || Math.abs(z) < rules.roadHalfWidth) continue;
    if (rules.isBlocked(x, z, margin)) continue;
    out.push({
      x,
      z,
      scale: scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]),
      rot: rng() * Math.PI * 2,
      variant: rng(),
    });
  }
  return out;
}
