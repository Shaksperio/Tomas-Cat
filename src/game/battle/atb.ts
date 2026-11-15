/**
 * Batalha por turnos com barra ATB (estilo RPG clássico) — lógica pura.
 *
 * Cada lutador enche uma barra ATB; quando cheia, age. Golpes recebidos
 * enchem a barra de LIMIT; com ela cheia, o lutador pode soltar um golpe especial.
 * A luta continua estilizada: o que se esgota é o vigor, não a vida real
 * (as apostas continuam regidas por `duel.ts`).
 *
 * O jogo só avança o ATB enquanto nenhuma ação está sendo animada ("modo espera").
 */

export type Side = 'player' | 'opponent';
export type BattleCommand = 'attack' | 'flurry' | 'guard' | 'limit';

export interface Combatant {
  vigor: number;
  atb: number;
  limit: number;
  guarding: boolean;
  /** Pontos de ATB por segundo. */
  speed: number;
}

export interface BattleState {
  player: Combatant;
  opponent: Combatant;
  /** Quem está pronto para agir (aguardando comando/IA). */
  ready: Side | null;
  turn: number;
  finished: boolean;
  winner: Side | null;
  reason: 'knockout' | 'turns' | 'forfeit' | null;
  rngState: number;
  /** Poder de ataque do jogador (≈ dano da garra / 12). */
  playerPower: number;
  /** Níveis dos lutadores: definem a força da sequência especial. */
  playerLevel: number;
  opponentLevel: number;
}

export interface BattleHit {
  damage: number;
  crit: boolean;
}

export interface BattleAction {
  actor: Side;
  target: Side;
  command: BattleCommand;
  name: string;
  hits: BattleHit[];
  /** O alvo estava defendendo e reduziu o dano. */
  blocked: boolean;
  /** O alvo caiu com esta ação. */
  finishing: boolean;
}

export const VIGOR_MAX = 100;
export const ATB_MAX = 100;
/** A barra de maná (campo `limit`) vai de 0 a 100. */
export const LIMIT_MAX = 100;
/** Maná ganho por quem executa o comando; quem apanha também ganha um pouco. */
export const MANA_GAIN: Record<'attack' | 'flurry' | 'guard', number> = { attack: 14, flurry: 24, guard: 6 };

export interface SpecialProfile {
  hits: number;
  /** Dano total aproximado da sequência (sem críticos), em vigor. */
  totalDamage: number;
}

/**
 * Sequência especial por nível: nível baixo tira pouca energia vital, nível alto
 * tira muita (nível 1 ≈ 18%; nível 99 ≈ 72% do vigor máximo). Regra pública.
 */
export function specialProfile(level: number): SpecialProfile {
  const lv = Math.max(1, Math.min(99, Math.floor(level)));
  return { hits: 3 + Math.floor(lv / 33), totalDamage: Math.round(18 + lv * 0.55) };
}
export const MAX_TURNS = 60;

export const COMMAND_LABELS: Record<BattleCommand, string> = {
  attack: 'Arranhar',
  flurry: 'Garra Furiosa',
  guard: 'Defender',
  limit: 'Sequência Especial: Garra Meteoro',
};

function nextRandom(state: number): { value: number; state: number } {
  const t = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, state: t };
}

function rand(state: BattleState): number {
  const r = nextRandom(state.rngState);
  state.rngState = r.state;
  return r.value;
}

export function seedFromText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createBattle(
  seed: number,
  playerPower: number,
  playerLevel = 1,
  opponentLevel = 10,
): BattleState {
  const state: BattleState = {
    player: { vigor: VIGOR_MAX, atb: 55, limit: 0, guarding: false, speed: 24 },
    opponent: { vigor: VIGOR_MAX, atb: 20, limit: 0, guarding: false, speed: 18 },
    ready: null,
    turn: 0,
    finished: false,
    winner: null,
    reason: null,
    rngState: seed >>> 0,
    playerPower: Math.max(0.5, Math.min(6, playerPower)),
    playerLevel,
    opponentLevel,
  };
  // O oponente tem ritmo ligeiramente diferente conforme a semente (determinístico).
  state.opponent.speed = 16 + Math.floor(rand(state) * 7);
  return state;
}

const other = (side: Side): Side => (side === 'player' ? 'opponent' : 'player');

/**
 * Avança o ATB. Retorna quem ficou pronto (ou null). Enquanto `ready` estiver
 * definido o relógio não anda (modo espera).
 */
