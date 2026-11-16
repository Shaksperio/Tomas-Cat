import type { BattleCommand } from './atb';

/**
 * Contrato de comandos da batalha. Ração energética e dois combos progressivos
 * são executáveis no ATB; técnicas futuras podem ampliar este catálogo.
 */
export type PlannedBattleCommand = BattleCommand;

export type CameraPreset = 'wide' | 'over_shoulder' | 'low_impact' | 'close_face' | 'orbit_special' | 'dramatic_side';

export interface BattleCommandPresentation {
  animationId: string;
  cameraSequence: CameraPreset[];
  hitTimings: number[];
  particleProfile: 'claw' | 'flurry' | 'guard' | 'meteor' | 'item' | 'magic' | 'combo';
  trailColor?: string;
}

export const BATTLE_COMMAND_PRESENTATION: Record<BattleCommand, BattleCommandPresentation> = {
  attack: { animationId: 'claw-strike', cameraSequence: ['over_shoulder', 'low_impact', 'wide'], hitTimings: [0.5], particleProfile: 'claw', trailColor: '#7dd3fc' },
  flurry: { animationId: 'furious-flurry', cameraSequence: ['over_shoulder', 'low_impact', 'low_impact', 'wide'], hitTimings: [0.48, 0.78, 1.08], particleProfile: 'flurry', trailColor: '#7dd3fc' },
  guard: { animationId: 'defensive-stance', cameraSequence: ['dramatic_side', 'wide'], hitTimings: [], particleProfile: 'guard' },
  limit: { animationId: 'meteor-claw', cameraSequence: ['close_face', 'orbit_special', 'low_impact', 'wide'], hitTimings: [1.7, 1.92, 2.14, 2.36, 2.58, 2.8], particleProfile: 'meteor', trailColor: '#93c5fd' },
  item: { animationId: 'ration-heal', cameraSequence: ['wide', 'close_face', 'wide'], hitTimings: [], particleProfile: 'item', trailColor: '#86efac' },
  magic: { animationId: 'arcane-orb', cameraSequence: ['dramatic_side', 'low_impact', 'wide'], hitTimings: [0.42], particleProfile: 'magic', trailColor: '#a78bfa' },
  combo_a: { animationId: 'rasante-duplo', cameraSequence: ['over_shoulder', 'low_impact', 'dramatic_side', 'wide'], hitTimings: [0.42, 0.66, 0.9, 1.14], particleProfile: 'combo', trailColor: '#c4b5fd' },
  combo_b: { animationId: 'tempestade-garras', cameraSequence: ['close_face', 'orbit_special', 'low_impact', 'dramatic_side', 'wide'], hitTimings: [0.38, 0.6, 0.82, 1.04, 1.26, 1.48], particleProfile: 'combo', trailColor: '#f9a8d4' },
};

export const BATTLE_ITEM_CATALOG = {
  ration: { label: 'Ração energética', healing: 28, source: 'Coletada gratuitamente ao recolher comida, peixe ou presa no mundo.' },
} as const;

export type BattleItemId = keyof typeof BATTLE_ITEM_CATALOG;

export interface BattleInventoryItem {
  itemId: string;
  quantity: number;
}
