export interface MoveUnlock {
  id: string;
  name: string;
  requiredLevel: number;
  description: string;
  /** Comando ATB executado quando a técnica é escolhida em batalha. */
  command: 'attack' | 'flurry' | 'limit' | 'combo_a' | 'combo_b' | 'combo_c' | 'combo_d';
}

export const MOVE_UNLOCKS: readonly MoveUnlock[] = [
  { id: 'basic-claw', name: 'Arranhar', requiredLevel: 1, description: 'Ataque básico com as garras.', command: 'attack' },
  { id: 'double-scratch', name: 'Arranhão Duplo', requiredLevel: 5, description: 'Técnica de dois cortes rápidos.', command: 'flurry' },
  { id: 'fierce-claw', name: 'Garra Furiosa Aprimorada', requiredLevel: 12, description: 'Sequência de garras com maior domínio.', command: 'flurry' },
  { id: 'lunar-sequence', name: 'Rasante Duplo', requiredLevel: 25, description: 'Quatro golpes encadeados; custa 35 pontos de maná.', command: 'combo_a' },
  { id: 'meteor-claw', name: 'Garra Meteoro Aprimorada', requiredLevel: 40, description: 'Evolução da técnica especial existente.', command: 'limit' },
  { id: 'shadow-combo', name: 'Tempestade de Garras', requiredLevel: 55, description: 'Seis golpes encadeados; custa 70 pontos de maná.', command: 'combo_b' },
  { id: 'apex-fury', name: 'Fúria Apex', requiredLevel: 70, description: 'Oito golpes encadeados; custa 85 pontos de maná.', command: 'combo_c' },
  { id: 'supreme-sequence', name: 'Sequência Suprema', requiredLevel: 85, description: 'Dez golpes encadeados; custa 100 pontos de maná.', command: 'combo_d' },
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

export type ComboMoveCommand = Extract<MoveUnlock['command'], `combo_${string}`>;

/** Combos aprendidos a partir dos IDs de técnicas liberados (por nível ou compra). */
export function getLearnedCombos(unlockedIds: readonly string[]): ComboMoveCommand[] {
  const known = new Set(unlockedIds);
  return MOVE_UNLOCKS
    .filter((move): move is MoveUnlock & { command: ComboMoveCommand } => move.command.startsWith('combo_') && known.has(move.id))
    .map((move) => move.command);
}
