import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FighterOcclusionState, isSafeOcclusionHit } from './fighterOcclusion';

const notIgnored = () => false;

test('safe occlusion rejects full InstancedMesh batches, transparent and oversized world geometry', () => {
  const material = new THREE.MeshBasicMaterial();
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 8);
  const regular = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 80), material);
  const largeProp = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 8), material);
  const transparent = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 }));

  assert.equal(isSafeOcclusionHit({ object: instanced }, notIgnored), false);
  assert.equal(isSafeOcclusionHit({ object: instanced, instanceId: 0 }, notIgnored), true);
  assert.equal(isSafeOcclusionHit({ object: regular }, notIgnored), false);
  assert.equal(isSafeOcclusionHit({ object: largeProp }, notIgnored), false);
  assert.equal(isSafeOcclusionHit({ object: transparent }, notIgnored), false);
});

test('occlusion hides and restores only the single mesh hit, preserving an initially hidden mesh', () => {
  const material = new THREE.MeshBasicMaterial();
  const visible = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const initiallyHidden = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  initiallyHidden.visible = false;
  const occlusion = new FighterOcclusionState();

  assert.equal(occlusion.hide({ object: visible }), true);
  assert.equal(visible.visible, false);
  assert.equal(occlusion.hide({ object: initiallyHidden }), false);
  occlusion.restore();

  assert.equal(visible.visible, true);
  assert.equal(initiallyHidden.visible, false);
});

test('occlusion changes only the intercepted instance and restores its exact transform', () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 2);
  const original = new THREE.Matrix4().compose(
    new THREE.Vector3(3, 2, -4),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.6, -0.1)),
    new THREE.Vector3(1.5, 0.8, 1.2),
  );
  const other = new THREE.Matrix4().makeTranslation(-5, 1, 2);
  mesh.setMatrixAt(0, original);
  mesh.setMatrixAt(1, other);
  mesh.updateMatrixWorld(true);
  const storedOriginal = new THREE.Matrix4();
  mesh.getMatrixAt(0, storedOriginal);
  const initialBufferVersion = mesh.instanceMatrix.version;

  const occlusion = new FighterOcclusionState();
  assert.equal(occlusion.hide({ object: mesh, instanceId: 0 }), true);
  const hidden = new THREE.Matrix4();
  mesh.getMatrixAt(0, hidden);
  assert.ok([hidden.elements[0], hidden.elements[1], hidden.elements[2], hidden.elements[4], hidden.elements[5], hidden.elements[6], hidden.elements[8], hidden.elements[9], hidden.elements[10]].every((value) => value === 0));
  const unchanged = new THREE.Matrix4();
  mesh.getMatrixAt(1, unchanged);
  assert.deepEqual(unchanged.elements, other.elements);

  occlusion.restore();
  const restored = new THREE.Matrix4();
  mesh.getMatrixAt(0, restored);
  assert.deepEqual(restored.elements, storedOriginal.elements);
  assert.equal(mesh.instanceMatrix.version, initialBufferVersion + 2);
});

test('restores several blockers and instance hits across repeated occlusion cycles', () => {
  const material = new THREE.MeshBasicMaterial();
  const blockerA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const blockerB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 2);
  const instanceA = new THREE.Matrix4().makeTranslation(2, 0, 0);
  const instanceB = new THREE.Matrix4().makeTranslation(-2, 0, 0);
  instanced.setMatrixAt(0, instanceA);
  instanced.setMatrixAt(1, instanceB);
  const occlusion = new FighterOcclusionState();

  assert.equal(occlusion.hide({ object: blockerA }), true);
  assert.equal(occlusion.hide({ object: blockerB }), true);
  assert.equal(occlusion.hide({ object: instanced, instanceId: 0 }), true);
  assert.equal(occlusion.hide({ object: instanced, instanceId: 1 }), true);
  occlusion.restore();

  const restoredA = new THREE.Matrix4();
  const restoredB = new THREE.Matrix4();
  instanced.getMatrixAt(0, restoredA);
  instanced.getMatrixAt(1, restoredB);
  assert.equal(blockerA.visible, true);
  assert.equal(blockerB.visible, true);
  assert.deepEqual(restoredA.elements, instanceA.elements);
  assert.deepEqual(restoredB.elements, instanceB.elements);

  assert.equal(occlusion.hide({ object: blockerB }), true);
  assert.equal(occlusion.hide({ object: instanced, instanceId: 1 }), true);
  occlusion.restore();
  instanced.getMatrixAt(1, restoredB);
  assert.equal(blockerB.visible, true);
  assert.deepEqual(restoredB.elements, instanceB.elements);
});
