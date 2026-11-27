import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentProfession } from '../society/contracts';
import { MUNICIPAL_DEVELOPER_ID, planHousingDevelopment } from './developmentDirector';
import { canStaff, requiredTeam, ROLE_PROFESSION } from './developmentRoles';
import { LandRegistry } from './landRegistry';
import type { ExistingBuilding, Lot, ProjectProposal, UrbanContext } from './types';
import { buildableEnvelope, evaluateProject, rectGap, roadDistanceToRect } from './urbanPlanning';

const lot = (over: Partial<Lot> = {}): Lot => ({
  id: 'lote-a', worldId: 'quarantine-city', sectorId: 'subúrbio', zone: 'residential', frontage: 'south',
  x: 0, z: 0, width: 20, depth: 20, slope: 0, soil: 'firm', ownerId: MUNICIPAL_DEVELOPER_ID, status: 'free', ...over,
});

const baseCtx = (over: Partial<UrbanContext> = {}, lots: Lot[] = [lot()]): UrbanContext => ({
  lots: new Map(lots.map((l) => [l.id, l])),
  buildings: [],
  roads: [{ id: 'rua-1', ax: -50, az: 15, bx: 50, bz: 15, width: 6 }],
  utilities: [
    { id: 'u-agua', kind: 'water', x: 10, z: 12 }, { id: 'u-luz', kind: 'power', x: -10, z: 12 }, { id: 'u-esg', kind: 'sewage', x: 0, z: 14 },
  ],
  sectorUnits: new Map(),
  ...over,
});

const proposal = (over: Partial<ProjectProposal> = {}): ProjectProposal => ({
  id: 'p1', lotId: 'lote-a', developerId: MUNICIPAL_DEVELOPER_ID, use: 'residential',
  footprint: { width: 8, depth: 8 }, offset: { x: 0, z: -0.5 }, floors: 2, height: 7, units: 2, ...over,
});

const codes = (p: ProjectProposal, ctx: UrbanContext) => evaluateProject(p, ctx).violations.map((v) => v.code);

test('projeto válido é aprovado sem violações', () => {
  assert.deepEqual(evaluateProject(proposal(), baseCtx()), { approved: true, violations: [] });
});

test('recuos: o envelope respeita testada, frente, fundos e laterais', () => {
  const env = buildableEnvelope(lot())!;
  assert.deepEqual(env, { x: 0, z: -0.5, width: 17, depth: 15 });
  assert.deepEqual(codes(proposal({ offset: { x: 6, z: -0.5 } }), baseCtx()), ['OUTSIDE_ENVELOPE']);
  assert.deepEqual(codes(proposal({ offset: { x: 0, z: 4 } }), baseCtx()), ['OUTSIDE_ENVELOPE']);
});

test('rejeita propriedade, uso, área protegida, lote desconhecido e dados inválidos', () => {
  assert.ok(codes(proposal({ developerId: 'outro' }), baseCtx()).includes('NOT_OWNER'));
  assert.ok(codes(proposal({ use: 'industrial' }), baseCtx()).includes('ZONE_USE'));
  assert.ok(codes(proposal(), baseCtx({}, [lot({ protectedArea: true })])).includes('PROTECTED_AREA'));
  assert.ok(codes(proposal(), baseCtx({}, [lot({ status: 'built' })])).includes('LOT_UNAVAILABLE'));
  assert.deepEqual(codes(proposal({ lotId: 'nao-existe' }), baseCtx()), ['LOT_UNKNOWN']);
  assert.deepEqual(codes(proposal({ height: Number.NaN }), baseCtx()), ['INVALID_PROPOSAL']);
  assert.deepEqual(codes(proposal({ units: 1.5 }), baseCtx()), ['INVALID_PROPOSAL']);
});

test('rejeita altura, solo mole, declive e ocupação excessiva', () => {
  assert.ok(codes(proposal({ height: 20 }), baseCtx()).includes('HEIGHT'));
  assert.ok(codes(proposal({ height: 10 }), baseCtx({}, [lot({ soil: 'soft' })])).includes('SOIL'));
  assert.ok(codes(proposal({ height: 7 }), baseCtx({}, [lot({ soil: 'soft' })])).length === 0);
  assert.ok(codes(proposal(), baseCtx({}, [lot({ slope: 0.4 })])).includes('SLOPE'));
  assert.ok(codes(proposal({ footprint: { width: 17, depth: 15 }, offset: { x: 0, z: -0.5 } }), baseCtx()).includes('COVERAGE'));
});

