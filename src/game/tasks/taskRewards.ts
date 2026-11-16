export interface TaskRewardDrop {
  id: string;
  taskId: string;
  title: string;
  x: number;
  y: number;
  z: number;
  amount: number;
}

export function normalizeTaskRewardDrops(value: unknown): TaskRewardDrop[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const drop = entry as Partial<TaskRewardDrop>;
    if (
      typeof drop.id !== 'string' || drop.id.length === 0 || drop.id.length > 160 ||
      typeof drop.taskId !== 'string' || drop.taskId.length === 0 || drop.taskId.length > 120 ||
      typeof drop.title !== 'string' || drop.title.length > 160 ||
      ![drop.x, drop.y, drop.z, drop.amount].every((n) => typeof n === 'number' && Number.isFinite(n)) ||
      (drop.amount ?? 0) <= 0
    ) return [];
    if (seen.has(drop.id)) return [];
    seen.add(drop.id);
    return [{
      id: drop.id,
      taskId: drop.taskId,
      title: drop.title,
      x: drop.x!,
      y: Math.max(0, drop.y!),
      z: drop.z!,
      amount: Math.max(1, Math.min(99, Math.floor(drop.amount!))),
    }];
  });
}
