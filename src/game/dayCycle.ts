/**
 * Ciclo do dia: períodos, paletas do céu e janela da lua (lógica pura).
 * timeOfDay vai de 0 a 1 (0 = meia-noite). A HUD e o motor usam os mesmos limites.
 */

export type DayPeriod =
  | 'Madrugada'
  | 'Alvorecer'
  | 'Manhã'
  | 'Dia'
  | 'Tarde'
  | 'Anoitecer'
  | 'Noite';

function hourOf(timeOfDay: number): number {
  // Arredonda para evitar erros de ponto flutuante nas fronteiras (ex.: 5/24*24).
  return Math.round((((timeOfDay % 1) + 1) % 1) * 24 * 1e6) / 1e6;
}

export function getDayPeriod(timeOfDay: number): DayPeriod {
  const hour = hourOf(timeOfDay);
  if (hour >= 5 && hour < 7) return 'Alvorecer';
  if (hour >= 7 && hour < 11) return 'Manhã';
  if (hour >= 11 && hour < 16) return 'Dia';
  if (hour >= 16 && hour < 18) return 'Tarde';
  if (hour >= 18 && hour < 20) return 'Anoitecer';
  if (hour >= 20) return 'Noite';
  return 'Madrugada';
}

/** A lua reina da Noite (20h) até o fim da Madrugada (5h). */
export const MOON_START_HOUR = 20;
export const MOON_END_HOUR = 5;

export function isMoonTime(timeOfDay: number): boolean {
  const hour = hourOf(timeOfDay);
  return hour >= MOON_START_HOUR || hour < MOON_END_HOUR;
}

/** 0 no início da janela lunar, 1 no fim; 0 fora dela. */
export function moonProgress(timeOfDay: number): number {
  if (!isMoonTime(timeOfDay)) return 0;
  const hour = hourOf(timeOfDay);
  const since = hour >= MOON_START_HOUR ? hour - MOON_START_HOUR : hour + (24 - MOON_START_HOUR);
  return since / (24 - MOON_START_HOUR + MOON_END_HOUR);
}

/** Cor do céu/névoa em horas-chave (hora, 0xRRGGBB). Cada período tem a sua. */
export const SKY_KEYFRAMES: ReadonlyArray<readonly [number, number]> = [
  [0, 0x0f1a30],    // madrugada
  [4.5, 0x16264a],
  [5.5, 0xa05cc0],  // alvorecer: lilás
  [6.5, 0xff9a5c],  // alvorecer: dourado rosado
  [8, 0x5a9cf0],    // manhã
  [12, 0x4fa0ff],   // dia
  [15.5, 0x5a9fee],
  [17, 0xffa850],   // tarde: âmbar
  [18.5, 0xb04a78], // anoitecer: magenta
  [20, 0x1f2748],   // noite
  [22, 0x0f1a30],
  [24, 0x0f1a30],
];

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function skyColorAt(timeOfDay: number): number {
  const hour = hourOf(timeOfDay);
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    const [h0, c0] = SKY_KEYFRAMES[i];
    const [h1, c1] = SKY_KEYFRAMES[i + 1];
    if (hour >= h0 && hour <= h1) {
      const t = h1 === h0 ? 0 : (hour - h0) / (h1 - h0);
      const r = lerpChannel((c0 >> 16) & 255, (c1 >> 16) & 255, t);
      const g = lerpChannel((c0 >> 8) & 255, (c1 >> 8) & 255, t);
      const b = lerpChannel(c0 & 255, c1 & 255, t);
      return (r << 16) | (g << 8) | b;
    }
  }
  return SKY_KEYFRAMES[0][1];
}
