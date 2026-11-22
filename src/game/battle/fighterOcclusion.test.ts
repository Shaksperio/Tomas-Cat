import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FighterOcclusionState, collectOcclusionCandidates, isSafeOcclusionHit } from './fighterOcclusion';

const notIgnored = () => false;

test('safe occlusion rejects InstancedMesh, transparent and oversized world geometry', () => {
  const material = new THREE.MeshBasicMaterial();
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 8);
  const regular = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 80), material);
  const largeProp = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 8), material);
  const transparent = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 }));

  assert.equal(isSafeOcclusionHit({ object: instanced }, notIgnored), false);
  assert.equal(isSafeOcclusionHit({ object: instanced, instanceId: 0 }, notIgnored), false);
  assert.equal(isSafeOcclusionHit({ object: regular }, notIgnored), false);
  assert.equal(isSafeOcclusionHit({ object: largeProp }, notIgnored), false);
  assert.equal(isSafeOcclusionHit({ object: transparent }, notIgnored), false);
  const small = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  assert.equal(isSafeOcclusionHit({ object: small }, notIgnored), true);
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

test('occlusion never changes InstancedMesh transforms, even for an individual instance', () => {
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
  // InstancedMesh armazena matrizes em Float32Array; compare com o valor
  // efetivamente armazenado, não com a precisão Float64 da matriz de entrada.
  const storedOriginal = new THREE.Matrix4();
  mesh.getMatrixAt(0, storedOriginal);
  const storedOther = new THREE.Matrix4();
  mesh.getMatrixAt(1, storedOther);
  const initialBufferVersion = mesh.instanceMatrix.version;
  const occlusion = new FighterOcclusionState();

  assert.equal(occlusion.hide({ object: mesh, instanceId: 0 }), false);
  assert.equal(occlusion.hide({ object: mesh, instanceId: 1 }), false);
  occlusion.restore();

  const restoredA = new THREE.Matrix4();
  const restoredB = new THREE.Matrix4();
  mesh.getMatrixAt(0, restoredA);
  mesh.getMatrixAt(1, restoredB);
  assert.deepEqual(restoredA.elements, storedOriginal.elements);
  assert.deepEqual(restoredB.elements, storedOther.elements);
  assert.equal(mesh.instanceMatrix.version, initialBufferVersion);
});

test('restores several individual blockers across repeated occlusion cycles', () => {
  const material = new THREE.MeshBasicMaterial();
  const blockerA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const blockerB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 2);
  const instanceA = new THREE.Matrix4().makeTranslation(2, 0, 0);
  instanced.setMatrixAt(0, instanceA);
  const occlusion = new FighterOcclusionState();

  assert.equal(occlusion.hide({ object: blockerA }), true);
  assert.equal(occlusion.hide({ object: blockerB }), true);
  assert.equal(occlusion.hide({ object: instanced, instanceId: 0 }), false);
  occlusion.restore();

  const restored = new THREE.Matrix4();
  instanced.getMatrixAt(0, restored);
  assert.equal(blockerA.visible, true);
  assert.equal(blockerB.visible, true);
  assert.deepEqual(restored.elements, instanceA.elements);

  assert.equal(occlusion.hide({ object: blockerB }), true);
  assert.equal(occlusion.hide({ object: instanced, instanceId: 0 }), false);
  occlusion.restore();
  instanced.getMatrixAt(0, restored);
  assert.equal(blockerB.visible, true);
  assert.deepEqual(restored.elements, instanceA.elements);
});

test('candidatos de oclusão excluem sprites, instâncias, lutadores, ocultos e objetos grandes', () => {
  const material = new THREE.MeshBasicMaterial();
  const scene = new THREE.Scene();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const hiddenCrate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  hiddenCrate.visible = false;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(80, 6, 1), material);
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 4);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  const fighter = new THREE.Group();
  const fighterBody = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  fighter.add(fighterBody);
  scene.add(crate, hiddenCrate, wall, instanced, sprite, fighter);

  const isFighter = (object: THREE.Object3D) => object === fighterBody;
  const candidates = collectOcclusionCandidates(scene, isFighter);
  assert.deepEqual(candidates, [crate]);
});

test('lançar o raio de oclusão só contra os candidatos nunca falha, mesmo com sprites na cena e sem câmera no raycaster', () => {
  // Regressão da tela branca: Raycaster sem câmera + Sprite lança TypeError no three.js,
  // o que derrubava o laço de quadros com o clarão branco da abertura preso na tela.
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1, 10);
  const material = new THREE.MeshBasicMaterial();
  const scene = new THREE.Scene();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  crate.position.set(0, 1, 5);
  const label = new THREE.Sprite(new THREE.SpriteMaterial());
  label.position.set(0, 1, 6);
  scene.add(crate, label);
  scene.updateMatrixWorld(true);

  const raycaster = new THREE.Raycaster(); // propositalmente sem camera
  raycaster.set(camera.position, new THREE.Vector3(0, 0, -1));
  raycaster.far = 9;
  const candidates = collectOcclusionCandidates(scene, () => false);
  assert.doesNotThrow(() => raycaster.intersectObjects(candidates, false));
  const hit = raycaster.intersectObjects(candidates, false)[0];
  assert.equal(hit?.object, crate);

  const occlusion = new FighterOcclusionState();
  assert.equal(occlusion.hide({ object: hit.object }), true);
  assert.equal(crate.visible, false);
  occlusion.restore();
  assert.equal(crate.visible, true);
});
