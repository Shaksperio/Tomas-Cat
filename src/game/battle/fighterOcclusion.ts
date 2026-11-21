import * as THREE from 'three';

export interface OcclusionHit {
  object: THREE.Object3D;
  instanceId?: number;
}

const _scale = new THREE.Vector3();
const MAX_OCCLUDER_WORLD_RADIUS = 5;

/**
 * Só considera pequenos objetos opacos do cenário. Geometrias grandes são
 * frequentemente chão/fundo; torná-las invisíveis pode apagar boa parte da cena.
 * InstancedMesh é sempre excluído: suas matrizes podem ser compartilhadas pelo mapa.
 */
export function isSafeOcclusionHit(hit: OcclusionHit, ignored: (object: THREE.Object3D) => boolean): boolean {
  const { object, instanceId } = hit;
  if (ignored(object) || !object.visible || !(object instanceof THREE.Mesh)) return false;
  if (object instanceof THREE.InstancedMesh || instanceId !== undefined) return false;

  const materials = Array.isArray(object.material) ? object.material : [object.material];
  if (materials.length === 0 || materials.some((material) =>
    material.transparent || material.opacity < 0.98 || material.alphaTest > 0 || !material.depthTest || !material.depthWrite,
  )) return false;

  const geometry = object.geometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  if (!geometry.boundingSphere) return false;

  object.getWorldScale(_scale);
  const worldRadius = geometry.boundingSphere.radius * Math.max(_scale.x, _scale.y, _scale.z);
  return Number.isFinite(worldRadius) && worldRadius > 0 && worldRadius <= MAX_OCCLUDER_WORLD_RADIUS;
}

/**
 * Lista, uma vez por intervalo, só os meshes pequenos e opacos que podem ser ocultados.
 * O raio de oclusão é lançado SOMENTE contra essa lista: nunca contra Sprites (placas de
 * nome, números de dano), InstancedMesh (milhares de instâncias) nem objetos sem
 * `raycast` seguro. Raycast contra Sprite sem `Raycaster.camera` lança TypeError, e uma
 * exceção no laço de quadros derruba a renderização.
 */
export function collectOcclusionCandidates(root: THREE.Object3D, ignored: (object: THREE.Object3D) => boolean): THREE.Mesh[] {
  const candidates: THREE.Mesh[] = [];
  root.traverseVisible((object) => {
    if (object instanceof THREE.Mesh && isSafeOcclusionHit({ object }, ignored)) candidates.push(object);
  });
  return candidates;
}

/** Guarda e reverte somente alterações de visibilidade em meshes individuais. */
export class FighterOcclusionState {
  private readonly hiddenMeshes = new Map<THREE.Mesh, boolean>();

  public hide(hit: OcclusionHit): boolean {
    const { object, instanceId } = hit;
    // Nunca modifica matrizes de InstancedMesh: uma falha de restauração
    // poderia deixar instâncias compartilhadas do cenário permanentemente invisíveis.
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh ||
        instanceId !== undefined || !object.visible || this.hiddenMeshes.has(object)) return false;

    this.hiddenMeshes.set(object, object.visible);
    object.visible = false;
    return true;
  }

  public restore(): void {
    for (const [mesh, wasVisible] of this.hiddenMeshes) mesh.visible = wasVisible;
    this.hiddenMeshes.clear();
  }
}
