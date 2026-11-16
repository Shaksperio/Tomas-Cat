/**
 * Atmosfera viva — lógica pura (fases da lua, densidade de nuvens, atividade de aves).
 * Não depende de Three.js. O GameEngine consome estes valores para meshes/partículas.
 *
 * Coordenação: esta frente não toca em dialogue/, atb.ts nem tipos de diálogo.
 * Ver AGENTS.md seção 0.
 */

import type { WeatherState } from '../../types/game';
import { hourOfFromTime, isMoonTime } from './dayCycleBridge';

/** Fase lunar contínua em [0, 1): 0 = nova, 0.5 = cheia, ciclo completo ≈ 8 dias de jogo. */
export function moonPhase(day: number, timeOfDay: number): number {
  const dayFrac = ((day % 1) + 1) % 1;
  const t = (Math.floor(day) + dayFrac + timeOfDay) / 8;
  return ((t % 1) + 1) % 1;
}

/**
 * Fração iluminada do disco lunar (0 = nova, 1 = cheia).
 * Aproximação cosenoidal simples e determinística.
 */
export function moonIllumination(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  return 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
}

/** Intensidade sugerida da luz da lua (0–1), já considerando se é horário lunar. */
export function moonLightFactor(day: number, timeOfDay: number): number {
  if (!isMoonTime(timeOfDay)) return 0;
  const illum = moonIllumination(moonPhase(day, timeOfDay));
  const hour = hourOfFromTime(timeOfDay);
  const nightBoost = hour >= 20 || hour < 2 ? 1 : 0.75;
  return Math.min(1, illum * 0.85 * nightBoost + 0.15);
}

export type CloudProfile = {
  density: number;
  drift: number;
  highCoverage: number;
};

export function cloudProfile(weather: WeatherState, timeOfDay: number): CloudProfile {
  const hour = hourOfFromTime(timeOfDay);
  const baseByWeather: Record<WeatherState, number> = {
    clear: 0.12,
    rain: 0.72,
    snow: 0.55,
    cold_wind: 0.35,
    freezing: 0.4,
    acid_warning: 0.65,
    acid_rain: 0.88,
  };
  let density = baseByWeather[weather] ?? 0.2;
  if (weather === 'clear') {
    if ((hour >= 6 && hour < 9) || (hour >= 16 && hour < 19)) density += 0.12;
  }
  density = Math.max(0, Math.min(1, density));
  const drift =
    weather === 'cold_wind' || weather === 'freezing' ? 1.4 :
    weather === 'rain' || weather === 'acid_rain' ? 1.1 :
    0.55;
  const highCoverage =
    weather === 'clear' ? density * 0.5 :
    weather === 'snow' ? density * 0.7 :
    density * 0.9;
  return { density, drift, highCoverage };
}

export type BirdActivity = {
  flockStrength: number;
  active: boolean;
};

export function birdActivity(weather: WeatherState, timeOfDay: number): BirdActivity {
  const hour = hourOfFromTime(timeOfDay);
  const badWeather =
    weather === 'acid_rain' ||
    weather === 'acid_warning' ||
    weather === 'rain' ||
    weather === 'freezing';
  if (badWeather) return { flockStrength: 0, active: false };
  if (hour >= 20 || hour < 5.5) return { flockStrength: 0, active: false };
  let strength = 0.25;
  if (hour >= 6 && hour < 10) strength = 0.85;
  else if (hour >= 16 && hour < 18.5) strength = 0.7;
  else if (hour >= 10 && hour < 16) strength = 0.4;
  if (weather === 'snow' || weather === 'cold_wind') strength *= 0.45;
  return {
    flockStrength: Math.max(0, Math.min(1, strength)),
    active: strength > 0.08,
  };
}

export type SkyAtmosphereSample = {
  moonPhase: number;
  moonIllumination: number;
  moonLightFactor: number;
  clouds: CloudProfile;
  birds: BirdActivity;
};

export function sampleSkyAtmosphere(
  day: number,
  timeOfDay: number,
  weather: WeatherState,
): SkyAtmosphereSample {
  const phase = moonPhase(day, timeOfDay);
  return {
    moonPhase: phase,
    moonIllumination: moonIllumination(phase),
    moonLightFactor: moonLightFactor(day, timeOfDay),
    clouds: cloudProfile(weather, timeOfDay),
    birds: birdActivity(weather, timeOfDay),
  };
}
