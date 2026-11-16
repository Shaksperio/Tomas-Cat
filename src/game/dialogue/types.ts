/** Contratos puros do sistema de diálogos. Sem dependência de React, Three.js ou GameEngine. */
export type DialogueTrigger = 'greeting' | 'ambient' | 'task_offer' | 'battle_before' | 'battle_after';

export interface DialogueContext {
  agentId: string;
  affinity: number;
  trust: number;
  morale: number;
  weather: string;
  timeOfDay: number;
  playerHealthRatio: number;
  territoryControlled: boolean;
  completedTaskIds: readonly string[];
  flags: Readonly<Record<string, boolean>>;
}

export type DialogueCondition =
  | { kind: 'affinity_at_least'; value: number }
  | { kind: 'trust_at_least'; value: number }
  | { kind: 'morale_below'; value: number }
  | { kind: 'weather_is'; value: string }
  | { kind: 'night' }
  | { kind: 'player_injured'; belowRatio: number }
  | { kind: 'territory_controlled' }
  | { kind: 'task_completed'; taskId: string }
  | { kind: 'flag'; flagId: string; value?: boolean };

export type DialogueEffect =
  | { kind: 'affinity'; amount: number }
  | { kind: 'trust'; amount: number }
  | { kind: 'give_item'; itemId: string; quantity: number }
  | { kind: 'open_task'; taskId: string }
  | { kind: 'grant_xp'; amount: number }
  | { kind: 'set_flag'; flagId: string; value: boolean };

export interface DialogueOption {
  id: string;
  text: string;
  conditions?: DialogueCondition[];
  effects?: DialogueEffect[];
  nextNodeId?: string | null;
}

export interface DialogueNode {
  id: string;
  agentId: string;
  speaker: string;
  trigger: DialogueTrigger;
  priority?: number;
  text: string;
  conditions?: DialogueCondition[];
  options: DialogueOption[];
}

export interface DialogueState {
  agentId: string;
  nodeId: string;
  history: string[];
  ended: boolean;
}
