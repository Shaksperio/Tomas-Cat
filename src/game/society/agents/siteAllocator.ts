export interface OccupiedSite { x: number; z: number; radius: number; }

/** Obras totais permitidas por mundo (desempenho móvel; o bairro cresce até aqui). */
export const MAX_TOTAL_PROJECTS = 24;

const SPACING = 1.5;

/**
 * Escolhe de forma determinística um terreno livre em anéis ao redor da âncora,
 * sem sobrepor obras existentes e (se informado) respeitando colisores do mundo.
 */
export function allocateSite(input: {
  anchor: { x: number; z: number };
  radius: number;
  occupied: readonly OccupiedSite[];
  isFree?: (x: number, z: number, radius: number) => boolean;
  worldLimit?: number;
  seed?: number;
}): { x: number; z: number } | null {
  const limit = (input.worldLimit ?? 216) - input.radius;
  const start = ((input.seed ?? 0) * 0.7) % (Math.PI * 2);
  for (let ring = 6; ring <= 48; ring += 3) {
    const slots = Math.max(8, Math.round(ring * 1.6));
    for (let k = 0; k < slots; k += 1) {
      const angle = start + (k / slots) * Math.PI * 2;
      const x = Math.round((input.anchor.x + Math.cos(angle) * ring) * 10) / 10;
      const z = Math.round((input.anchor.z + Math.sin(angle) * ring) * 10) / 10;
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      if (input.occupied.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + input.radius + SPACING)) continue;
      if (input.isFree && !input.isFree(x, z, input.radius + SPACING)) continue;
      return { x, z };
    }
  }
  return null;
}
