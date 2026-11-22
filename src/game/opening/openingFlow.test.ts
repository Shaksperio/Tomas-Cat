import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOpeningEvent, createOpeningProgress, type OpeningEvent } from './openingFlow.ts';

const apply = (state: ReturnType<typeof createOpeningProgress>, event: OpeningEvent) =>
  applyOpeningEvent(state, event);

test('a primeira missão exige pouso, contato, vitória, mapeamento e desbloqueio em ordem', () => {
  let state = createOpeningProgress();
  const events: OpeningEvent[] = [
    { type: 'ship_landed', eventId: 'e1', landingSiteId: 'landing-alpha' },
    { type: 'organism_observed', eventId: 'e2', organismId: 'native-cat-01' },
    { type: 'combat_started', eventId: 'e3', combatId: 'combat-01' },
    { type: 'combat_won', eventId: 'e4', combatId: 'combat-01' },
    { type: 'mapping_completed', eventId: 'e5', scanId: 'scan-01', organismId: 'native-cat-01' },
    { type: 'form_unlocked', eventId: 'e6', formId: 'feline-adaptive' },
    { type: 'exploration_started', eventId: 'e7', landingSiteId: 'landing-alpha' },
  ];
  for (const event of events) {
    const result = apply(state, event);
    assert.equal(result.accepted, true, result.reason);
    state = result.progress;
  }
  assert.equal(state.phase, 'exploration_started');
  assert.equal(state.landingSiteId, 'landing-alpha');
  assert.equal(state.unlockedFormId, 'feline-adaptive');
  assert.equal(state.preservesNativeIdentity, true);
});

test('não permite mapear nem desbloquear forma antes de vencer o combate', () => {
  let state = createOpeningProgress();
  state = apply(state, { type: 'ship_landed', eventId: '1', landingSiteId: 'site' }).progress;
  state = apply(state, { type: 'organism_observed', eventId: '2', organismId: 'cat' }).progress;
  const premature = apply(state, { type: 'mapping_completed', eventId: '3', scanId: 'scan', organismId: 'cat' });
  assert.equal(premature.accepted, false);
  const unlock = apply(state, { type: 'form_unlocked', eventId: '4', formId: 'cat-form' });
  assert.equal(unlock.accepted, false);
  assert.equal(state.phase, 'combat_ready');
});

test('derrota permite novo confronto, mas não libera mapeamento', () => {
  let state = createOpeningProgress();
  state = apply(state, { type: 'ship_landed', eventId: '1', landingSiteId: 'site' }).progress;
  state = apply(state, { type: 'organism_observed', eventId: '2', organismId: 'cat' }).progress;
  state = apply(state, { type: 'combat_started', eventId: '3', combatId: 'fight-1' }).progress;
  const lost = apply(state, { type: 'combat_lost', eventId: '4', combatId: 'fight-1' });
  assert.equal(lost.accepted, true);
  assert.equal(lost.progress.phase, 'combat_ready');
  assert.equal(lost.progress.combatOutcome, 'lost');
});

test('resultado de outro combate e mapeamento de outro organismo são rejeitados', () => {
  let state = createOpeningProgress();
  state = apply(state, { type: 'ship_landed', eventId: '1', landingSiteId: 'site' }).progress;
  state = apply(state, { type: 'organism_observed', eventId: '2', organismId: 'cat' }).progress;
  state = apply(state, { type: 'combat_started', eventId: '3', combatId: 'fight-1' }).progress;
  assert.equal(apply(state, { type: 'combat_won', eventId: '4', combatId: 'other-fight' }).accepted, false);
  state = apply(state, { type: 'combat_won', eventId: '5', combatId: 'fight-1' }).progress;
  assert.equal(apply(state, { type: 'mapping_completed', eventId: '6', scanId: 'scan', organismId: 'other-cat' }).accepted, false);
});

test('eventos repetidos são idempotentes e IDs vazios não avançam o fluxo', () => {
  const initial = createOpeningProgress();
  assert.equal(apply(initial, { type: 'ship_landed', eventId: '', landingSiteId: 'site' }).accepted, false);
  const landed = apply(initial, { type: 'ship_landed', eventId: 'land-1', landingSiteId: 'site' });
  const duplicate = apply(landed.progress, { type: 'ship_landed', eventId: 'land-1', landingSiteId: 'site' });
  assert.equal(duplicate.accepted, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.progress, landed.progress);
});
