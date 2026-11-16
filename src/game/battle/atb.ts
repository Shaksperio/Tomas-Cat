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

export type FoeSide = 'opponent' | 'opponent2' | 'opponent3' | 'opponent4';
export type Side = 'player' | FoeSide;
export const FOE_SIDES: readonly FoeSide[] = ['opponent', 'opponent2', 'opponent3', 'opponent4'];
export const MAX_FOES = FOE_SIDES.length;
export type BattleCommand = 'attack' | 'flurry' | 'guard' | 'limit' | 'item' | 'magic' | 'combo_a' | 'combo_b';

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
  /** Oponentes extras (duelo em grupo: 1 contra até 4). */
  opponent2?: Combatant;
  opponent3?: Combatant;
  opponent4?: Combatant;
  /** Quantos oponentes existem (1 a 4). */
  foeCount: number;
  /** Raçoes consumíveis disponíveis para o jogador nesta batalha. */
  playerItems: number;
  /** Tempo restante para decidir quando Tomas está pronto (segundos). */
  playerTurnTimeLeft: number;
  /** Quem está pronto para agir (aguardando comando/IA). */
  ready: Side | null;
  turn: number;
  finished: boolean;
  /** 'opponent' significa "o lado adversário venceu". */
  winner: 'player' | 'opponent' | null;
  reason: 'knockout' | 'turns' | 'forfeit' | null;
  rngState: number;
  /** Poder de ataque do jogador (≈ dano da garra / 12). */
  playerPower: number;
  /** Nível do jogador: define a força da sequência especial. */
  playerLevel: number;
  /** Nível de cada oponente (mesma ordem de FOE_SIDES). */
  foeLevels: number[];
  /** Compatibilidade: nível do primeiro oponente. */
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
  /** O alvo caiu com esta ação (a batalha pode continuar se restarem oponentes). */
  knockedOut: boolean;
  /** Esta ação encerrou a batalha. */
  finishing: boolean;
  /** Recuperação de vigor aplicada por um item. */
  healing?: number;
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
/** Turnos extras permitidos por oponente adicional. */
export const EXTRA_TURNS_PER_FOE = 30;

export const PLAYER_TURN_SECONDS = 10;
export const MAGIC_MANA_COST = 25;
export const COMBO_UNLOCKS = { combo_a: 25, combo_b: 55 } as const;
export const COMBO_MANA_COST = { combo_a: 35, combo_b: 70 } as const;

