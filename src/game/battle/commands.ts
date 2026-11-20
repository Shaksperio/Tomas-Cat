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
  particleProfile: 'claw' | 'flurry' | 'guard' | 'meteor' | 'item' | 'magic' | 'combo' | 'summon';
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
  summon_wolf: { animationId: 'sacred-wolf', cameraSequence: ['wide', 'orbit_special', 'dramatic_side', 'wide'], hitTimings: [1.15], particleProfile: 'summon', trailColor: '#a5f3fc' },
  summon_lion: { animationId: 'celestial-lion', cameraSequence: ['close_face', 'orbit_special', 'low_impact', 'wide'], hitTimings: [1.25], particleProfile: 'summon', trailColor: '#fbbf24' },
  summon_phoenix: { animationId: 'sacred-phoenix', cameraSequence: ['wide', 'orbit_special', 'dramatic_side', 'wide'], hitTimings: [1.05], particleProfile: 'summon', trailColor: '#fb7185' },
  summon_turtle: { animationId: 'ancestral-turtle', cameraSequence: ['wide', 'dramatic_side', 'wide'], hitTimings: [], particleProfile: 'summon', trailColor: '#6ee7b7' },
  combo_c: { animationId: 'furia-apex', cameraSequence: ['close_face', 'orbit_special', 'low_impact', 'dramatic_side', 'wide'], hitTimings: [0.38, 0.6, 0.82, 1.04, 1.26, 1.48, 1.7, 1.92], particleProfile: 'combo', trailColor: '#fca5a5' },
  combo_d: { animationId: 'sequencia-suprema', cameraSequence: ['close_face', 'orbit_special', 'low_impact', 'dramatic_side', 'orbit_special', 'wide'], hitTimings: [0.38, 0.58, 0.78, 0.98, 1.18, 1.38, 1.58, 1.78, 1.98, 2.18], particleProfile: 'combo', trailColor: '#fde68a' },
};

export const BATTLE_ITEM_CATALOG = {
  ration: { label: 'Ração energética', healing: 28, source: 'Coletada gratuitamente ao recolher comida, peixe ou presa no mundo.' },
} as const;

export type BattleItemId = keyof typeof BATTLE_ITEM_CATALOG;

export interface BattleInventoryItem {
  itemId: string;
  quantity: number;
}
