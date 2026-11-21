// Tour do mundo: só lê o motor (não altera o jogo). Gera inventory.json e capturas em <pasta>/shots.
const { chromium } = require('playwright');
const fs = require('fs');
const dir = process.argv[2];
fs.mkdirSync(dir + '/shots', { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + dir + '/index.html');
  await page.waitForTimeout(3000);
  const inv = await page.evaluate(() => {
    const e = window.engine, w = e.world;
    const r = (n) => Math.round(n * 10) / 10;
    const byKind = {};
    for (const i of w.interactables) (byKind[i.kind] ||= []).push({ id: i.id, name: i.name, item: i.itemId || null, x: r(i.position.x), y: r(i.position.y), z: r(i.position.z) });
    return {
      sectors: ['0,8', '-60,30', '100,-60', '150,40', '20,140', '-120,-80'].map(s => { const [x, z] = s.split(',').map(Number); return { x, z, name: w.getSectorName(x, z) }; }),
      interactablesByKind: byKind,
      counts: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.length])),
      predators: w.predators.map(p => ({ id: p.id || null, name: p.name || null, x: r(p.root ? p.root.position.x : 0), z: r(p.root ? p.root.position.z : 0) })),
      colliders: w.colliders.length, waterBodies: w.waterBodies.length, rivers: w.rivers.length, phaseGates: w.phaseGates.length, indoorZones: w.indoorZones.length,
      residents: e.society.snapshot().agents.map(a => ({ id: a.id, name: a.name, job: a.profession, x: r(a.position.x), z: r(a.position.z) })),
    };
  });
  const stops = [];
  for (const [kind, list] of Object.entries(inv.interactablesByKind)) list.slice(0, 2).forEach((o, i) => stops.push({ name: `obj-${kind}-${i}-${o.id}`, x: o.x, y: o.y, z: o.z }));
  inv.residents.slice(0, 4).forEach(a => stops.push({ name: `habitante-${a.id}`, x: a.x, z: a.z, y: 0 }));
  inv.shopStops = [['emporio', 8, 10], ['oficina', -60, 30], ['forja', 100, -60], ['telhados', 150, 40], ['posto-sul', 20, 140], ['meia-noite', -120, -80]];
  inv.shopStops.forEach(([n, x, z]) => stops.push({ name: `loja-${n}`, x, z, y: 0 }));
  for (const s of stops) {
    await page.evaluate(({ s }) => {
      const e = window.engine; e.timeOfDay = 0.45;
      e.catPos.set(s.x + 3.5, Math.max(0, s.y || 0), s.z + 3.5); e.catYaw = Math.PI * 1.25; e.cat.root.position.copy(e.catPos);
    }, { s });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${dir}/shots/${s.name}.png` });
  }
  inv.errors = errors; inv.shots = stops.map(s => s.name);
  fs.writeFileSync(dir + '/inventory.json', JSON.stringify(inv, null, 1));
  console.log('contagens', JSON.stringify(inv.counts), '| capturas', stops.length, '| erros', errors.length);
  await browser.close();
})();
