import type { CycleTaskEvent } from './taskCycles';

export interface TaskGpsCandidate {
  id: string;
  label: string;
  event: CycleTaskEvent;
  x: number;
  y: number;
  z: number;
}
export interface TaskGpsTarget extends TaskGpsCandidate {
  dx: number;
  dz: number;
  distance: number;
  objective: string;
  taskTitle: string;
}
export function selectTaskGpsTarget(
  event: CycleTaskEvent,
  origin: { x: number; z: number },
  candidates: readonly TaskGpsCandidate[],
  objective: string,
  taskTitle: string,
): TaskGpsTarget | null {
  const eligible = candidates
    .filter((candidate) => candidate.event === event && Number.isFinite(candidate.x) && Number.isFinite(candidate.z))
    .map((candidate) => {
      const dx = candidate.x - origin.x;
      const dz = candidate.z - origin.z;
      return { ...candidate, dx, dz, distance: Math.hypot(dx, dz), objective, taskTitle };
    })
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  return eligible[0] ?? null;
}
