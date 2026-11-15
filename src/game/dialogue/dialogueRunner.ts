import type { DialogueCondition, DialogueContext, DialogueEffect, DialogueNode, DialogueOption, DialogueState } from './types';

export function meetsDialogueCondition(condition: DialogueCondition, context: DialogueContext): boolean {
  switch (condition.kind) {
    case 'affinity_at_least': return context.affinity >= condition.value;
    case 'trust_at_least': return context.trust >= condition.value;
    case 'morale_below': return context.morale < condition.value;
    case 'weather_is': return context.weather === condition.value;
    case 'night': return context.timeOfDay >= 20 || context.timeOfDay < 5;
    case 'player_injured': return context.playerHealthRatio < condition.belowRatio;
    case 'territory_controlled': return context.territoryControlled;
    case 'task_completed': return context.completedTaskIds.includes(condition.taskId);
    case 'flag': return (context.flags[condition.flagId] ?? false) === (condition.value ?? true);
  }
}

export function meetsAllConditions(conditions: readonly DialogueCondition[] = [], context: DialogueContext): boolean {
  return conditions.every((condition) => meetsDialogueCondition(condition, context));
}

export function availableOptions(node: DialogueNode, context: DialogueContext): DialogueOption[] {
  return node.options.filter((option) => meetsAllConditions(option.conditions, context));
}

export function startDialogue(
  agentId: string,
  context: DialogueContext,
  nodes: readonly DialogueNode[],
): DialogueState | null {
  if (context.agentId !== agentId) return null;
  const node = nodes
    .filter((candidate) => candidate.agentId === agentId && candidate.trigger === 'greeting'
      && meetsAllConditions(candidate.conditions, context))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id))[0];
  return node ? { agentId, nodeId: node.id, history: [node.id], ended: false } : null;
}

export interface DialogueTransition {
  state: DialogueState;
  effects: DialogueEffect[];
}

/** Seleciona uma resposta; efeitos são devolvidos ao motor para validação/aplicação. */
export function chooseOption(
  state: DialogueState,
  optionId: string,
  context: DialogueContext,
  nodes: readonly DialogueNode[],
): DialogueTransition | null {
  if (state.ended) return null;
  const node = nodes.find((candidate) => candidate.id === state.nodeId && candidate.agentId === state.agentId);
  if (!node) return null;
  const option = availableOptions(node, context).find((candidate) => candidate.id === optionId);
  if (!option) return null;
  const nextNode = option.nextNodeId
    ? nodes.find((candidate) => candidate.id === option.nextNodeId && candidate.agentId === state.agentId)
    : undefined;
  if (option.nextNodeId && !nextNode) return null;
  const history = nextNode ? [...state.history, nextNode.id] : state.history;
  return {
    state: { ...state, nodeId: nextNode?.id ?? state.nodeId, history, ended: !nextNode },
    effects: (option.effects ?? []).map((effect) => ({ ...effect })),
  };
}
