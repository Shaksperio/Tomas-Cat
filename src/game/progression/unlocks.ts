export interface MoveUnlock {
  id: string;
  name: string;
  requiredLevel: number;
  description: string;
  /** Comando ATB ao qual a técnica pertence; técnicas novas ganharão ações próprias em sprint posterior. */
  command: 'attack' | 'flurry' | 'limit';
}

export const MOVE_UNLOCKS: readonly MoveUnlock[] = [
  { id: 'basic-claw', name: 'Arranhar', requiredLevel: 1, description: 'Ataque básico com as garras.', command: 'attack' },
  { id: 'double-scratch', name: 'Arranhão Duplo', requiredLevel: 5, description: 'Técnica de dois cortes rápidos.', command: 'flurry' },
  { id: 'fierce-claw', name: 'Garra Furiosa Aprimorada', requiredLevel: 12, description: 'Sequência de garras com maior domínio.', command: 'flurry' },
  { id: 'lunar-sequence', name: 'Sequência Lunar', requiredLevel: 25, description: 'Combo especial inspirado na força lunar.', command: 'limit' },
  { id: 'meteor-claw', name: 'Garra Meteoro Aprimorada', requiredLevel: 40, description: 'Evolução da técnica especial existente.', command: 'limit' },
  { id: 'shadow-combo', name: 'Combo das Sombras', requiredLevel: 55, description: 'Sequência avançada de ataques.', command: 'flurry' },
  { id: 'apex-fury', name: 'Fúria Apex', requiredLevel: 70, description: 'Técnica de alto impacto.', command: 'limit' },
  { id: 'supreme-sequence', name: 'Sequência Suprema', requiredLevel: 85, description: 'Combo de domínio avançado.', command: 'limit' },
  { id: 'alpha-strike', name: 'Golpe do Gato Alpha', requiredLevel: 99, description: 'Técnica máxima do nível 99.', command: 'limit' },
] as const;

export function getUnlockedMovesForLevel(level: number): string[] {
  const safeLevel = Math.max(1, Math.min(99, Math.floor(Number.isFinite(level) ? level : 1)));
  return MOVE_UNLOCKS.filter((move) => move.requiredLevel <= safeLevel).map((move) => move.id);
}

export function getNewlyUnlockedMoves(previousLevel: number, currentLevel: number): MoveUnlock[] {
  const previous = Math.max(1, Math.min(99, Math.floor(previousLevel)));
  const current = Math.max(previous, Math.min(99, Math.floor(currentLevel)));
  return MOVE_UNLOCKS.filter((move) => move.requiredLevel > previous && move.requiredLevel <= current);
}

export function mergeUnlockedMoves(level: number, saved: readonly string[] = []): string[] {
  const validIds = new Set(MOVE_UNLOCKS.map((move) => move.id));
  return Array.from(new Set([...getUnlockedMovesForLevel(level), ...saved.filter((id) => validIds.has(id))]));
}
