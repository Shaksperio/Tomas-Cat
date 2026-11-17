import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldSocietyRegistry } from './worldSocietyRegistry';

test('registers independent society simulations for multiple Matrix worlds', () => {
  const registry = new WorldSocietyRegistry(['quarantine-city', 'undergrid']);
  assert.deepEqual(registry.registeredWorldIds, ['quarantine-city', 'undergrid']);
  assert.equal(registry.snapshot('quarantine-city').tick, 0);
  assert.equal(registry.snapshot('undergrid').tick, 0);
  assert.deepEqual(
    registry.snapshot('quarantine-city').agents.map((agent) => agent.id),
    registry.snapshot('undergrid').agents.map((agent) => agent.id),
  );
});

test('advancing one world does not advance or mutate another world', () => {
  const registry = new WorldSocietyRegistry(['quarantine-city', 'undergrid']);
  const before = registry.snapshot('undergrid');
  const after = registry.advance('quarantine-city', 12);
  assert.equal(after.tick, 12);
  assert.deepEqual(registry.snapshot('undergrid'), before);
});

test('advances all worlds deterministically without sharing their state', () => {
  const first = new WorldSocietyRegistry(['quarantine-city', 'undergrid']);
  const second = new WorldSocietyRegistry(['quarantine-city', 'undergrid']);
  const firstResult = first.advanceAll(8);
  const secondResult = second.advanceAll(8);
  assert.deepEqual([...firstResult], [...secondResult]);
  assert.equal(first.snapshot('quarantine-city').tick, 8);
  assert.equal(first.snapshot('undergrid').tick, 8);
});

test('rejects invalid and duplicate world identities', () => {
  assert.throws(() => new WorldSocietyRegistry([]), /At least one world/);
  assert.throws(() => new WorldSocietyRegistry(['bad world']), /Invalid world ID/);
  assert.throws(() => new WorldSocietyRegistry(['same', 'same']), /Duplicate world ID/);
});

test('rejects attempts to advance or inspect an unregistered world', () => {
  const registry = new WorldSocietyRegistry(['quarantine-city']);
  assert.throws(() => registry.snapshot('unknown'), /Unknown world/);
  assert.throws(() => registry.advance('unknown'), /Unknown world/);
});