export function tickAtb(state: BattleState, dt: number): Side | null {
  if (state.finished || state.ready) return state.ready;
  state.player.atb = Math.min(ATB_MAX, state.player.atb + state.player.speed * dt);
  state.opponent.atb = Math.min(ATB_MAX, state.opponent.atb + state.opponent.speed * dt);
  if (state.player.atb >= ATB_MAX && state.opponent.atb >= ATB_MAX) {
    // Empate de barras: quem tem mais vigor perdido (mais necessitado) age primeiro.
    state.ready = state.player.vigor <= state.opponent.vigor ? 'player' : 'opponent';
  } else if (state.player.atb >= ATB_MAX) {
    state.ready = 'player';
  } else if (state.opponent.atb >= ATB_MAX) {
    state.ready = 'opponent';
  }
  return state.ready;
}

export function canUseCommand(state: BattleState, side: Side, command: BattleCommand): boolean {
  if (state.finished || state.ready !== side) return false;
  if (command === 'limit') return state[side].limit >= LIMIT_MAX;
  return true;
}

/** IA do oponente (determinística pela semente). */
export function chooseOpponentCommand(state: BattleState): BattleCommand {
  const foe = state.opponent;
  if (foe.limit >= LIMIT_MAX) return 'limit';
  const roll = rand(state);
  if (foe.vigor < 35 && !foe.guarding && roll < 0.4) return 'guard';
  if (roll < 0.32) return 'flurry';
  return 'attack';
}

function applyHit(state: BattleState, target: Side, raw: number, ignoreGuard: boolean): BattleHit & { blocked: boolean } {
  const t = state[target];
  const crit = rand(state) < 0.12;
  let damage = raw * (crit ? 1.6 : 1);
  const blocked = t.guarding && !ignoreGuard;
  if (blocked) damage *= 0.5;
  damage = Math.max(1, Math.round(damage));
  t.vigor = Math.max(0, t.vigor - damage);
  // Apanhar também enche o maná (um pouco menos que atacar).
  t.limit = Math.min(LIMIT_MAX, t.limit + Math.min(14, damage * (blocked ? 0.5 : 0.8)));
  return { damage, crit, blocked };
}

/**
 * Executa o comando de quem está pronto. Atualiza o estado e devolve o que deve
 * ser animado (golpes, nomes, dano).
 */
export function resolveCommand(state: BattleState, actor: Side, command: BattleCommand): BattleAction {
  if (!canUseCommand(state, actor, command)) throw new Error('Comando indisponível.');
  const target = other(actor);
  const me = state[actor];
  const power = actor === 'player' ? state.playerPower : 1.4;
  const hits: BattleHit[] = [];
  let blocked = false;

  me.guarding = false; // a defesa dura até a próxima ação de quem defendeu
  switch (command) {
    case 'attack': {
      const r = applyHit(state, target, 11 + power * 2 + Math.floor(rand(state) * 5), false);
      hits.push({ damage: r.damage, crit: r.crit });
      blocked = r.blocked;
      me.atb = 0;
      break;
    }
    case 'flurry': {
      for (let i = 0; i < 3; i += 1) {
        const r = applyHit(state, target, 5 + power * 1.2 + Math.floor(rand(state) * 3), false);
        hits.push({ damage: r.damage, crit: r.crit });
        blocked = blocked || r.blocked;
      }
      me.atb = -15; // golpe pesado: demora mais para agir de novo
      break;
    }
    case 'guard': {
      me.guarding = true;
      me.atb = 25; // defender é rápido
      break;
    }
    case 'limit': {
      me.limit = 0;
      const sp = specialProfile(actor === 'player' ? state.playerLevel : state.opponentLevel);
      for (let i = 0; i < sp.hits; i += 1) {
        const r = applyHit(state, target, sp.totalDamage / sp.hits + Math.floor(rand(state) * 3), true);
        hits.push({ damage: r.damage, crit: r.crit });
      }
      me.atb = 0;
      break;
    }
  }

  if (command !== 'limit') me.limit = Math.min(LIMIT_MAX, me.limit + MANA_GAIN[command]);
  state.ready = null;
  state.turn += 1;
  const finishing = state[target].vigor <= 0;
  if (finishing) {
    state.finished = true;
    state.winner = actor;
    state.reason = 'knockout';
  } else if (state.turn >= MAX_TURNS) {
    state.finished = true;
    state.reason = 'turns';
    if (state.player.vigor > state.opponent.vigor) state.winner = 'player';
    else if (state.opponent.vigor > state.player.vigor) state.winner = 'opponent';
    else state.winner = null;
  }
  return { actor, target, command, name: COMMAND_LABELS[command], hits, blocked, finishing };
}

export function forfeitBattle(state: BattleState): void {
  if (state.finished) return;
  state.finished = true;
  state.winner = 'opponent';
  state.reason = 'forfeit';
  state.ready = null;
}
