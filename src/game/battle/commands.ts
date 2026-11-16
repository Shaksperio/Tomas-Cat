import type { BattleCommand } from './atb';

/**
 * Contrato de comandos da batalha. O comando item executa a ração energética;
 * combo_a/combo_b permanecem extensões futuras.
 */
export type PlannedBattleCommand = BattleCommand | 'combo_a' | 'combo_b';

export type CameraPreset = 'wide' | 'over_shoulder' | 'low_impact' | 'close_face' | 'orbit_special' | 'dramatic_side';

export interface BattleCommandPresentation {
  animationId: string;
  cameraSequence: CameraPreset[];
  hitTimings: number[];
  particleProfile: 'claw' | 'flurry' | 'guard' | 'meteor' | 'item' | 'combo';
  trailColor?: string;
}

export const BATTLE_COMMAND_PRESENTATION: Record<BattleCommand, BattleCommandPresentation> = {
  attack: { animationId: 'claw-strike', cameraSequence: ['over_shoulder', 'low_impact', 'wide'], hitTimings: [0.5], particleProfile: 'claw', trailColor: '#7dd3fc' },
  flurry: { animationId: 'furious-flurry', cameraSequence: ['over_shoulder', 'low_impact', 'low_impact', 'wide'], hitTimings: [0.48, 0.78, 1.08], particleProfile: 'flurry', trailColor: '#7dd3fc' },
  guard: { animationId: 'defensive-stance', cameraSequence: ['dramatic_side', 'wide'], hitTimings: [], particleProfile: 'guard' },
  limit: { animationId: 'meteor-claw', cameraSequence: ['close_face', 'orbit_special', 'low_impact', 'wide'], hitTimings: [1.7, 1.92, 2.14, 2.36, 2.58, 2.8], particleProfile: 'meteor', trailColor: '#93c5fd' },
  item: { animationId: 'ration-heal', cameraSequence: ['wide', 'close_face', 'wide'], hitTimings: [], particleProfile: 'item', trailColor: '#86efac' },
};

export const BATTLE_ITEM_CATALOG = {
  ration: { label: 'Ração energética', healing: 28, source: 'Coletada gratuitamente ao recolher comida, peixe ou presa no mundo.' },
} as const;

export type BattleItemId = keyof typeof BATTLE_ITEM_CATALOG;

export interface BattleInventoryItem {
  itemId: string;
  quantity: number;
}
