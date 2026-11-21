import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.resolve(root, 'scripts/matrix-explorer/.artifacts');
const port = Number(process.env.MATRIX_EXPLORER_PORT || 4179);
const fixtureUrl = process.env.MATRIX_EXPLORER_URL
  || `http://127.0.0.1:${port}/Tomas-Cat/scripts/matrix-explorer/fixture.html`;
let server;
let serverOutput = '';
let browser;
const pageErrors = [];
const consoleErrors = [];

async function waitForServer(url, child, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`Vite encerrou antes de ficar pronto (código ${child.exitCode}).\n${serverOutput}`);
    }
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* Vite ainda inicializando. */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timeout aguardando Vite em ${url}.\n${serverOutput}`);
}


function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]);
}


class MinHeap {
  constructor() { this.items = []; }
  push(item) {
    const a = this.items; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.items;
    if (!a.length) return null;
    const first = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      while (true) {
        const left = i * 2 + 1, right = left + 1;
        let smallest = i;
        if (left < a.length && a[left].f < a[smallest].f) smallest = left;
        if (right < a.length && a[right].f < a[smallest].f) smallest = right;
        if (smallest === i) break;
        [a[i], a[smallest]] = [a[smallest], a[i]]; i = smallest;
      }
    }
    return first;
  }
  get size() { return this.items.length; }
}

function planGridRoute(start, target, colliders, cellSize = 1.25) {
  const min = -220, max = 220;
  const cells = Math.round((max - min) / cellSize) + 1;
  const step = (max - min) / (cells - 1);
  const toCell = (value) => Math.max(0, Math.min(cells - 1, Math.round((value - min) / step)));
  const toWorld = (value) => min + value * step;
  const indexOf = (x, z) => z * cells + x;
  const blocked = new Uint8Array(cells * cells);

  for (let z = 0; z < cells; z++) {
    const wz = toWorld(z);
    for (let x = 0; x < cells; x++) {
      const wx = toWorld(x);
      if (colliders.some((box) => box.topY >= 0
        && wx >= box.minX - 0.75 && wx <= box.maxX + 0.75
        && wz >= box.minZ - 0.75 && wz <= box.maxZ + 0.75)) {
        blocked[indexOf(x, z)] = 1;
      }
    }
  }

  const nearestFree = (cell) => {
    if (!blocked[indexOf(cell.x, cell.z)]) return cell;
    for (let radius = 1; radius <= 12; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = cell.x + dx, z = cell.z + dz;
          if (x < 0 || z < 0 || x >= cells || z >= cells) continue;
          if (!blocked[indexOf(x, z)]) return { x, z };
        }
      }
    }
    return null;
  };

  const startCell = nearestFree({ x: toCell(start.catX), z: toCell(start.catZ) });
  const goalCell = nearestFree({ x: toCell(target.x), z: toCell(target.z) });
  if (!startCell || !goalCell) throw new Error('A* não encontrou célula navegável para início ou destino.');

  const total = cells * cells;
  const scores = new Float64Array(total); scores.fill(Number.POSITIVE_INFINITY);
  const parents = new Int32Array(total); parents.fill(-1);
  const closed = new Uint8Array(total);
  const startIndex = indexOf(startCell.x, startCell.z);
  const goalIndex = indexOf(goalCell.x, goalCell.z);
  const heuristic = (x, z) => Math.hypot(goalCell.x - x, goalCell.z - z);
  const heap = new MinHeap();
  scores[startIndex] = 0;
  heap.push({ index: startIndex, x: startCell.x, z: startCell.z, f: heuristic(startCell.x, startCell.z) });
  const directions = [
    [-1,0,1],[1,0,1],[0,-1,1],[0,1,1],
    [-1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[1,-1,Math.SQRT2],[1,1,Math.SQRT2],
  ];
  let expansions = 0;
  while (heap.size && expansions < 30000) {
    const current = heap.pop();
    if (!current || closed[current.index]) continue;
    if (current.index === goalIndex) break;
    closed[current.index] = 1; expansions++;
    for (const [dx,dz,cost] of directions) {
      const x = current.x + dx, z = current.z + dz;
      if (x < 0 || z < 0 || x >= cells || z >= cells) continue;
      const nextIndex = indexOf(x,z);
      if (blocked[nextIndex] || closed[nextIndex]) continue;
      if (dx !== 0 && dz !== 0
        && (blocked[indexOf(current.x + dx,current.z)] || blocked[indexOf(current.x,current.z + dz)])) continue;
      const tentative = scores[current.index] + cost;
      if (tentative >= scores[nextIndex]) continue;
      scores[nextIndex] = tentative;
      parents[nextIndex] = current.index;
      heap.push({ index: nextIndex, x, z, f: tentative + heuristic(x,z) });
    }
  }
  if (startIndex !== goalIndex && parents[goalIndex] < 0) {
    throw new Error(`A* não encontrou rota para ${target.name} após ${expansions} expansões.`);
  }
  const indices = [];
  for (let cursor = goalIndex; cursor >= 0; cursor = parents[cursor]) {
    indices.push(cursor);
    if (cursor === startIndex) break;
  }
  indices.reverse();
  const points = indices.map((index) => ({
    x: toWorld(index % cells), z: toWorld(Math.floor(index / cells)),
  }));
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x-points[i-1].x, points[i].z-points[i-1].z);
  return { points, length, cellSize: step, expansions, resolvedTarget: points.at(-1) };
}

function renderWorldMap(world, player, route = []) {
  const size = 900;
  const pad = 54;
  const span = 440;
  const px = (x) => pad + ((x + 220) / span) * (size - pad * 2);
  const py = (z) => size - pad - ((z + 220) / span) * (size - pad * 2);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    '<rect width="900" height="900" fill="#0b1220"/>',
    '<text x="54" y="30" fill="#e2e8f0" font-size="19" font-family="sans-serif" font-weight="700">Tomas Vagabundo · mapa observado</text>',
    '<text x="54" y="47" fill="#94a3b8" font-size="10" font-family="sans-serif">Coordenadas X/Z do GameEngine · limites cartográficos ±220</text>',
  ];
  for (let value = -200; value <= 200; value += 50) {
    const x = px(value), y = py(value);
    parts.push(`<line x1="${x}" y1="${pad}" x2="${x}" y2="${size-pad}" stroke="#334155" stroke-opacity=".55"/>`);
    parts.push(`<line x1="${pad}" y1="${y}" x2="${size-pad}" y2="${y}" stroke="#334155" stroke-opacity=".55"/>`);
    parts.push(`<text x="${x}" y="${size-pad+17}" text-anchor="middle" fill="#64748b" font-size="10">${value}</text>`);
    parts.push(`<text x="${pad-10}" y="${y+3}" text-anchor="end" fill="#64748b" font-size="10">${value}</text>`);
  }
  parts.push(`<rect x="${pad}" y="${pad}" width="${size-pad*2}" height="${size-pad*2}" fill="none" stroke="#64748b"/>`);

  if (route.length > 1) {
    const routePoints = route.map((point) => `${px(point.x)},${py(point.z)}`).join(' ');
    parts.push(`<polyline points="${routePoints}" fill="none" stroke="#fde047" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7 5"><title>Rota A* planejada</title></polyline>`);
  }
  for (const river of world.rivers) {
    parts.push(`<line x1="${px(river.ax)}" y1="${py(river.az)}" x2="${px(river.bx)}" y2="${py(river.bz)}" stroke="#0ea5e9" stroke-width="${Math.max(2, river.halfWidth*2*(size-pad*2)/span)}" stroke-linecap="round" stroke-opacity=".35"><title>${xmlEscape(river.name)}</title></line>`);
  }
  for (const lake of world.waterBodies) {
    parts.push(`<circle cx="${px(lake.x)}" cy="${py(lake.z)}" r="${Math.max(3, lake.radius*(size-pad*2)/span)}" fill="#38bdf8" fill-opacity=".24" stroke="#38bdf8" stroke-opacity=".75"><title>${xmlEscape(lake.name)}</title></circle>`);
  }
  const interactableColors = { shop:'#f59e0b', shelter:'#22c55e', terminal:'#a78bfa', pickup:'#38bdf8', scrap:'#fb923c', food:'#84cc16', water:'#06b6d4', prey:'#a3e635', fish:'#67e8f9' };
  for (const item of world.interactables) {
    const color = interactableColors[item.kind] || '#cbd5e1';
    parts.push(`<circle cx="${px(item.x)}" cy="${py(item.z)}" r="4.2" fill="${color}" stroke="#0b1220" stroke-width="1.3"><title>${xmlEscape(item.name)} · ${xmlEscape(item.kind)} · ${xmlEscape(item.id)} · ${item.active ? 'ativo' : 'inativo'}</title></circle>`);
  }
  for (const gate of world.phaseGates) {
    const x = px(gate.x), y = py(gate.z);
    parts.push(`<rect x="${x-4}" y="${y-4}" width="8" height="8" transform="rotate(45 ${x} ${y})" fill="${gate.unlocked ? '#22c55e' : '#64748b'}"><title>Portão da fase ${gate.phaseRequired} · ${gate.unlocked ? 'desbloqueado' : 'bloqueado'}</title></rect>`);
  }
  for (const predator of world.predators) {
    const color = predator.isBoss ? '#ef4444' : predator.isFriendly ? '#4ade80' : predator.isTerritoryRival ? '#c084fc' : '#f87171';
    const radius = predator.isBoss ? 6.2 : predator.isTerritoryRival ? 5 : 3.4;
    parts.push(`<circle cx="${px(predator.x)}" cy="${py(predator.z)}" r="${radius}" fill="${color}" stroke="#0b1220" stroke-width="1"><title>${xmlEscape(predator.name)} · ${predator.isBoss ? 'chefe' : predator.isTerritoryRival ? 'rival territorial' : predator.isFriendly ? 'amigável' : 'predador'} · ${predator.alive ? 'vivo' : 'fora de combate'}</title></circle>`);
  }
  for (const agent of world.society.agents) {
    const x = px(agent.position.x), y = py(agent.position.z);
    parts.push(`<path d="M ${x} ${y-4} L ${x+4} ${y} L ${x} ${y+4} L ${x-4} ${y} Z" fill="#f0abfc" stroke="#0b1220" stroke-width="1"><title>${xmlEscape(agent.displayName)} · ${xmlEscape(agent.profession)} · ${xmlEscape(agent.status)}</title></path>`);
  }
  parts.push(`<path d="M ${px(player.catX)} ${py(player.catZ)-9} L ${px(player.catX)+7} ${py(player.catZ)+6} L ${px(player.catX)-7} ${py(player.catZ)+6} Z" fill="#fde047" stroke="#713f12" stroke-width="1.5"><title>Tomas · jogador</title></path>`);
  const legend = [
    ['#fde047','Tomas'],['#f59e0b','Lojas'],['#22c55e','Abrigos'],['#a78bfa','Terminais'],
    ['#38bdf8','Itens'],['#ef4444','Chefes/predadores'],['#c084fc','Rivais'],['#4ade80','Animais amigáveis'],['#f0abfc','Agentes'],
  ];
  let lx = 54, ly = 870;
  for (const [color,label] of legend) {
    parts.push(`<circle cx="${lx}" cy="${ly-4}" r="4" fill="${color}"/><text x="${lx+8}" y="${ly}" fill="#cbd5e1" font-size="10" font-family="sans-serif">${label}</text>`);
    lx += label.length*5.4 + 31;
    if (lx > 820) { lx = 54; ly -= 16; }
  }
  parts.push('</svg>');
  return parts.join('');
}


