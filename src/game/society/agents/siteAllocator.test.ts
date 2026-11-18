import assert from 'node:assert/strict';
import test from 'node:test';
import { SocietySimulation } from '../simulation';
import { getModuleDef } from '../constructionCatalog';
import { allocateSite, MAX_TOTAL_PROJECTS } from './siteAllocator';
import { MAX_CONCURRENT_PROJECTS, SocietyAgentRuntime } from './societyAgentRuntime';

test('terreno livre: respeita ocupados e colisores, e devolve null sem espaço', () => {
  const a = allocateSite({ anchor: { x: 0, z: 0 }, radius: 2, occupied: [] })!;
  const b = allocateSite({ anchor: { x: 0, z: 0 }, radius: 2, occupied: [{ ...a, radius: 2 }] })!;
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 4);
  const far = allocateSite({ anchor: { x: 0, z: 0 }, radius: 2, occupied: [], isFree: (x, z) => Math.hypot(x, z) > 20 })!;
  assert.ok(Math.hypot(far.x, far.z) > 20);
  assert.equal(allocateSite({ anchor: { x: 0, z: 0 }, radius: 2, occupied: [], isFree: () => false }), null);
});

test('runtime: poucas obras simultâneas, obras concluem e nunca se sobrepõem', () => {
  const sim = new SocietySimulation();
  const runtime = new SocietyAgentRuntime({ cowilaEveryTicks: 25 });
  let maxInFlight = 0;
  for (let i = 0; i < 3000; i++) {
    runtime.step(sim, 1);
    const cr = runtime.getConstructionRuntime();
    const inFlight = cr.exportState().projects.filter((p) => {
      const pr = cr.getProjectProgress(p.project.id)!;
      return pr.completedTasks < pr.totalTasks;
    }).length;
    maxInFlight = Math.max(maxInFlight, inFlight);
  }
  assert.ok(maxInFlight <= MAX_CONCURRENT_PROJECTS, `simultâneas: ${maxInFlight}`);
  const projects = runtime.getConstructionRuntime().exportState().projects;
  assert.ok(projects.length >= 3, 'as obras precisam andar');
  assert.ok(projects.length <= MAX_TOTAL_PROJECTS);
  const done = projects.filter((p) => p.completedTaskIds.length === p.project.taskIds.length);
  assert.ok(done.length >= 1, 'nenhuma obra concluída');
  const sites = projects.map((p) => ({ ...p.project.modules[0].position, r: Math.hypot(getModuleDef(p.project.modules[0].assetId)!.footprintX, getModuleDef(p.project.modules[0].assetId)!.footprintZ) / 2 }));
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++)
    assert.ok(Math.hypot(sites[i].x - sites[j].x, sites[i].z - sites[j].z) >= sites[i].r + sites[j].r, `sobreposição ${i}/${j}`);
});

test('salvar e restaurar no meio do jogo gera o mesmo resultado que não interromper', () => {
  const play = (n: number, sim: SocietySimulation, rt: SocietyAgentRuntime) => { for (let i = 0; i < n; i++) rt.step(sim, 1); };
  const sim1 = new SocietySimulation(); const rt1 = new SocietyAgentRuntime({ cowilaEveryTicks: 25 }); play(1800, sim1, rt1);
  const sim2 = new SocietySimulation(); const rt2 = new SocietyAgentRuntime({ cowilaEveryTicks: 25 }); play(900, sim2, rt2);
  const saved = JSON.parse(JSON.stringify({ s: sim2.exportState(), r: rt2.exportState() }));
  const sim3 = new SocietySimulation(); const rt3 = new SocietyAgentRuntime({ cowilaEveryTicks: 25 });
  assert.ok(sim3.restoreState(saved.s)); assert.ok(rt3.restoreState(saved.r));
  play(900, sim3, rt3);
  assert.deepEqual({ s: sim3.exportState(), r: rt3.exportState() }, { s: sim1.exportState(), r: rt1.exportState() });
});
