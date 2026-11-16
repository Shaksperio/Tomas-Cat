import assert from 'node:assert/strict';
import test from 'node:test';
import { findGridRoute } from './gridRoute';

test('em espaço livre simplifica a rota para uma linha direta', () => {
  const route = findGridRoute({ x: -20, z: 0 }, { x: 20, z: 0 }, []);
  assert.equal(route.length, 2);
  assert.deepEqual(route[0], { x: -20, z: 0 });
  assert.deepEqual(route[1], { x: 20, z: 0 });
});

test('contorna um edifício bloqueando a passagem direta', () => {
  const route = findGridRoute(
    { x: -20, z: 0 },
    { x: 20, z: 0 },
    [{ minX: -3, maxX: 3, minZ: -12, maxZ: 12 }],
    { bounds: 40, cellSize: 2, clearance: 1 },
  );
  assert.ok(route.length > 2);
  assert.deepEqual(route[0], { x: -20, z: 0 });
  assert.deepEqual(route[route.length - 1], { x: 20, z: 0 });
  assert.ok(route.some((point) => Math.abs(point.z) > 12));
});

test('não deixa paredes estreitas desaparecerem entre centros da grade', () => {
  const route = findGridRoute(
    { x: -20, z: 0 },
    { x: 20, z: 0 },
    [{ minX: 0.8, maxX: 0.9, minZ: -40, maxZ: 40 }],
    { bounds: 40, cellSize: 4, clearance: 0.1 },
  );
  assert.deepEqual(route, []);
});

test('é determinístico e retorna vazio quando uma barreira fecha o mapa', () => {
  const start = { x: -20, z: 0 }, goal = { x: 20, z: 0 };
  const wall = [{ minX: -1, maxX: 1, minZ: -40, maxZ: 40 }];
  assert.deepEqual(findGridRoute(start, goal, wall, { bounds: 40, cellSize: 2 }), []);
  assert.deepEqual(findGridRoute(start, goal, [{ minX: -3, maxX: 3, minZ: -12, maxZ: 12 }], { bounds: 40, cellSize: 2 }), findGridRoute(start, goal, [{ minX: -3, maxX: 3, minZ: -12, maxZ: 12 }], { bounds: 40, cellSize: 2 }));
});
