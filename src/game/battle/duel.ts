/**
 * Modo batalha 1x1 — lógica pura e determinística.
 *
 * Dois lutadores se encontram; um convida o outro. Antes de lutar, ambos
 * colocam em jogo a MESMA aposta: moedas (padrão 30), um item de valor
 * (sucata), uma parte da energia vital ou do oxigênio. Quem vencer leva o
 * que o perdedor apostou. A luta é estilizada (sem ferimentos): ela esgota o
 * "fôlego de luta" (vigor), não a vida real.
 *
 * Regras de segurança (públicas, ver AGENTS.md regra 10):
 *  - energia vital apostada nunca passa de 50% da atual e ninguém cai abaixo
 *    de 25% da vida máxima por causa de uma aposta (nunca se aposta tudo);
 *  - oxigênio segue a mesma regra de 50% (mínimo restante de 25%);
 *  - sem dinheiro ou item suficiente, a aposta é recusada;
 *  - o servidor futuro (fase 6+) deve chamar `settleDuel`; clientes não declaram resultados.
 */

export type StakeKind = 'coins' | 'item' | 'vitality' | 'oxygen';

export interface DuelStake {
  kind: StakeKind;
  amount: number;
  /** Obrigatório para `kind: 'item'`. */
  itemId?: string;
}

export interface DuelFighter {
  id: string;
  name: string;
  coins: number;
  items: Record<string, number>;
  health: number;
  maxHealth: number;
  oxygen: number;
  maxOxygen: number;
}

export const DEFAULT_COIN_STAKE = 30;
export const MAX_RISK_FRACTION = 0.5;
export const MIN_REMAINING_FRACTION = 0.25;
export const DUEL_TIME_LIMIT_SECONDS = 90;

export const ITEM_LABELS: Record<string, string> = {
  scrap: 'Sucata',
};

export const defaultStake: DuelStake = { kind: 'coins', amount: DEFAULT_COIN_STAKE };

/** Maior quantidade de energia vital/oxigênio que `current` pode arriscar. */
export function maxResourceStake(current: number, max: number): number {
  const byRisk = Math.floor(current * MAX_RISK_FRACTION);
  const byFloor = Math.floor(current - max * MIN_REMAINING_FRACTION);
  return Math.max(0, Math.min(byRisk, byFloor));
}

/** Retorna `null` se o lutador pode cobrir a aposta; senão, o motivo (pt-BR). */
export function validateStake(fighter: DuelFighter, stake: DuelStake): string | null {
  if (!Number.isFinite(stake.amount) || !Number.isInteger(stake.amount) || stake.amount <= 0) {
    return 'A aposta precisa ser um número inteiro maior que zero.';
  }
  switch (stake.kind) {
    case 'coins':
      return fighter.coins >= stake.amount ? null : `${fighter.name} não tem ${stake.amount} moedas.`;
    case 'item': {
      if (!stake.itemId) return 'Escolha qual item apostar.';
      const have = fighter.items[stake.itemId] ?? 0;
      const label = ITEM_LABELS[stake.itemId] ?? stake.itemId;
      return have >= stake.amount ? null : `${fighter.name} não tem ${stake.amount} × ${label}.`;
    }
    case 'vitality': {
      const cap = maxResourceStake(fighter.health, fighter.maxHealth);
      return stake.amount <= cap
        ? null
        : `${fighter.name} só pode arriscar até ${cap} de energia vital (nunca toda a energia).`;
    }
    case 'oxygen': {
      const cap = maxResourceStake(fighter.oxygen, fighter.maxOxygen);
      return stake.amount <= cap
        ? null
        : `${fighter.name} só pode arriscar até ${cap} de oxigênio (nunca todo o oxigênio).`;
    }
    default:
      return 'Tipo de aposta desconhecido.';
  }
}

/** A aposta só vale se os DOIS lutadores conseguem cobri-la. */
export function validateMatchedStake(
  challenger: DuelFighter,
  opponent: DuelFighter,
  stake: DuelStake,
): string | null {
  return validateStake(challenger, stake) ?? validateStake(opponent, stake);
}

export interface FighterChange {
  coins: number;
  items: Record<string, number>;
  health: number;
  oxygen: number;
}

export interface DuelSettlement {
  winnerId: string | null;
  loserId: string | null;
  draw: boolean;
  stake: DuelStake;
  changes: Record<string, FighterChange>;
}

const emptyChange = (): FighterChange => ({ coins: 0, items: {}, health: 0, oxygen: 0 });

/**
 * Liquida o duelo. Empate não transfere nada. O vencedor recebe, no máximo,
 * o que cabe nos seus limites (vida/oxigênio máximos); o perdedor sempre perde o apostado.
 */
export function settleDuel(
  a: DuelFighter,
  b: DuelFighter,
  stake: DuelStake,
  winnerId: string | null,
): DuelSettlement {
  const changes: Record<string, FighterChange> = { [a.id]: emptyChange(), [b.id]: emptyChange() };
  if (winnerId === null) {
    return { winnerId: null, loserId: null, draw: true, stake, changes };
  }
  if (winnerId !== a.id && winnerId !== b.id) throw new Error('Vencedor desconhecido.');
  const winner = winnerId === a.id ? a : b;
  const loser = winnerId === a.id ? b : a;
  if (validateMatchedStake(a, b, stake)) {
    // Aposta inválida na liquidação: nada é transferido (defesa contra estados corrompidos).
    return { winnerId, loserId: loser.id, draw: false, stake, changes };
  }
  const w = changes[winner.id];
  const l = changes[loser.id];
  switch (stake.kind) {
    case 'coins':
      l.coins = -stake.amount;
      w.coins = stake.amount;
      break;
    case 'item':
      l.items[stake.itemId!] = -stake.amount;
      w.items[stake.itemId!] = stake.amount;
      break;
    case 'vitality':
      l.health = -stake.amount;
      w.health = Math.min(stake.amount, Math.max(0, winner.maxHealth - winner.health));
      break;
    case 'oxygen':
      l.oxygen = -stake.amount;
      w.oxygen = Math.min(stake.amount, Math.max(0, winner.maxOxygen - winner.oxygen));
      break;
  }
  return { winnerId, loserId: loser.id, draw: false, stake, changes };
}

