import * as THREE from 'three';

export interface OcclusionHit {
  object: THREE.Object3D;
  instanceId?: number;
}

const _scale = new THREE.Vector3();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _zeroScale = new THREE.Vector3(0, 0, 0);
const MAX_OCCLUDER_WORLD_RADIUS = 5;

/**
 * Só considera pequenos objetos opacos do cenário. Geometrias grandes são
 * frequentemente chão/fundo; torná-las invisíveis pode apagar boa parte da cena.
 */
export function isSafeOcclusionHit(hit: OcclusionHit, ignored: (object: THREE.Object3D) => boolean): boolean {
  const { object, instanceId } = hit;
  if (ignored(object) || !object.visible || !(object instanceof THREE.Mesh)) return false;

  // Não alteramos matrizes individuais de InstancedMesh durante o combate:
  // alguns mapas usam instâncias compartilhadas e uma falha de restauração
  // pode deixar partes inteiras do cenário invisíveis.
  if (object instanceof THREE.InstancedMesh || instanceId !== undefined) return false;

  const materials = Array.isArray(object.material) ? object.material : [object.material];
  if (materials.length === 0 || materials.some((material) =>
    material.transparent || material.opacity < 0.98 || material.alphaTest > 0 || !material.depthTest || !material.depthWrite,
  )) return false;

  const geometry = object.geometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  if (!geometry.boundingSphere) return false;
  let worldRadius: number;

  object.getWorldScale(_scale);
  worldRadius = geometry.boundingSphere.radius * Math.max(_scale.x, _scale.y, _scale.z);

  return Number.isFinite(worldRadius) && worldRadius > 0 && worldRadius <= MAX_OCCLUDER_WORLD_RADIUS;
}

/** Guarda e reverte somente as alterações de visibilidade feitas para a batalha. */
export class FighterOcclusionState {
  private readonly hiddenMeshes = new Map<THREE.Mesh, boolean>();
  private readonly hiddenInstances = new Map<THREE.InstancedMesh, Map<number, THREE.Matrix4>>();

  public hide(hit: OcclusionHit): boolean {
    const { object, instanceId } = hit;
    if (!(object instanceof THREE.Mesh) || !object.visible) return false;

    if (object instanceof THREE.InstancedMesh) {
      if (instanceId === undefined || !Number.isInteger(instanceId) || instanceId < 0 || instanceId >= object.count) return false;
      let instances = this.hiddenInstances.get(object);
      if (!instances) {
        instances = new Map();
        this.hiddenInstances.set(object, instances);
      }
      if (instances.has(instanceId)) return false;

      const originalMatrix = new THREE.Matrix4();
      object.getMatrixAt(instanceId, originalMatrix);
      instances.set(instanceId, originalMatrix);
      originalMatrix.decompose(_position, _quaternion, _scale);
      object.setMatrixAt(instanceId, new THREE.Matrix4().compose(_position, _quaternion, _zeroScale));
      object.instanceMatrix.needsUpdate = true;
      return true;
    }

    if (instanceId !== undefined || this.hiddenMeshes.has(object)) return false;
    this.hiddenMeshes.set(object, object.visible);
    object.visible = false;
    return true;
  }

  public restore(): void {
    for (const [mesh, wasVisible] of this.hiddenMeshes) mesh.visible = wasVisible;
    this.hiddenMeshes.clear();

    for (const [mesh, instances] of this.hiddenInstances) {
      for (const [instanceId, matrix] of instances) mesh.setMatrixAt(instanceId, matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.hiddenInstances.clear();
  }
}
