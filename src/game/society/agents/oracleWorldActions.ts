import type { WeatherState } from '../../../types/game';
import { getModuleDef, type ConstructionAssetId } from '../constructionCatalog';

export type OracleWorldAction =
  | { type: 'set_weather'; weather: WeatherState }
  | { type: 'set_time'; timeOfDay: number }
  | { type: 'create_structure'; assetId: ConstructionAssetId; x: number; z: number };

const WEATHER_STATES = new Set<WeatherState>([
  'clear', 'rain', 'snow', 'cold_wind', 'freezing', 'acid_warning', 'acid_rain',
]);

/** Revalida a saída do modelo no cliente; texto livre nunca vira código executável. */
export function parseOracleWorldActions(value: unknown): OracleWorldAction[] {
  if (!Array.isArray(value)) return [];
  const actions: OracleWorldAction[] = [];
  for (const item of value.slice(0, 4)) {
    if (!item || typeof item !== 'object') continue;
    const action = item as Record<string, unknown>;
    if (action.type === 'set_weather' && typeof action.weather === 'string' && WEATHER_STATES.has(action.weather as WeatherState)) {
      actions.push({ type: 'set_weather', weather: action.weather as WeatherState });
      continue;
    }
    if (action.type === 'set_time' && typeof action.timeOfDay === 'number' && Number.isFinite(action.timeOfDay) && action.timeOfDay >= 0 && action.timeOfDay <= 1) {
      actions.push({ type: 'set_time', timeOfDay: action.timeOfDay });
      continue;
    }
    if (action.type === 'create_structure' && typeof action.assetId === 'string' && getModuleDef(action.assetId)
      && typeof action.x === 'number' && Number.isFinite(action.x) && typeof action.z === 'number' && Number.isFinite(action.z)
      && Math.abs(action.x) <= 180 && Math.abs(action.z) <= 180) {
      actions.push({ type: 'create_structure', assetId: action.assetId as ConstructionAssetId, x: action.x, z: action.z });
    }
  }
  return actions;
}