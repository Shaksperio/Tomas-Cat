export interface NavigationObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export interface RoutePoint { x: number; z: number; }
export interface GridRouteOptions {
  bounds?: number;
  cellSize?: number;
  clearance?: number;
  maxExpanded?: number;
}
interface HeapNode { index: number; score: number; }
class MinHeap {
  private values: HeapNode[] = [];
  get size(): number { return this.values.length; }
  push(node: HeapNode): void {
    this.values.push(node);
    let i = this.values.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.values[parent].score <= node.score) break;
      this.values[i] = this.values[parent];
      i = parent;
    }
    this.values[i] = node;
  }
  pop(): HeapNode | undefined {
    if (this.values.length === 0) return undefined;
    const root = this.values[0];
    const tail = this.values.pop()!;
    if (this.values.length > 0) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        const child = right < this.values.length && this.values[right].score < this.values[left].score ? right : left;
        if (this.values[child].score >= tail.score) break;
        this.values[i] = this.values[child];
        i = child;
      }
      this.values[i] = tail;
    }
    return root;
  }
}
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function octile(ax: number, az: number, bx: number, bz: number): number {
  const dx = Math.abs(ax - bx), dz = Math.abs(az - bz);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}
export function findGridRoute(
  start: RoutePoint,
  goal: RoutePoint,
  obstacles: readonly NavigationObstacle[],
  options: GridRouteOptions = {},
): RoutePoint[] {
  const bounds = Math.max(8, options.bounds ?? 220);
  const cellSize = Math.max(1, options.cellSize ?? 4);
  const clearance = Math.max(0, options.clearance ?? 0.85);
  const width = Math.floor((bounds * 2) / cellSize) + 1;
  const total = width * width;
  const toCell = (value: number) => clamp(Math.round((value + bounds) / cellSize), 0, width - 1);
  const toIndex = (x: number, z: number) => z * width + x;
  const toPoint = (x: number, z: number): RoutePoint => ({ x: -bounds + x * cellSize, z: -bounds + z * cellSize });
  const sx = toCell(start.x), sz = toCell(start.z);
  const gx = toCell(goal.x), gz = toCell(goal.z);
  const startIndex = toIndex(sx, sz), goalIndex = toIndex(gx, gz);
  if (startIndex === goalIndex) return [{ ...start }, { ...goal }];

  const blocked = new Uint8Array(total);
  for (const obstacle of obstacles) {
    if (![obstacle.minX, obstacle.maxX, obstacle.minZ, obstacle.maxZ].every(Number.isFinite)) continue;
    const minX = clamp(Math.ceil((obstacle.minX - clearance + bounds) / cellSize), 0, width - 1);
    const maxX = clamp(Math.floor((obstacle.maxX + clearance + bounds) / cellSize), 0, width - 1);
    const minZ = clamp(Math.ceil((obstacle.minZ - clearance + bounds) / cellSize), 0, width - 1);
    const maxZ = clamp(Math.floor((obstacle.maxZ + clearance + bounds) / cellSize), 0, width - 1);
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) blocked[toIndex(x, z)] = 1;
  }
  // O jogador e o alvo podem estar sobre a borda de um colisor; esses dois nós são permitidos.
  blocked[startIndex] = 0;
  blocked[goalIndex] = 0;

  const gScore = new Float64Array(total); gScore.fill(Number.POSITIVE_INFINITY);
  const parent = new Int32Array(total); parent.fill(-1);
  const closed = new Uint8Array(total);
  const heap = new MinHeap();
  gScore[startIndex] = 0;
  heap.push({ index: startIndex, score: octile(sx, sz, gx, gz) });
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  let found = false;
  let expanded = 0;
  const maxExpanded = Math.max(100, options.maxExpanded ?? total);

  while (heap.size > 0 && expanded < maxExpanded) {
    const current = heap.pop()!;
    if (closed[current.index]) continue;
    if (current.index === goalIndex) { found = true; break; }
    closed[current.index] = 1;
    expanded++;
    const cx = current.index % width, cz = Math.floor(current.index / width);
    for (const [dx, dz] of directions) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= width || nz >= width) continue;
      const next = toIndex(nx, nz);
      if (blocked[next] || closed[next]) continue;
      if (dx !== 0 && dz !== 0 && (blocked[toIndex(cx + dx, cz)] || blocked[toIndex(cx, cz + dz)])) continue;
      const cost = dx !== 0 && dz !== 0 ? Math.SQRT2 : 1;
      const tentative = gScore[current.index] + cost;
      if (tentative >= gScore[next]) continue;
      parent[next] = current.index;
      gScore[next] = tentative;
      heap.push({ index: next, score: tentative + octile(nx, nz, gx, gz) });
    }
  }
  if (!found) return [];

  const raw: number[] = [];
  for (let cursor = goalIndex; cursor !== -1; cursor = parent[cursor]) {
    raw.push(cursor);
    if (cursor === startIndex) break;
  }
  if (raw[raw.length - 1] !== startIndex) return [];
  raw.reverse();
  const isVisible = (from: number, to: number): boolean => {
    const ax = from % width, az = Math.floor(from / width);
    const bx = to % width, bz = Math.floor(to / width);
    const steps = Math.max(1, Math.max(Math.abs(bx - ax), Math.abs(bz - az)) * 2);
    for (let i = 1; i < steps; i++) {
      const x = Math.round(ax + ((bx - ax) * i) / steps);
      const z = Math.round(az + ((bz - az) * i) / steps);
      const index = toIndex(x, z);
      if (index !== startIndex && index !== goalIndex && blocked[index]) return false;
    }
    return true;
  };
  const smooth = [raw[0]];
  let anchor = 0;
  while (anchor < raw.length - 1) {
    let next = anchor + 1;
    for (let candidate = raw.length - 1; candidate > anchor + 1; candidate--) {
      if (isVisible(raw[anchor], raw[candidate])) { next = candidate; break; }
    }
    smooth.push(raw[next]);
    anchor = next;
  }
  const points = smooth.map((index) => toPoint(index % width, Math.floor(index / width)));
  points[0] = { ...start };
  points[points.length - 1] = { ...goal };
  return points;
}
