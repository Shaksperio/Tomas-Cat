/**
 * Ponte mínima para não duplicar hourOf / isMoonTime.
 * Mantém skyAtmosphere testável sem importar o módulo completo de dayCycle
 * se o bundler reclamar de ciclos; na prática reexporta a mesma regra.
 */

/** Cópia local da regra de hora (mesma fórmula de dayCycle.ts). */
export function hourOfFromTime(timeOfDay: number): number {
  return Math.round((((timeOfDay % 1) + 1) % 1) * 24 * 1e6) / 1e6;
}

export const MOON_START_HOUR = 20;
export const MOON_END_HOUR = 5;

export function isMoonTime(timeOfDay: number): boolean {
  const hour = hourOfFromTime(timeOfDay);
  return hour >= MOON_START_HOUR || hour < MOON_END_HOUR;
}