export function describeStake(stake: DuelStake): string {
  switch (stake.kind) {
    case 'coins':
      return `${stake.amount} moedas`;
    case 'item':
      return `${stake.amount} × ${ITEM_LABELS[stake.itemId ?? ''] ?? stake.itemId}`;
    case 'vitality':
      return `${stake.amount} de energia vital`;
    case 'oxygen':
      return `${stake.amount} de oxigênio`;
  }
}

// ---------------------------------------------------------------------------
// Aceite do convite pelo adversário controlado pelo jogo (determinístico).
// ---------------------------------------------------------------------------

export interface OpponentMood {
  /** 0–100. */
  morale: number;
  /** 0–100. */
  health: number;
  busyResting: boolean;
}

export interface ChallengeResponse {
  accepted: boolean;
  reason: string;
}

export function decideChallengeResponse(
  challenger: DuelFighter,
  opponent: DuelFighter,
  mood: OpponentMood,
  stake: DuelStake,
): ChallengeResponse {
  const invalid = validateMatchedStake(challenger, opponent, stake);
  if (invalid) return { accepted: false, reason: invalid };
  if (mood.busyResting) return { accepted: false, reason: `${opponent.name} está descansando e recusou o convite.` };
  if (mood.morale < 25) return { accepted: false, reason: `${opponent.name} não está com ânimo para brigar hoje.` };
  if ((stake.kind === 'vitality' || stake.kind === 'oxygen') && mood.health < 60) {
    return { accepted: false, reason: `${opponent.name} está cansado demais para apostar energia.` };
  }
  return { accepted: true, reason: `${opponent.name} aceitou o desafio!` };
}

// ---------------------------------------------------------------------------
// Luta estilizada: vigor, golpes e esquivas. Sem aleatoriedade global.
// ---------------------------------------------------------------------------

export interface DuelCombatState {
  playerVigor: number;
  opponentVigor: number;
  elapsed: number;
  opponentCooldown: number;
  finished: boolean;
  /** 'player' | 'opponent' | null (empate ou ainda lutando). */
  winner: 'player' | 'opponent' | null;
  reason: 'knockout' | 'time' | 'forfeit' | null;
  rngState: number;
}

export const VIGOR_MAX = 100;
export const STRIKE_RANGE = 3.4;

/** PRNG pequeno e determinístico (mulberry32) — só para variar o ritmo do oponente. */
function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, state: t };
}

export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createDuelCombat(seed: number): DuelCombatState {
  return {
    playerVigor: VIGOR_MAX,
    opponentVigor: VIGOR_MAX,
    elapsed: 0,
    opponentCooldown: 1.2,
    finished: false,
    winner: null,
    reason: null,
    rngState: seed >>> 0,
  };
}

function finish(
  state: DuelCombatState,
  winner: 'player' | 'opponent' | null,
  reason: 'knockout' | 'time' | 'forfeit',
): void {
  state.finished = true;
  state.winner = winner;
  state.reason = reason;
}

export type DuelEvent = 'player_hit' | 'player_miss' | 'opponent_hit' | 'opponent_miss';

/** Golpe do jogador. `power` ~ 1 no começo do jogo e cresce com a evolução. */
export function playerStrike(
  state: DuelCombatState,
  distance: number,
  power: number,
): DuelEvent | null {
  if (state.finished) return null;
  if (distance > STRIKE_RANGE) return 'player_miss';
  state.opponentVigor = Math.max(0, state.opponentVigor - (9 + 3 * Math.min(power, 6)));
  if (state.opponentVigor <= 0) finish(state, 'player', 'knockout');
  return 'player_hit';
}

/**
 * Avança a luta. O oponente ataca em intervalos variáveis; o jogador
 * esquiva se estiver pulando ou longe demais (> STRIKE_RANGE).
 */
export function tickDuel(
  state: DuelCombatState,
  dt: number,
  distance: number,
  playerDodging: boolean,
): DuelEvent[] {
  const events: DuelEvent[] = [];
  if (state.finished) return events;
  state.elapsed += dt;
  state.opponentCooldown -= dt;
  if (state.opponentCooldown <= 0) {
    const a = nextRandom(state.rngState);
    const b = nextRandom(a.state);
    state.rngState = b.state;
    state.opponentCooldown = 1.1 + a.value * 0.9;
    const reachable = distance <= STRIKE_RANGE;
    if (reachable && !playerDodging) {
      state.playerVigor = Math.max(0, state.playerVigor - (8 + Math.floor(b.value * 5)));
      events.push('opponent_hit');
      if (state.playerVigor <= 0) finish(state, 'opponent', 'knockout');
    } else {
      events.push('opponent_miss');
    }
  }
  if (!state.finished && state.elapsed >= DUEL_TIME_LIMIT_SECONDS) {
    if (state.playerVigor > state.opponentVigor) finish(state, 'player', 'time');
    else if (state.opponentVigor > state.playerVigor) finish(state, 'opponent', 'time');
    else finish(state, null, 'time');
  }
  return events;
}

export function forfeitDuel(state: DuelCombatState): void {
  if (!state.finished) finish(state, 'opponent', 'forfeit');
}
