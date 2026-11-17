import {
  validateConstructionProject,
  type ConstructionProject,
  type ValidationResult,
} from './contracts';

export interface ReadyConstructionPlacement {
  projectId: string;
  placementIndex: number;
  assetId: string;
  sectorId: string;
  x: number;
  z: number;
  rotationY: number;
}

interface TrackedProject {
  project: ConstructionProject;
  completedTaskIds: Set<string>;
}

/**
 * Deterministic bridge between approved society projects and world rendering.
 * It emits only catalog-approved placements after every project task completes.
 * It does not create geometry, mutate a Three.js scene, or persist world state.
 */
export class WorldConstructionRuntime {
  private readonly projects = new Map<string, TrackedProject>();
  private readonly publishedProjectIds = new Set<string>();

  constructor(private readonly approvedAssetIds: ReadonlySet<string>) {}

  registerProject(project: ConstructionProject): ValidationResult {
    const validation = validateConstructionProject(project);
    if (!validation.valid) return validation;
    if (project.status !== 'validated' && project.status !== 'active') {
      return { valid: false, reason: 'Only validated or active projects can enter construction.' };
    }
    if (project.taskIds.length === 0 || new Set(project.taskIds).size !== project.taskIds.length) {
      return { valid: false, reason: 'A project must contain unique construction task IDs.' };
    }
    if (project.modules.some((module) => !this.approvedAssetIds.has(module.assetId))) {
      return { valid: false, reason: 'Project contains an asset outside the approved catalog.' };
    }
    if (this.projects.has(project.id)) {
      return { valid: false, reason: 'Project is already registered.' };
    }

    this.projects.set(project.id, {
      project: {
        ...project,
        modules: project.modules.map((module) => ({
          ...module,
          position: { ...module.position },
        })),
        requiredResources: { ...project.requiredResources },
        taskIds: [...project.taskIds],
      },
      completedTaskIds: new Set(),
    });
    return { valid: true };
  }

  completeTask(taskId: string): boolean {
    if (!taskId.trim()) return false;
    for (const tracked of this.projects.values()) {
      if (!tracked.project.taskIds.includes(taskId)) continue;
      if (tracked.completedTaskIds.has(taskId)) return false;
      tracked.completedTaskIds.add(taskId);
      return true;
    }
    return false;
  }

  getReadyPlacements(): ReadyConstructionPlacement[] {
    const placements: ReadyConstructionPlacement[] = [];
    for (const [projectId, tracked] of this.projects) {
      if (tracked.completedTaskIds.size !== tracked.project.taskIds.length) continue;
      if (this.publishedProjectIds.has(projectId)) continue;
      tracked.project.modules.forEach((module, placementIndex) => {
        placements.push({
          projectId,
          placementIndex,
          assetId: module.assetId,
          sectorId: module.position.sectorId,
          x: module.position.x,
          z: module.position.z,
          rotationY: module.rotationY,
        });
      });
      this.publishedProjectIds.add(projectId);
    }
    return placements;
  }

  getProjectProgress(projectId: string): { completedTasks: number; totalTasks: number } | null {
    const tracked = this.projects.get(projectId);
    if (!tracked) return null;
    return {
      completedTasks: tracked.completedTaskIds.size,
      totalTasks: tracked.project.taskIds.length,
    };
  }
}
