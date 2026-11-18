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

export interface WorldConstructionRuntimeState {
  schemaVersion: 1;
  projects: Array<{ project: ConstructionProject; completedTaskIds: string[] }>;
  publishedProjectIds: string[];
}

interface TrackedProject {
  project: ConstructionProject;
  completedTaskIds: Set<string>;
}

/**
 * Deterministic bridge between approved society projects and world rendering.
 * It emits only catalog-approved placements after every project task completes.
 * It does not create geometry or mutate a Three.js scene; exportState/restoreState
 * expose a validated snapshot for the owning save system, not external storage.
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
    if (
      project.taskIds.length === 0
      || project.taskIds.some((taskId) => !/^[a-z0-9][a-z0-9:_-]{0,95}$/i.test(taskId))
      || new Set(project.taskIds).size !== project.taskIds.length
    ) {
      return { valid: false, reason: 'A project must contain unique, valid construction task IDs.' };
    }
    if ([...this.projects.values()].some((tracked) =>
      tracked.project.taskIds.some((taskId) => project.taskIds.includes(taskId))
    )) {
      return { valid: false, reason: 'Construction task IDs must be unique across registered projects.' };
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

  unregisterProject(projectId: string): boolean {
    if (this.publishedProjectIds.has(projectId)) return false;
    return this.projects.delete(projectId);
  }

  completeTask(projectId: string, taskId: string): boolean {
    if (!projectId.trim() || !taskId.trim()) return false;
    const tracked = this.projects.get(projectId);
    if (!tracked || !tracked.project.taskIds.includes(taskId)) return false;
    if (tracked.completedTaskIds.has(taskId)) return false;
    tracked.completedTaskIds.add(taskId);
    return true;
  }

  exportState(): WorldConstructionRuntimeState {
    return {
      schemaVersion: 1,
      projects: [...this.projects.values()].map((tracked) => ({
        project: {
          ...tracked.project,
          modules: tracked.project.modules.map((module) => ({
            ...module, position: { ...module.position },
          })),
          requiredResources: { ...tracked.project.requiredResources },
          taskIds: [...tracked.project.taskIds],
        },
        completedTaskIds: [...tracked.completedTaskIds],
      })),
      publishedProjectIds: [...this.publishedProjectIds],
    };
  }

  restoreState(state: WorldConstructionRuntimeState): boolean {
    if (!state || state.schemaVersion !== 1
      || !Array.isArray(state.projects) || !Array.isArray(state.publishedProjectIds)) return false;
    const projectIds = state.projects.map((entry) => entry.project?.id);
    if (projectIds.some((id) => typeof id !== 'string')
      || new Set(projectIds).size !== projectIds.length
      || state.publishedProjectIds.some((id) => typeof id !== 'string')
      || new Set(state.publishedProjectIds).size !== state.publishedProjectIds.length) return false;

    const candidate = new WorldConstructionRuntime(this.approvedAssetIds);
    for (const entry of state.projects) {
      if (!Array.isArray(entry.completedTaskIds)
        || new Set(entry.completedTaskIds).size !== entry.completedTaskIds.length
        || !candidate.registerProject(entry.project).valid) return false;
      for (const taskId of entry.completedTaskIds) {
        if (!candidate.completeTask(entry.project.id, taskId)) return false;
      }
    }
    for (const projectId of state.publishedProjectIds) {
      if (!candidate.markProjectPublished(projectId)) return false;
    }

    this.projects.clear();
    for (const [id, tracked] of candidate.projects) this.projects.set(id, tracked);
    this.publishedProjectIds.clear();
    for (const id of candidate.publishedProjectIds) this.publishedProjectIds.add(id);
    return true;
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
    }
    return placements;
  }

  markProjectPublished(projectId: string): boolean {
    const tracked = this.projects.get(projectId);
    if (!tracked || tracked.completedTaskIds.size !== tracked.project.taskIds.length) return false;
    if (this.publishedProjectIds.has(projectId)) return false;
    this.publishedProjectIds.add(projectId);
    return true;
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