test('rua: não constrói sobre a via nem sem calçada, e exige acesso viário', () => {
  const road = { id: 'rua-2', ax: -50, az: 0, bx: 50, bz: 0, width: 6 };
  assert.ok(codes(proposal(), baseCtx({ roads: [road] })).includes('ROAD_OVERLAP'));
  assert.ok(codes(proposal(), baseCtx({ roads: [{ ...road, az: 7, bz: 7 }] })).includes('ROAD_OVERLAP'));
  assert.ok(codes(proposal(), baseCtx({ roads: [] })).includes('ROAD_ACCESS'));
  assert.equal(roadDistanceToRect(road, { x: 0, z: 0, width: 4, depth: 4 }), 0);
  assert.equal(roadDistanceToRect({ ...road, az: 10, bz: 10 }, { x: 0, z: 0, width: 4, depth: 4 }), 8);
});

const neighbor = (over: Partial<ExistingBuilding> = {}): ExistingBuilding => ({
  id: 'vizinho', lotId: 'lote-b', use: 'residential', x: 0, z: -30, width: 8, depth: 8, height: 3, units: 1, needsSun: true, ...over,
});

test('distância mínima entre edificações', () => {
  assert.ok(codes(proposal(), baseCtx({ buildings: [neighbor({ z: -10, needsSun: false })] })).includes('SPACING'));
  assert.ok(!codes(proposal(), baseCtx({ buildings: [neighbor({ z: -30, needsSun: false })] })).includes('SPACING'));
});

test('insolação: torre ao sul não pode sombrear moradia ao norte', () => {
  const tall = proposal({ height: 12, floors: 3, units: 4, footprint: { width: 8, depth: 8 } });
  // sombra = 12*1.2 = 14,4 para o norte a partir de z=-4,5 → alcança z≈-18,9
  assert.ok(codes(tall, baseCtx({ buildings: [neighbor({ z: -16 })] })).includes('SUNLIGHT'));
  assert.ok(!codes(tall, baseCtx({ buildings: [neighbor({ z: -30 })] })).includes('SUNLIGHT'));
  assert.ok(!codes(tall, baseCtx({ buildings: [neighbor({ z: -16, x: 30 })] })).includes('SUNLIGHT'));
});

test('vista protegida e densidade e utilidades', () => {
  const withView = neighbor({ z: -30, needsSun: false, protectedView: { x: 0, z: -3, width: 20, depth: 6, maxHeight: 4 } });
  assert.ok(codes(proposal(), baseCtx({ buildings: [withView] })).includes('VIEW'));
  assert.ok(!codes(proposal({ height: 3.5, floors: 1, units: 1 }), baseCtx({ buildings: [withView] })).includes('VIEW'));
  assert.ok(codes(proposal(), baseCtx({ sectorUnits: new Map([['subúrbio', 119]]) })).includes('DENSITY'));
  const noWater = baseCtx({ utilities: [{ id: 'u-luz', kind: 'power', x: 0, z: 0 }] });
  const v = evaluateProject(proposal(), noWater).violations.find((x) => x.code === 'UTILITIES')!;
  assert.ok(v.message.includes('water') && v.message.includes('sewage'));
});

test('geometria: distância entre retângulos', () => {
  assert.equal(rectGap({ x: 0, z: 0, width: 2, depth: 2 }, { x: 5, z: 0, width: 2, depth: 2 }), 3);
  assert.equal(rectGap({ x: 0, z: 0, width: 2, depth: 2 }, { x: 1, z: 0, width: 2, depth: 2 }), 0);
});

