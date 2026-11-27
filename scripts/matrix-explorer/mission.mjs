import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function validateMission(input) {
  const allowed = ['version','id','goal','constraints'];
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new Error('Missão inválida: objeto raiz ou propriedades não permitidas.');
  }
  if (input.version !== 1 || typeof input.id !== 'string'
    || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(input.id)) {
    throw new Error('Missão inválida: version deve ser 1 e id deve ser um identificador simples.');
  }
  const goal = input.goal;
  if (!goal || typeof goal !== 'object' || Array.isArray(goal)
    || Object.keys(goal).some((key) => !['type','targetKind','targetId'].includes(key))
    || goal.type !== 'visit_shop' || goal.targetKind !== 'shop'
    || (goal.targetId !== undefined && (typeof goal.targetId !== 'string' || goal.targetId.length > 128))) {
    throw new Error('Missão inválida: somente goal visit_shop para kind shop é permitido nesta versão.');
  }
  const raw = input.constraints ?? {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)
    || Object.keys(raw).some((key) => !['maxDurationSeconds','maxWaypoints','sprint','interact'].includes(key))) {
    throw new Error('Missão inválida: constraints contém propriedades não permitidas.');
  }
  const constraints = {
    maxDurationSeconds: raw.maxDurationSeconds ?? 60,
    maxWaypoints: raw.maxWaypoints ?? 40,
    sprint: raw.sprint ?? false,
    interact: raw.interact ?? true,
  };
  if (!Number.isInteger(constraints.maxDurationSeconds) || constraints.maxDurationSeconds < 10 || constraints.maxDurationSeconds > 120
    || !Number.isInteger(constraints.maxWaypoints) || constraints.maxWaypoints < 1 || constraints.maxWaypoints > 80
    || typeof constraints.sprint !== 'boolean' || typeof constraints.interact !== 'boolean') {
    throw new Error('Missão inválida: limites fora do intervalo ou tipos incorretos.');
  }
  return { version: 1, id: input.id, goal: { ...goal }, constraints };
}

export async function loadMission(args, env = process.env) {
  const index = args.indexOf('--mission');
  if (index >= 0) {
    const file = args[index + 1];
    if (!file || file.startsWith('--')) throw new Error('Informe o caminho do arquivo após --mission.');
    const raw = await readFile(path.resolve(process.cwd(), file), 'utf8');
    return validateMission(JSON.parse(raw));
  }
  if (env.MATRIX_EXPLORER_MISSION_FILE) {
    const raw = await readFile(path.resolve(process.cwd(), env.MATRIX_EXPLORER_MISSION_FILE), 'utf8');
    return validateMission(JSON.parse(raw));
  }
  return validateMission({
    version: 1,
    id: 'ci-nearest-shop',
    goal: { type: 'visit_shop', targetKind: 'shop' },
    constraints: { maxDurationSeconds: 60, maxWaypoints: 40, sprint: false, interact: true },
  });
}
