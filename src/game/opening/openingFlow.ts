/**
 * Fluxo determinístico da primeira chegada de Tomas ao planeta.
 *
 * Este módulo descreve apenas o contrato narrativo/jogável. Não executa
 * combate, scanner, transformação, save ou movimentação do GameEngine.
 * A integração com esses sistemas ocorre por adaptadores autorizados.
 */

export type OpeningPhase =
  | 'awaiting_landing'
  | 'awaiting_first_contact'
  | 'combat_ready'
  | 'combat_in_progress'
  | 'mapping_ready'
  | 'form_unlock_ready'
  | 'exploration_ready'
  | 'exploration_started';

export interface OpeningProgress {
  phase: OpeningPhase;
  landingSiteId: string | null;
  nativeOrganismId: string | null;
  combatId: string | null;
  scanId: string | null;
  unlockedFormId: string | null;
  combatOutcome: 'won' | 'lost' | null;
  /** A forma de Tomas não recebe consciência, memória ou identidade do nativo. */
  preservesNativeIdentity: true;
  eventIds: string[];
}

export type OpeningEvent =
  | { type: 'ship_landed'; eventId: string; landingSiteId: string }
  | { type: 'organism_observed'; eventId: string; organismId: string }
  | { type: 'combat_started'; eventId: string; combatId: string }
  | { type: 'combat_won'; eventId: string; combatId: string }
  | { type: 'combat_lost'; eventId: string; combatId: string }
  | { type: 'mapping_completed'; eventId: string; scanId: string; organismId: string }
  | { type: 'form_unlocked'; eventId: string; formId: string }
  | { type: 'exploration_started'; eventId: string; landingSiteId: string };

export interface OpeningTransition {
  accepted: boolean;
  duplicate: boolean;
  reason?: string;
  progress: OpeningProgress;
}

const cleanId = (value: string): string => value.trim();

export function createOpeningProgress(): OpeningProgress {
  return {
    phase: 'awaiting_landing',
    landingSiteId: null,
    nativeOrganismId: null,
    combatId: null,
    scanId: null,
    unlockedFormId: null,
    combatOutcome: null,
    preservesNativeIdentity: true,
    eventIds: [],
  };
}

function reject(progress: OpeningProgress, reason: string): OpeningTransition {
  return { accepted: false, duplicate: false, reason, progress };
}

/** Aplica um evento uma única vez; eventos repetidos não duplicam progresso. */
export function applyOpeningEvent(
  current: OpeningProgress,
  event: OpeningEvent,
): OpeningTransition {
  const eventId = cleanId(event.eventId);
  if (!eventId) return reject(current, 'O evento precisa de um ID estável.');
  if (current.eventIds.includes(eventId)) {
    return { accepted: true, duplicate: true, progress: current };
  }

  const next: OpeningProgress = { ...current, eventIds: [...current.eventIds, eventId] };
  const id = (value: string, label: string): string | null => {
    const normalized = cleanId(value);
    return normalized || null;
  };

  switch (event.type) {
    case 'ship_landed': {
      const landingSiteId = id(event.landingSiteId, 'local de pouso');
      if (current.phase !== 'awaiting_landing') return reject(current, 'A nave já registrou o pouso.');
      if (!landingSiteId) return reject(current, 'O local de pouso precisa de um ID.');
      next.phase = 'awaiting_first_contact';
      next.landingSiteId = landingSiteId;
      break;
    }
    case 'organism_observed': {
      const organismId = id(event.organismId, 'organismo');
      if (current.phase !== 'awaiting_first_contact') return reject(current, 'O primeiro contato exige um pouso registrado.');
      if (!organismId) return reject(current, 'O organismo precisa de um ID.');
      next.phase = 'combat_ready';
      next.nativeOrganismId = organismId;
      break;
    }
    case 'combat_started': {
      const combatId = id(event.combatId, 'combate');
      if (current.phase !== 'combat_ready') return reject(current, 'O combate só pode começar após observar o organismo.');
      if (!combatId) return reject(current, 'O combate precisa de um ID.');
      next.phase = 'combat_in_progress';
      next.combatId = combatId;
      next.combatOutcome = null;
      break;
    }
    case 'combat_won':
    case 'combat_lost': {
      if (current.phase !== 'combat_in_progress' || event.combatId !== current.combatId) {
        return reject(current, 'O resultado precisa corresponder ao combate em andamento.');
      }
      next.combatOutcome = event.type === 'combat_won' ? 'won' : 'lost';
      next.phase = event.type === 'combat_won' ? 'mapping_ready' : 'combat_ready';
      break;
    }
    case 'mapping_completed': {
      const scanId = id(event.scanId, 'mapeamento');
      if (current.phase !== 'mapping_ready' || current.combatOutcome !== 'won') {
        return reject(current, 'O mapeamento só é liberado após a vitória no confronto.');
      }
      if (!scanId || event.organismId !== current.nativeOrganismId) {
        return reject(current, 'O mapeamento precisa identificar o organismo encontrado.');
      }
      next.phase = 'form_unlock_ready';
      next.scanId = scanId;
      break;
    }
    case 'form_unlocked': {
      const formId = id(event.formId, 'forma');
      if (current.phase !== 'form_unlock_ready' || !current.scanId) {
        return reject(current, 'A forma só pode ser desbloqueada após concluir o mapeamento.');
      }
      if (!formId) return reject(current, 'A forma desbloqueada precisa de um ID.');
      next.phase = 'exploration_ready';
      next.unlockedFormId = formId;
      break;
    }
    case 'exploration_started': {
      if (current.phase !== 'exploration_ready' || !current.unlockedFormId) {
        return reject(current, 'A exploração começa após o desbloqueio da forma.');
      }
      if (event.landingSiteId !== current.landingSiteId) {
        return reject(current, 'A exploração inicial deve partir do local do pouso.');
      }
      next.phase = 'exploration_started';
      break;
    }
  }

  return { accepted: true, duplicate: false, progress: next };
}