test('registro: lotes não se sobrepõem e transações exigem dono, preço e contrato único', () => {
  const reg = new LandRegistry();
  assert.deepEqual(reg.register(lot()), { ok: true });
  assert.equal(reg.register(lot()).ok, false);
  assert.equal(reg.register(lot({ id: 'lote-sobreposto', x: 5 })).ok, false);
  assert.equal(reg.register(lot({ id: 'outro-mundo', worldId: 'crystal-archipelago', x: 5 })).ok, true);
  const t = { lotId: 'lote-a', fromOwnerId: MUNICIPAL_DEVELOPER_ID, toOwnerId: 'agente-7', price: 120, contractId: 'ct-1', tick: 10 };
  assert.equal(reg.transfer({ ...t, fromOwnerId: 'impostor' }).ok, false);
  assert.equal(reg.transfer({ ...t, price: -1 }).ok, false);
  assert.equal(reg.transfer({ ...t, contractId: ' ' }).ok, false);
  assert.deepEqual(reg.transfer(t), { ok: true });
  assert.equal(reg.get('lote-a')!.ownerId, 'agente-7');
  assert.equal(reg.transfer({ ...t, fromOwnerId: 'agente-7', toOwnerId: 'agente-8' }).ok, false, 'contrato reutilizado');
  assert.equal(reg.transactionsOf('lote-a').length, 2);
});

test('registro: ciclo de obra e bloqueio de transferência em obra', () => {
  const reg = new LandRegistry();
  reg.register(lot());
  assert.equal(reg.setStatus('lote-a', 'built', 1).ok, false, 'não pula etapa');
  assert.equal(reg.setStatus('lote-a', 'under_construction', 2).ok, true);
  assert.equal(reg.transfer({ lotId: 'lote-a', fromOwnerId: MUNICIPAL_DEVELOPER_ID, toOwnerId: 'x', price: 1, contractId: 'c2', tick: 3 }).ok, false);
  assert.equal(reg.setStatus('lote-a', 'built', 4).ok, true);
  assert.equal(reg.setStatus('lote-a', 'free', 5).ok, false, 'prédio concluído não volta a livre');
});

const professions = (over: Partial<Record<AgentProfession, number>> = {}): Map<AgentProfession, number> =>
  new Map(Object.entries({ engineer: 2, worker: 6, carpenter: 1, agent: 1, ...over }) as [AgentProfession, number][]);

test('papéis: todos mapeiam para profissões existentes e inspetor nunca é engenheiro', () => {
  assert.equal(ROLE_PROFESSION.inspector, 'agent');
  assert.ok(requiredTeam(3, 6).some((s) => s.role === 'safety_engineer'));
  assert.ok(!requiredTeam(1, 1).some((s) => s.role === 'safety_engineer'));
  assert.deepEqual(canStaff(requiredTeam(1, 1), professions({ worker: 1 })).missing, ['worker: faltam 1']);
});

test('diretor: sem déficit não propõe; com déficit aprova um projeto válido e auditável', () => {
  const ctx = baseCtx();
  const state = { tick: 5, worldId: 'quarantine-city', population: 4, housingUnits: 2, availableProfessions: professions() };
  assert.equal(planHousingDevelopment(state, ctx).decision, 'none');
  const decision = planHousingDevelopment({ ...state, population: 12 }, ctx);
  assert.equal(decision.decision, 'approve');
  assert.equal(evaluateProject(decision.proposal!, ctx).approved, true);
  assert.deepEqual(decision, planHousingDevelopment({ ...state, population: 12 }, ctx), 'determinístico');
  assert.ok(decision.team!.length > 0);
});

test('diretor: sem equipe não aprova; lote inviável fica registrado nas rejeições', () => {
  const state = { tick: 5, worldId: 'quarantine-city', population: 12, housingUnits: 0, availableProfessions: professions({ worker: 0 }) };
  const noTeam = planHousingDevelopment(state, baseCtx());
  assert.equal(noTeam.decision, 'none');
  assert.match(noTeam.reason, /sem equipe/);
  const noUtilities = planHousingDevelopment({ ...state, availableProfessions: professions() }, baseCtx({ utilities: [] }));
  assert.equal(noUtilities.decision, 'none');
  assert.ok(noUtilities.rejected.length > 0 && noUtilities.rejected[0].violations.some((v) => v.code === 'UTILITIES'));
  const privateLot = planHousingDevelopment({ ...state, availableProfessions: professions() }, baseCtx({}, [lot({ ownerId: 'particular' })]));
  assert.match(privateLot.reason, /Nenhum lote residencial municipal/);
});