export const COMMAND_LABELS: Record<BattleCommand, string> = {
  attack: 'Arranhar',
  flurry: 'Garra Furiosa',
  guard: 'Defender',
  limit: 'Sequência Especial: Garra Meteoro',
  item: 'Usar Ração',
  magic: 'Magia: Orbe Arcano',
  combo_a: 'Rasante Duplo',
  combo_b: 'Tempestade de Garras',
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

export interface CreateBattleExtra {
  /** Maná com que o jogador entra (mantido de uma batalha vencida). */
  playerMana?: number;
  /** Níveis dos oponentes; o tamanho define o grupo (1 a 4). */
  foeLevels?: number[];
  playerItems?: number;
}

export function createBattle(
  seed: number,
  playerPower: number,
  playerLevel = 1,
  opponentLevel = 10,
  extra: CreateBattleExtra = {},
): BattleState {
  const foeLevels = (extra.foeLevels && extra.foeLevels.length > 0 ? extra.foeLevels : [opponentLevel]).slice(0, MAX_FOES);
  const state: BattleState = {
    player: {
      vigor: VIGOR_MAX,
      atb: 55,
      limit: Math.max(0, Math.min(LIMIT_MAX, Math.round(extra.playerMana ?? 0))),
      guarding: false,
      speed: 24,
    },
    opponent: { vigor: VIGOR_MAX, atb: 20, limit: 0, guarding: false, speed: 18 },
    foeCount: foeLevels.length,
    playerItems: Math.max(0, Math.floor(extra.playerItems ?? 0)),
    playerTurnTimeLeft: 0,
    ready: null,
    turn: 0,
    finished: false,
    winner: null,
    reason: null,
    rngState: seed >>> 0,
    playerPower: Math.max(0.5, Math.min(6, playerPower)),
    playerLevel,
    foeLevels,
    opponentLevel: foeLevels[0],
  };
  // Ritmo de cada oponente conforme a semente (determinístico); extras começam em fases diferentes.
  for (let i = 0; i < foeLevels.length; i += 1) {
    const side = FOE_SIDES[i];
    const speed = 16 + Math.floor(rand(state) * 7);
    if (i === 0) state.opponent.speed = speed;
    else state[side] = { vigor: VIGOR_MAX, atb: 10 + i * 4, limit: 0, guarding: false, speed };
  }
  return state;
}

/** Acessa um lutador (lança erro se o lado não existe nesta batalha). */
export function fighter(state: BattleState, side: Side): Combatant {
  const c = state[side];
  if (!c) throw new Error(`Lutador inexistente: ${side}`);
  return c;
}

/** Oponentes que existem nesta batalha (vivos ou não). */
export function foeSides(state: BattleState): FoeSide[] {
  return FOE_SIDES.slice(0, state.foeCount);
}

/** Oponentes ainda de pé. */
export function livingFoes(state: BattleState): FoeSide[] {
  return foeSides(state).filter((s) => fighter(state, s).vigor > 0);
}

export const isFoe = (side: Side): side is FoeSide => side !== 'player';

function levelOf(state: BattleState, side: Side): number {
  if (side === 'player') return state.playerLevel;
  return state.foeLevels[FOE_SIDES.indexOf(side)] ?? state.opponentLevel;
}

/** Poder de ataque dos oponentes; em grupo cada um bate um pouco mais fraco. */
function foePower(state: BattleState): number {
  return 1.4 * (1 - 0.12 * (state.foeCount - 1));
}

/**
 * Avança o ATB. Retorna quem ficou pronto (ou null). Enquanto `ready` estiver
 * definido o relógio não anda (modo espera).
 */
export function tickAtb(state: BattleState, dt: number): Side | null {
  if (state.finished || state.ready) return state.ready;
  const sides: Side[] = ['player', ...livingFoes(state)];
  for (const side of sides) {
    const c = fighter(state, side);
    c.atb = Math.min(ATB_MAX, c.atb + c.speed * dt);
  }
  // Empate de barras: quem tem menos vigor (mais necessitado) age primeiro; jogador desempata.
  const full = sides.filter((s) => fighter(state, s).atb >= ATB_MAX);
  if (full.length > 0) {
    full.sort((a, b) => fighter(state, a).vigor - fighter(state, b).vigor || (a === 'player' ? -1 : b === 'player' ? 1 : 0));
    state.ready = full[0];
    state.playerTurnTimeLeft = state.ready === 'player' ? PLAYER_TURN_SECONDS : 0;
  }
  return state.ready;
}

/** Conta somente o prazo da decisão humana; true indica que o prazo expirou. */
export function tickPlayerDecisionTimer(state: BattleState, dt: number): boolean {
  if (state.finished || state.ready !== 'player') return false;
  state.playerTurnTimeLeft = Math.max(0, state.playerTurnTimeLeft - Math.max(0, dt));
  return state.playerTurnTimeLeft <= 0;
}

export function canUseCommand(state: BattleState, side: Side, command: BattleCommand): boolean {
  if (state.finished || state.ready !== side) return false;
  if (command === 'limit') return fighter(state, side).limit >= LIMIT_MAX;
  if (command === 'magic') return side === 'player' && fighter(state, side).limit >= MAGIC_MANA_COST;
  if (command === 'item') return side === 'player' && state.playerItems > 0 && state.player.vigor < VIGOR_MAX;
  if (command === 'combo_a') return side === 'player' && state.playerLevel >= COMBO_UNLOCKS.combo_a && state.player.limit >= COMBO_MANA_COST.combo_a;
  if (command === 'combo_b') return side === 'player' && state.playerLevel >= COMBO_UNLOCKS.combo_b && state.player.limit >= COMBO_MANA_COST.combo_b;
  return true;
}

/** IA do oponente (determinística pela semente). */
export function chooseOpponentCommand(state: BattleState, side: FoeSide = 'opponent'): BattleCommand {
  const foe = fighter(state, side);
  if (foe.limit >= LIMIT_MAX) return 'limit';
  const roll = rand(state);
  if (foe.vigor < 35 && !foe.guarding && roll < 0.4) return 'guard';
  if (roll < 0.32) return 'flurry';
  return 'attack';
}

/** Alvo padrão do jogador: o oponente de pé com menos vigor. */
export function defaultTarget(state: BattleState): FoeSide {
  const alive = livingFoes(state);
  if (alive.length === 0) return 'opponent';
  return alive.reduce((best, s) => (fighter(state, s).vigor < fighter(state, best).vigor ? s : best), alive[0]);
}

function applyHit(state: BattleState, target: Side, raw: number, ignoreGuard: boolean): BattleHit & { blocked: boolean } {
  const t = fighter(state, target);
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
 * ser animado (golpes, nomes, dano). O jogador pode escolher o alvo em grupo.
 */
export function resolveCommand(
  state: BattleState,
  actor: Side,
  command: BattleCommand,
  chosenTarget?: FoeSide,
): BattleAction {
  if (!canUseCommand(state, actor, command)) throw new Error('Comando indisponível.');
  let target: Side = 'player';
  if (actor === 'player' && command !== 'item') {
    target = chosenTarget && fighter(state, chosenTarget).vigor > 0 && foeSides(state).includes(chosenTarget) ? chosenTarget : defaultTarget(state);
  }
  const me = fighter(state, actor);
  const power = actor === 'player' ? state.playerPower : foePower(state);
  const hits: BattleHit[] = [];
  let blocked = false;
  let healing: number | undefined;

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
    case 'item': {
      state.playerItems = Math.max(0, state.playerItems - 1);
      healing = Math.min(28, VIGOR_MAX - state.player.vigor);
      state.player.vigor = Math.min(VIGOR_MAX, state.player.vigor + healing);
      me.atb = 0;
      break;
    }
    case 'magic': {
      me.limit -= MAGIC_MANA_COST;
      const r = applyHit(state, target, 18 + power * 2 + Math.floor(rand(state) * 5), false);
      hits.push({ damage: r.damage, crit: r.crit });
      blocked = r.blocked;
      me.atb = 0;
      break;
    }
    case 'combo_a': {
      me.limit -= COMBO_MANA_COST.combo_a;
      for (let i = 0; i < 4; i += 1) {
        const r = applyHit(state, target, 7 + power * 1.6 + Math.floor(rand(state) * 3), false);
        hits.push({ damage: r.damage, crit: r.crit });
        blocked = blocked || r.blocked;
      }
      me.atb = -10;
      break;
    }
    case 'combo_b': {
      me.limit -= COMBO_MANA_COST.combo_b;
      for (let i = 0; i < 6; i += 1) {
        const r = applyHit(state, target, 8 + power * 1.9 + Math.floor(rand(state) * 4), false);
        hits.push({ damage: r.damage, crit: r.crit });
        blocked = blocked || r.blocked;
      }
      me.atb = -25;
      break;
    }
    case 'limit': {
      me.limit = 0;
      const sp = specialProfile(levelOf(state, actor));
      for (let i = 0; i < sp.hits; i += 1) {
        const r = applyHit(state, target, sp.totalDamage / sp.hits + Math.floor(rand(state) * 3), true);
        hits.push({ damage: r.damage, crit: r.crit });
      }
      me.atb = 0;
      break;
    }
  }

  if (command === 'attack' || command === 'flurry' || command === 'guard') me.limit = Math.min(LIMIT_MAX, me.limit + MANA_GAIN[command]);
  state.ready = null;
  state.playerTurnTimeLeft = 0;
  state.turn += 1;
  const knockedOut = command !== 'guard' && command !== 'item' && fighter(state, target).vigor <= 0;
  const maxTurns = MAX_TURNS + EXTRA_TURNS_PER_FOE * (state.foeCount - 1);
  let finishing = false;
  if (state.player.vigor <= 0) {
    state.finished = true;
    state.winner = 'opponent';
    state.reason = 'knockout';
    finishing = true;
  } else if (livingFoes(state).length === 0) {
    state.finished = true;
    state.winner = 'player';
    state.reason = 'knockout';
    finishing = true;
  } else if (state.turn >= maxTurns) {
    state.finished = true;
    state.reason = 'turns';
    const foeVigor = foeSides(state).reduce((sum, s) => sum + fighter(state, s).vigor, 0) / state.foeCount;
    if (state.player.vigor > foeVigor) state.winner = 'player';
    else if (foeVigor > state.player.vigor) state.winner = 'opponent';
    else state.winner = null;
    finishing = true;
  }
  return { actor, target, command, name: COMMAND_LABELS[command], hits, blocked, knockedOut, finishing, ...(healing ? { healing } : {}) };
}

export function forfeitBattle(state: BattleState): void {
  if (state.finished) return;
  state.finished = true;
  state.winner = 'opponent';
  state.reason = 'forfeit';
  state.ready = null;
  state.playerTurnTimeLeft = 0;
}
