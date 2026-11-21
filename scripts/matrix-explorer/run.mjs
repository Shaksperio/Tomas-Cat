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
    canvasCount: document.querySelectorAll('canvas').length,
    title: document.title,
    renderer: (() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      return gl ? gl.getParameter(gl.RENDERER) : null;
    })(),
  }));
  if (!boot.ready || !boot.snapshot || boot.canvasCount < 1) {
    throw new Error(`O jogo não iniciou no fixture isolado: ${JSON.stringify(boot)}`);
  }
  await page.screenshot({ path: path.join(outputDir, 'world-initial.png'), fullPage: true });

  const start = boot.snapshot;
  await page.evaluate(() => window.__MATRIX_EXPLORER__?.actions.move(0, -1, false));
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.__MATRIX_EXPLORER__?.actions.stop());
  await page.waitForFunction((before) => {
    const after = window.__MATRIX_EXPLORER__?.getSnapshot();
    return Boolean(after && Math.hypot(after.catX - before.x, after.catZ - before.z) > 0.25);
  }, { x: start.catX, z: start.catZ }, { timeout: 8000 });
  const afterMove = await page.evaluate(() => window.__MATRIX_EXPLORER__?.getSnapshot() ?? null);
  await page.waitForTimeout(500);
  const afterStop = await page.evaluate(() => window.__MATRIX_EXPLORER__?.getSnapshot() ?? null);
  const stopDrift = afterMove && afterStop
    ? Math.hypot(afterStop.catX - afterMove.catX, afterStop.catZ - afterMove.catZ)
    : Number.POSITIVE_INFINITY;
  if (stopDrift > 0.15) throw new Error(`O comando de parada não estabilizou o personagem: ${stopDrift.toFixed(3)} unidades.`);
  await page.screenshot({ path: path.join(outputDir, 'world-after-movement.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outputDir, 'world-mobile.png'), fullPage: true });

  const distance = afterMove ? Math.hypot(afterMove.catX - start.catX, afterMove.catZ - start.catZ) : 0;
  const report = {
    schemaVersion: 1,
    project: 'Tomas Vagabundo / Matrix Explorer',
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    status: pageErrors.length === 0 && distance > 0.25 && stopDrift <= 0.15 && Boolean(boot.renderer) ? 'passed' : 'failed',
    environment: {
      browser: 'Chromium via Playwright',
      viewportDesktop: { width: 1440, height: 900 },
      viewportMobile: { width: 390, height: 844 },
      webglRenderer: boot.renderer,
      fixture: 'GameEngine local com identidade sintética isolada; sem login Firebase e sem saves de produção',
    },
    observations: {
      initial: start, afterMovement: afterMove, afterStop, movementDistance: distance, stopDrift,
      canvasCount: boot.canvasCount, title: boot.title,
    },
    events: await page.evaluate(() => window.__MATRIX_EXPLORER__?.getEvents() ?? []),
    pageErrors, consoleErrors,
    screenshots: ['world-initial.png', 'world-after-movement.png', 'world-mobile.png'],
  };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(outputDir, 'report.md'), [
    '# Matrix Explorer — relatório de observação', '',
    `- Estado: **${report.status}**`,
    `- Data: ${report.generatedAt}`,
    `- Renderizador WebGL: ${report.environment.webglRenderer ?? 'não identificado'}`,
    `- Região: ${start.sectorName}`,
    `- Posição inicial: x=${start.catX.toFixed(2)}, z=${start.catZ.toFixed(2)}`,
    `- Posição após movimento: x=${afterMove.catX.toFixed(2)}, z=${afterMove.catZ.toFixed(2)}`,
    `- Deslocamento observado: ${distance.toFixed(2)} unidades`,
    `- Deriva após parada: ${stopDrift.toFixed(3)} unidades`,
    `- Erros fatais de página: ${pageErrors.length}`, '',
    'Capturas e JSON estruturado acompanham este relatório como artefatos.',
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