async function followRoute(page, route, target) {
  const waypointResults = [];
  for (let index = 1; index < route.length; index++) {
    const waypoint = route[index];
    const tolerance = index === route.length - 1 ? 0.75 : 0.45;
    let bestDistance = Number.POSITIVE_INFINITY;
    let stagnantChecks = 0;
    let reached = false;
    let attempts = 0;
    for (; attempts < 40; attempts++) {
      await page.evaluate((point) => window.__MATRIX_EXPLORER__?.actions.moveToward(point.x, point.z, false), waypoint);
      await page.waitForTimeout(250);
      const current = await page.evaluate(() => window.__MATRIX_EXPLORER__?.getSnapshot() ?? null);
      if (!current) throw new Error('Snapshot do jogador indisponível durante navegação.');
      const remaining = Math.hypot(current.catX - waypoint.x, current.catZ - waypoint.z);
      if (remaining <= tolerance) { reached = true; attempts++; break; }
      if (remaining < bestDistance - 0.03) {
        bestDistance = remaining;
        stagnantChecks = 0;
      } else {
        stagnantChecks++;
      }
      if (stagnantChecks >= 12) break;
    }
    const current = await page.evaluate(() => window.__MATRIX_EXPLORER__?.getSnapshot() ?? null);
    const remaining = current ? Math.hypot(current.catX-waypoint.x,current.catZ-waypoint.z) : Number.POSITIVE_INFINITY;
    waypointResults.push({
      waypoint, attempts, reached, tolerance, distanceRemaining: remaining,
      currentPosition: current ? { x: current.catX, z: current.catZ } : null,
    });
    if (!reached) {
      await page.evaluate(() => window.__MATRIX_EXPLORER__?.actions.stop());
      throw new Error(`Navegação bloqueada no waypoint ${index}/${route.length-1}; posição=(${current?.catX.toFixed(2)},${current?.catZ.toFixed(2)}), alvo=(${waypoint.x},${waypoint.z}), distância=${remaining.toFixed(2)}.`);
    }
  }

  await page.evaluate(() => window.__MATRIX_EXPLORER__?.actions.stop());
  const atInputRelease = await page.evaluate(() => window.__MATRIX_EXPLORER__?.getSnapshot() ?? null);
  await page.waitForTimeout(1400);
  const afterStop = await page.evaluate(() => window.__MATRIX_EXPLORER__?.getSnapshot() ?? null);
  await page.waitForTimeout(600);
  const settled = await page.evaluate(() => window.__MATRIX_EXPLORER__?.getSnapshot() ?? null);
  const coastingDistance = atInputRelease && afterStop
    ? Math.hypot(afterStop.catX-atInputRelease.catX,afterStop.catZ-atInputRelease.catZ)
    : Number.POSITIVE_INFINITY;
  const settleDrift = afterStop && settled
    ? Math.hypot(settled.catX-afterStop.catX,settled.catZ-afterStop.catZ)
    : Number.POSITIVE_INFINITY;
  const distanceToTarget = settled
    ? Math.hypot(settled.catX-target.x,settled.catZ-target.z)
    : Number.POSITIVE_INFINITY;
  if (settleDrift > 0.08 || coastingDistance > 1.2 || distanceToTarget > 2.5) {
    throw new Error(`Chegada não confirmada: alvo=${distanceToTarget.toFixed(2)}, inércia=${coastingDistance.toFixed(3)}, deriva=${settleDrift.toFixed(3)}.`);
  }
  return { waypointResults, atInputRelease, afterStop, settled, coastingDistance, settleDrift, distanceToTarget };
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  if (!process.env.MATRIX_EXPLORER_URL) {
    const viteEntry = path.join(root, 'node_modules/vite/bin/vite.js');
    server = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1',
      '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
    server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
    await waitForServer(`http://127.0.0.1:${port}/Tomas-Cat/`, server);
  }

  browser = await chromium.launch({ headless: true, args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl',
    '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(fixtureUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(
    () => Boolean(window.__MATRIX_EXPLORER__?.ready || window.__MATRIX_EXPLORER_ERROR__),
    undefined,
    { timeout: 45000 },
  );
  const boot = await page.evaluate(() => ({
    ready: Boolean(window.__MATRIX_EXPLORER__?.ready),
    error: window.__MATRIX_EXPLORER_ERROR__ ?? null,
    snapshot: window.__MATRIX_EXPLORER__?.getSnapshot() ?? null,
    worldSnapshot: window.__MATRIX_EXPLORER__?.getWorldSnapshot() ?? null,
    canvasCount: document.querySelectorAll('canvas').length,
    title: document.title,
    renderer: (() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      if (!gl) return null;
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        reported: gl.getParameter(gl.RENDERER),
        unmasked: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      };
    })(),
  }));
  if (!boot.ready || !boot.snapshot || !boot.worldSnapshot || boot.canvasCount < 1
    || !boot.worldSnapshot.interactables?.length || !boot.worldSnapshot.predators?.length
    || !boot.worldSnapshot.society?.agents?.length) {
    throw new Error(`O jogo não iniciou no fixture isolado: ${JSON.stringify(boot)}`);
  }
  await page.screenshot({ path: path.join(outputDir, 'world-initial.png'), fullPage: true });

  const start = boot.snapshot;
  const initialWorld = boot.worldSnapshot;
  const routeTarget = initialWorld.interactables
    .filter((item) => item.kind === 'shop' && item.active)
    .sort((a,b) => Math.hypot(a.x-start.catX,a.z-start.catZ) - Math.hypot(b.x-start.catX,b.z-start.catZ))[0];
  if (!routeTarget) throw new Error('Nenhuma loja ativa disponível para a primeira missão de navegação.');
  const plannedRoute = planGridRoute(start, routeTarget, initialWorld.colliders);
  if (plannedRoute.points.length < 2) throw new Error('A* não produziu um próximo waypoint.');
  const navigationResult = await followRoute(page, plannedRoute.points, routeTarget);
  const { atInputRelease, afterStop, settled, coastingDistance, settleDrift } = navigationResult;
  const expectedShopId = routeTarget.id.replace(/^shop-/, '');
  await page.evaluate(() => window.__MATRIX_EXPLORER__?.actions.interact());
  await page.waitForFunction((expected) => {
    return window.__MATRIX_EXPLORER__?.getWorldSnapshot()?.openShopId === expected;
  }, expectedShopId, { timeout: 5000 });
  const interaction = await page.evaluate(() => {
    const world = window.__MATRIX_EXPLORER__?.getWorldSnapshot();
    return {
      activeInteractableId: world?.activeInteractableId ?? null,
      openShopId: world?.openShopId ?? null,
    };
  });
  await page.screenshot({ path: path.join(outputDir, 'world-after-movement.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outputDir, 'world-mobile.png'), fullPage: true });
  const world = await page.evaluate(() => window.__MATRIX_EXPLORER__?.getWorldSnapshot() ?? null);
  if (!world || world.society.tick <= initialWorld.society.tick) {
    throw new Error('A simulação social não avançou durante a observação; snapshot dinâmico não confirmado.');
  }

  const distance = settled ? Math.hypot(settled.catX - start.catX, settled.catZ - start.catZ) : 0;
  const interactablesByKind = world.interactables.reduce((counts, item) => {
    counts[item.kind] = (counts[item.kind] || 0) + 1;
    return counts;
  }, {});
  const worldInventory = {
    interactables: world.interactables.length,
    interactablesByKind,
    predators: world.predators.length,
    livingPredators: world.predators.filter((item) => item.alive).length,
    bosses: world.predators.filter((item) => item.isBoss).length,
    territoryRivals: world.predators.filter((item) => item.isTerritoryRival).length,
    friendlyCreatures: world.predators.filter((item) => item.isFriendly).length,
    phaseGates: world.phaseGates.length,
    unlockedPhaseGates: world.phaseGates.filter((item) => item.unlocked).length,
    waterBodies: world.waterBodies.length,
    rivers: world.rivers.length,
    indoorZones: world.indoorZones.length,
    colliders: world.colliderCount,
    societyTick: world.society.tick,
    societyAgents: world.society.agents.length,
    societyTasks: world.society.tasks.length,
    societyResources: world.society.resources,
  };
  await writeFile(path.join(outputDir, 'world-map.svg'), renderWorldMap(world, start, plannedRoute.points));

  const report = {
    schemaVersion: 1,
    project: 'Tomas Vagabundo / Matrix Explorer',
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    status: pageErrors.length === 0 && navigationResult.distanceToTarget <= 2.5 && interaction.openShopId === expectedShopId && settleDrift <= 0.08 && coastingDistance <= 1.2 && Boolean(boot.renderer) ? 'passed' : 'failed',
    environment: {
      browser: `Chromium ${browser.version()} via Playwright`,
      viewportDesktop: { width: 1440, height: 900 },
      viewportMobile: { width: 390, height: 844 },
      webglRenderer: boot.renderer,
      fixture: 'GameEngine local com identidade sintética isolada; sem login Firebase e sem saves de produção',
    },
    worldInventory,
    interaction,
    navigation: {
      algorithm: 'A* 8-way grid (1.25m) with 0.75m collision expansion and diagonal corner protection',
      target: { id: routeTarget.id, name: routeTarget.name, x: routeTarget.x, z: routeTarget.z },
      reached: navigationResult.distanceToTarget <= 2.5,
      finalPosition: settled ? { x: settled.catX, z: settled.catZ } : null,
      distanceToTarget: navigationResult.distanceToTarget,
      waypointResults: navigationResult.waypointResults,
      cellSize: plannedRoute.cellSize,
      pathLength: plannedRoute.length,
      waypointCount: plannedRoute.points.length,
      expansions: plannedRoute.expansions,
      nextWaypoint,
      path: plannedRoute.points,
    },
    initialWorldSnapshot: initialWorld,
    worldSnapshot: world,
    societyTickProgress: world.society.tick - initialWorld.society.tick,
    observations: {
      initial: start, atInputRelease, afterStop, settled, movementDistance: distance, coastingDistance, settleDrift,
      canvasCount: boot.canvasCount, title: boot.title,
    },
    events: await page.evaluate(() => window.__MATRIX_EXPLORER__?.getEvents() ?? []),
    pageErrors, consoleErrors,
    screenshots: ['world-initial.png', 'world-after-movement.png', 'world-mobile.png'],
    worldMap: 'world-map.svg',
  };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(outputDir, 'report.md'), [
    '# Matrix Explorer — relatório de observação', '',
    `- Estado: **${report.status}**`,
    `- Data: ${report.generatedAt}`,
    `- Renderizador WebGL: ${report.environment.webglRenderer?.unmasked ?? report.environment.webglRenderer?.reported ?? 'não identificado'}`,
    `- Região: ${start.sectorName}`,
    `- Posição inicial: x=${start.catX.toFixed(2)}, z=${start.catZ.toFixed(2)}`,
    `- Posição após repouso: x=${afterStop.catX.toFixed(2)}, z=${afterStop.catZ.toFixed(2)}`,
    `- Destino A*: ${routeTarget.name}; rota: ${plannedRoute.length.toFixed(2)} unidades em ${plannedRoute.points.length} waypoints`,
    `- Chegada ao destino: ${navigationResult.distanceToTarget.toFixed(2)} unidades do ponto de interesse`,
    `- Interação confirmada: ${interaction.openShopId ?? 'não confirmada'}`,
    `- Deslocamento observado: ${distance.toFixed(2)} unidades`,
    `- Deslocamento por inércia: ${coastingDistance.toFixed(3)} unidades`,
    `- Deriva final em 600 ms: ${settleDrift.toFixed(3)} unidades`,
    `- Interagíveis: ${worldInventory.interactables} (${Object.entries(interactablesByKind).map(([kind,count]) => `${kind}: ${count}`).join(', ')})`,
    `- Predadores: ${worldInventory.predators}; chefes: ${worldInventory.bosses}; rivais: ${worldInventory.territoryRivals}`,
    `- Agentes: ${worldInventory.societyAgents}; tarefas: ${worldInventory.societyTasks}; tick social: ${worldInventory.societyTick} (+${report.societyTickProgress} durante a observação)`,
    `- Lagos: ${worldInventory.waterBodies}; rios: ${worldInventory.rivers}; colisores: ${worldInventory.colliders}`,
    `- Erros fatais de página: ${pageErrors.length}`, '',
    'Capturas, mapa SVG e inventário JSON acompanham este relatório como artefatos.',
    'O fixture usa identidade sintética isolada; não acessa Firebase nem saves reais.', '',
  ].join('\n') + '\n');

  console.log(JSON.stringify({ status: report.status, report: path.join(outputDir, 'report.json'),
    observations: report.observations }, null, 2));
  if (pageErrors.length) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
}
