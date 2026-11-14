/**
 * Água profunda, natação e oxigênio — lógica pura e determinística.
 *
 * Nenhuma dependência de Three.js: o motor (GameEngine) apenas consulta
 * `sampleWater` e `stepOxygen` a cada quadro. Tudo aqui é testável em Node.
 */

export interface WaterBody {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Raio da bacia (m). */
  radius: number;
  /** Altura da superfície da água (m); o chão da cidade está em y = 0. */
  surfaceY: number;
  /** Altura do fundo (m, negativa). */
  floorY: number;
}

export interface WaterSample {
  body: WaterBody | null;
  /** Os pés estão dentro da bacia (horizontalmente) e abaixo da superfície. */
  inWater: boolean;
  /** Profundidade dos pés sob a superfície (m, 0 se fora d'água). */
  footDepth: number;
  /** A cabeça está abaixo da superfície: oxigênio é consumido. */
  submerged: boolean;
  /** Altura do fundo onde o gato pisa (0 fora de bacias). */
  floorY: number;
}

export const OXYGEN_MAX = 100;
/** Segundos de fôlego completo com a cabeça submersa. */
export const BREATH_SECONDS = 28;
export const OXYGEN_DRAIN_PER_SECOND = OXYGEN_MAX / BREATH_SECONDS;
export const OXYGEN_RECOVER_PER_SECOND = 45;
/** Dano por segundo quando o oxigênio chega a 0 com a cabeça submersa. */
export const DROWNING_DAMAGE_PER_SECOND = 9;
/** Abaixo deste nível a HUD/aviso deve alertar o jogador. */
export const OXYGEN_WARNING_LEVEL = 30;

/** Superfície da água fica um pouco abaixo da calçada, formando uma bacia. */
export const WATER_SURFACE_Y = -0.3;

/** Profundidade da bacia segundo o raio: poças rasas, lagos fundos. */
export function basinDepthForRadius(radius: number): number {
  if (radius >= 3.0) return 3.4;
  if (radius >= 2.6) return 2.2;
  return 1.0;
}

export function createWaterBody(
  id: string,
  name: string,
  x: number,
  z: number,
  radius: number,
): WaterBody {
  return {
    id,
    name,
    x,
    z,
    radius,
    surfaceY: WATER_SURFACE_Y,
    floorY: -basinDepthForRadius(radius),
  };
}

export function findWaterBody(bodies: readonly WaterBody[], x: number, z: number): WaterBody | null {
  for (const body of bodies) {
    const dx = x - body.x;
    const dz = z - body.z;
    if (dx * dx + dz * dz < body.radius * body.radius) return body;
  }
  return null;
}

/**
 * Amostra a água em uma posição. `headHeight` é a altura da cabeça acima dos pés.
 */
export function sampleWater(
  bodies: readonly WaterBody[],
  x: number,
  y: number,
  z: number,
  headHeight: number,
): WaterSample {
  const body = findWaterBody(bodies, x, z);
  if (!body) {
    return { body: null, inWater: false, footDepth: 0, submerged: false, floorY: 0 };
  }
  const footDepth = Math.max(0, body.surfaceY - y);
  const inWater = footDepth > 0.12;
  const submerged = inWater && y + headHeight < body.surfaceY;
  return { body, inWater, footDepth, submerged, floorY: body.floorY };
}

export interface OxygenStep {
  oxygen: number;
  /** Dano de vida a aplicar neste passo (0 se não está se afogando). */
  drowningDamage: number;
  warning: boolean;
}

/** Consome oxigênio com a cabeça submersa; recupera rápido na superfície. */
export function stepOxygen(oxygen: number, submerged: boolean, dt: number): OxygenStep {
  if (submerged) {
    const next = Math.max(0, oxygen - OXYGEN_DRAIN_PER_SECOND * dt);
    const drowning = next <= 0;
    return {
      oxygen: next,
      drowningDamage: drowning ? DROWNING_DAMAGE_PER_SECOND * dt : 0,
      warning: next <= OXYGEN_WARNING_LEVEL,
    };
  }
  const next = Math.min(OXYGEN_MAX, oxygen + OXYGEN_RECOVER_PER_SECOND * dt);
  return { oxygen: next, drowningDamage: 0, warning: false };
}

export interface SwimInput {
  /** Pressionando para subir (pular). */
  ascend: boolean;
  /** Pressionando para mergulhar. */
  dive: boolean;
}

export const SWIM_SURFACE_SPEED_FACTOR = 0.55;
export const SWIM_UNDERWATER_SPEED_FACTOR = 0.45;
const DIVE_SPEED = -2.6;
const ASCEND_SPEED = 3.2;
const FLOAT_STIFFNESS = 5;

/**
 * Velocidade vertical durante a natação.
 * Sem comandos, Tomas flutua com a cabeça logo acima da superfície;
 * mergulhar/subir é intencional (nunca afunda sozinho).
 */
export function swimVerticalVelocity(
  y: number,
  headHeight: number,
  surfaceY: number,
  input: SwimInput,
): number {
  if (input.dive && !input.ascend) return DIVE_SPEED;
  if (input.ascend) return ASCEND_SPEED;
  const floatY = surfaceY - headHeight * 0.7;
  return Math.max(-3, Math.min(3, (floatY - y) * FLOAT_STIFFNESS));
}
