import type { SavedGameState } from '../../types/game';

export type SaveOrigin = 'remote' | 'local' | 'legacy' | 'backup';

export interface SaveCandidate {
  origin: SaveOrigin;
  save: SavedGameState;
}

/** Pontuação de progresso: nível domina, depois estrelas/XP, dias, chefes e inimigos. */
export function saveProgressScore(save: SavedGameState | null | undefined): number {
  if (!save || typeof save !== 'object') return -1;
  const n = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0);
  const bosses = Array.isArray(save.defeatedBosses) ? save.defeatedBosses.length : 0;
  const territories = Array.isArray(save.conqueredTerritories) ? save.conqueredTerritories.length : 0;
  return (
    n(save.level, 99) * 1e9 +
    n(save.stars, 9999) * 1e6 +
    n(save.starProgress, 9999) * 1e3 +
    n(save.day, 9999) * 10 +
    bosses * 5 +
    territories * 3 +
    Math.min(n(save.enemiesDefeated, 99999), 99999) * 1e-3
  );
}

/**
 * Escolhe o save mais avançado entre as origens disponíveis. Em empate vence a
 * ordem de precedência remote > local > legacy > backup. Um personagem novo
 * (nível 1, sem progresso) nunca substitui um save mais avançado.
 */
export function pickBestSave(candidates: Array<SaveCandidate | null | undefined>): SaveCandidate | null {
  const order: SaveOrigin[] = ['remote', 'local', 'legacy', 'backup'];
  let best: SaveCandidate | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    if (!c || !c.save) continue;
    const score = saveProgressScore(c.save);
    if (score < 0) continue;
    if (!best || score > bestScore || (score === bestScore && order.indexOf(c.origin) < order.indexOf(best.origin))) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
