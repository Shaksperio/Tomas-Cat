// Regressão da tela branca da batalha. Usa o laço REAL de requestAnimationFrame do motor e FALHA (exit 1) se:
//  - o clarão branco de abertura não decair (tela branca presa);
//  - o contador de quadros parar (laço morto);
//  - houver erro de página (ex.: TypeError no raycast);
//  - a oclusão não ocultar/restaurar um bloqueador entre a câmera e Tomas;
//  - a batalha não terminar e voltar a 'idle'.
// Uso: node scripts/battle-render-check/check.cjs <pasta-do-build>   (ver run.sh)
const { chromium } = require('playwright');
const dir = process.argv[2];
const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errors = [], warns = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warns.push(m.text()); });
  await page.goto('file://' + dir + '/index.html');
  await page.waitForTimeout(3000);
  const frames = () => page.evaluate(() => window.engine.renderer.info.render.frame);
  const fx = () => page.evaluate(() => { const e = window.engine; const h = e.buildDuelHud && e.buildDuelHud(); return { phase: e.duelPhase, flash: h ? h.flash : null, aw: h ? h.awaitingCommand : null }; });
  await page.evaluate(() => {
    const e = window.engine;
    for (let i = 0; i < 6; i++) e.society.step(50);
    const a = e.society.snapshot().agents[0];
    e.catPos.set(a.position.x + 3, 0, a.position.z); e.timeOfDay = 0.4; e.catYaw = Math.PI * 1.5; e.cat.root.position.copy(e.catPos);
    window.__vis0 = []; e.scene.traverse(o => { if (o.isMesh) window.__vis0.push([o.uuid, o.visible]); });
  });
  const shotStats = async (name) => {
    const buf = await page.screenshot({ path: dir + '/r-' + name + '.png' });
    return buf.length;
  };
  const f0 = await frames();
  await page.evaluate(() => { const e = window.engine; e.challengeNearest(); e.submitDuelOffer('coins', 30); });
  const timeline = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(250); timeline.push({ t: (i + 1) * 250, ...(await fx()), frames: (await frames()) - f0 }); await shotStats('intro' + i); }
  expect(timeline[timeline.length - 1].flash < 0.05, 'clarão branco não decaiu (tela branca presa)');
  expect(timeline[timeline.length - 1].frames > 20, 'laço de renderização parou');
  console.log('timeline', JSON.stringify(timeline.map(x => [x.t, x.phase, x.flash && +x.flash.toFixed(2), x.frames])));
  // Oclusão real: caixa pequena entre a câmera e Tomas deve sumir em <= 0.4 s e voltar quando sai do caminho.
  const occ = await page.evaluate(async () => {
    const e = window.engine, T = window.THREE;
    const box = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0xff00ff }));
    e.scene.add(box);
    const place = () => { const cam = e.camera.position; const f = e.battleStage.fighters.player.root; const tgt = new T.Vector3(); f.getWorldPosition(tgt); tgt.y += 0.7; box.position.copy(cam).lerp(tgt, 0.5); };
    place();
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let hidden = false;
    for (let i = 0; i < 14 && !hidden; i++) { await sleep(60); place(); hidden = box.visible === false; }
    box.position.set(500, 0, 500);
    let back = false;
    for (let i = 0; i < 14 && !back; i++) { await sleep(60); back = box.visible === true; }
    e.scene.remove(box);
    return { hidden, restored: back };
  });
  expect(occ.hidden && occ.restored, 'oclusão não ocultou/restaurou o bloqueador');
  console.log('occlusion', JSON.stringify(occ));
  await page.evaluate(() => { const b = window.engine.battle; if (b) { b.opponent.vigor = 1; } });
  // fim com comandos automáticos pelo laço real
  let guard = 0;
  while (guard++ < 160) {
    const s = await fx();
    if (s.phase !== 'fighting') break;
    if (s.aw) await page.evaluate(() => window.engine.battleCommand('attack'));
    await page.waitForTimeout(250);
    if (guard % 12 === 0) await shotStats('mid' + guard);
  }
  const end = await fx();
  const tEnd = Date.now(); while ((await fx()).phase !== 'idle' && Date.now() - tEnd < 30000) await page.waitForTimeout(500);
  await page.waitForTimeout(800);
  const after = await fx();
  const f1 = await frames(); await page.waitForTimeout(500); const f2 = await frames();
  await shotStats('after');
  const changed = await page.evaluate(() => { const e = window.engine; const m = new Map(window.__vis0); let n = 0; e.scene.traverse(o => { if (m.has(o.uuid) && m.get(o.uuid) !== o.visible) n++; }); return n; });
  console.log('end', JSON.stringify(end), 'after', JSON.stringify(after), 'loopAlive', f2 > f1, 'visibilityChanged', changed);
  expect(after.phase === 'idle', 'a batalha não voltou ao modo exploração');
  expect(f2 > f1, 'laço de renderização parou após a batalha');
  const real = errors.filter(x => !x.includes('ERR_TUNNEL') && !x.includes('net::'));
  expect(real.length === 0, 'erros de página: ' + real.slice(0, 2).join(' | '));
  console.log('errors', JSON.stringify(errors.filter(x => !x.includes('ERR_TUNNEL')).slice(0, 4)), 'warns', JSON.stringify(warns.filter(w => w.includes('BattleStage')).slice(0, 2)));
  await browser.close();
  if (failures.length) { console.error('FALHOU:\n - ' + failures.join('\n - ')); process.exit(1); }
  console.log('OK: batalha renderiza do início ao fim e volta à exploração.');
})();
