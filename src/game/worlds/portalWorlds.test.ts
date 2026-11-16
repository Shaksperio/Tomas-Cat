import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialWorldTravelState,
  isPortalUnlocked,
  normalizeWorldTravelState,
  resolvePortalTransition,
  resolveReturnTransition,
  updateActiveWorldPosition,
  type PortalDefinition,
  type PortalProgressContext,
} from './portalWorlds';

const known = ['quarantine-city', 'crystal-archipelago'];
const context: PortalProgressContext = {
  defeatedBosses: new Set([1, 2]),
  completedTaskIds: new Set(['resident-iris']),
  flags: new Set(['sky-key']),
};
const portal: PortalDefinition = {
  id: 'gate-crystal',
  sourceWorldId: 'quarantine-city',
  destinationWorldId: 'crystal-archipelago',
  position: { x: 14, z: -8 },
  destination: { x: -20, z: 32 },
  requirements: { defeatedBosses: [2], completedTaskIds: ['resident-iris'], requiredFlags: ['sky-key'] },
};

test('saves antigos sem worldTravel iniciam no mundo original sem depender da fase', () => {
  const state = normalizeWorldTravelState(undefined, known);
  assert.equal(state.activeWorldId, 'quarantine-city');
  assert.deepEqual(state.worlds['quarantine-city'].playerPosition, { x: 0, z: 8 });
  assert.equal(createInitialWorldTravelState().activeWorldId, 'quarantine-city');
});

test('portal exige todos os requisitos de chefe, tarefa e flags', () => {
  assert.equal(isPortalUnlocked(portal, context), true);
  assert.equal(isPortalUnlocked(portal, { ...context, flags: new Set() }), false);
});

test('portal bloqueado, origem errada e destino desconhecido não geram viagem', () => {
  assert.equal(resolvePortalTransition(portal, 'quarantine-city', known, { ...context, defeatedBosses: new Set() }), null);
  assert.equal(resolvePortalTransition(portal, 'crystal-archipelago', known, context), null);
  assert.equal(resolvePortalTransition({ ...portal, destinationWorldId: 'unknown' }, 'quarantine-city', known, context), null);
});

test('transição cria âncora de retorno no portal de origem', () => {
  const transition = resolvePortalTransition(portal, 'quarantine-city', known, context);
  assert.deepEqual(transition?.destination, { x: -20, z: 32 });
  assert.deepEqual(transition?.returnAnchor, {
    worldId: 'quarantine-city',
    position: { x: 14, z: -8 },
    portalId: 'gate-crystal',
  });
  const back = resolveReturnTransition('crystal-archipelago', transition?.returnAnchor, known);
  assert.equal(back?.destinationWorldId, 'quarantine-city');
  assert.deepEqual(back?.destination, { x: 14, z: -8 });
});

test('normalização ignora mundos desconhecidos e elimina IDs duplicados/malformados', () => {
  const state = normalizeWorldTravelState({
    activeWorldId: 'not-registered',
    worlds: {
      'quarantine-city': { visited: true, playerPosition: { x: 5, z: 6 }, unlockedPortalIds: ['a', 'a', '', 4] },
      'unknown-world': { visited: true, playerPosition: { x: 0, z: 0 } },
    },
    returnAnchor: { worldId: 'unknown-world', position: { x: 1, z: 2 }, portalId: 'bad' },
  }, known);
  assert.equal(state.activeWorldId, 'quarantine-city');
  assert.deepEqual(state.worlds['quarantine-city'].unlockedPortalIds, ['a']);
  assert.equal('unknown-world' in state.worlds, false);
  assert.equal(state.returnAnchor, undefined);
});


test('salvar posição ativa preserva progresso e âncora dos demais mundos', () => {
  const initial = normalizeWorldTravelState({
    activeWorldId: 'crystal-archipelago',
    worlds: {
      'quarantine-city': { visited: true, playerPosition: { x: 1, z: 2 }, unlockedPortalIds: ['gate-crystal'] },
      'crystal-archipelago': { visited: true, playerPosition: { x: 3, z: 4 }, unlockedPortalIds: ['gate-return'] },
    },
    returnAnchor: { worldId: 'quarantine-city', position: { x: 14, z: -8 }, portalId: 'gate-crystal' },
  }, known);
  const next = updateActiveWorldPosition(initial, { x: 9, z: 12 });
  assert.deepEqual(next.worlds['crystal-archipelago'].playerPosition, { x: 9, z: 12 });
  assert.deepEqual(next.worlds['quarantine-city'].playerPosition, { x: 1, z: 2 });
  assert.deepEqual(next.worlds['quarantine-city'].unlockedPortalIds, ['gate-crystal']);
  assert.deepEqual(next.returnAnchor, initial.returnAnchor);
});

test('posição inválida não corrompe o estado de viagem', () => {
  const initial = createInitialWorldTravelState();
  assert.equal(updateActiveWorldPosition(initial, { x: Number.NaN, z: 4 }), initial);
});
