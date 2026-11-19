export type ExplicitOracleAction =
  | { type: 'set_weather'; weather: 'clear' | 'rain' | 'snow' | 'cold_wind' | 'freezing' | 'acid_warning' | 'acid_rain' }
  | { type: 'set_time'; timeOfDay: number }
  | { type: 'create_structure'; assetId: string; x: number; z: number }
  | { type: 'spawn_agent'; displayName: string; profession: string; x: number; z: number };

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function nearPosition(world: unknown, offset: number): { x: number; z: number } {
  const root = world && typeof world === 'object' ? world as Record<string, unknown> : {};
  const position = root.position && typeof root.position === 'object' ? root.position as Record<string, unknown> : {};
  const x = typeof position.x === 'number' && Number.isFinite(position.x) ? position.x : 0;
  const z = typeof position.z === 'number' && Number.isFinite(position.z) ? position.z : 8;
  return { x: Math.max(-150, Math.min(150, x + offset)), z: Math.max(-150, Math.min(150, z + offset)) };
}

/** Deterministic path for explicit Portuguese world commands; no LLM JSON extraction required. */
export function inferExplicitOracleActions(message: string, world: unknown): ExplicitOracleAction[] {
  const text = normalize(message);
  const command = /\b(mude|mudar|altere|alterar|transforme|transformar|faca|coloque|colocar|defina|definir|crie|criar|construa|construir|gere|gerar|spawn)\b/.test(text);
  if (!command) return [];

  if (/\b(chuva|chover|chovendo|tempestade)\b/.test(text)) return [{ type: 'set_weather', weather: 'rain' }];
  if (/\b(neve|nevar|nevando)\b/.test(text)) return [{ type: 'set_weather', weather: 'snow' }];
  if (/\b(vento frio|ventania fria)\b/.test(text)) return [{ type: 'set_weather', weather: 'cold_wind' }];
  if (/\b(geada|congelante|congelar)\b/.test(text)) return [{ type: 'set_weather', weather: 'freezing' }];
  if (/\b(chuva acida|chuva toxica)\b/.test(text)) return [{ type: 'set_weather', weather: 'acid_rain' }];
  if (/\b(alerta de chuva acida|aviso de chuva acida)\b/.test(text)) return [{ type: 'set_weather', weather: 'acid_warning' }];
  if (/\b(sol|ensolarado|ceu limpo|limpar o tempo)\b/.test(text) && /\b(clima|tempo|ceu)\b/.test(text)) return [{ type: 'set_weather', weather: 'clear' }];

  if (/\b(meia[- ]noite|madrugada)\b/.test(text) && /\b(horario|hora|dia|noite)\b/.test(text)) return [{ type: 'set_time', timeOfDay: 0 }];
  if (/\b(amanhecer|nascer do sol)\b/.test(text)) return [{ type: 'set_time', timeOfDay: 0.25 }];
  if (/\b(meio[- ]dia)\b/.test(text)) return [{ type: 'set_time', timeOfDay: 0.5 }];
  if (/\b(anoitecer|por do sol|entardecer)\b/.test(text)) return [{ type: 'set_time', timeOfDay: 0.75 }];
  if (/\b(noite)\b/.test(text) && /\b(horario|hora|dia)\b/.test(text)) return [{ type: 'set_time', timeOfDay: 0.85 }];

  const structures: Array<[RegExp, string]> = [
    [/\b(torre de vigia|torre)\b/, 'module_watchtower'],
    [/\b(armazem|deposito)\b/, 'module_warehouse'],
    [/\b(oficina|workshop)\b/, 'module_workshop'],
    [/\b(fazenda|plantacao|horta)\b/, 'module_farm_plot'],
    [/\b(mercado|barraca)\b/, 'module_market_stall'],
    [/\b(abrigo|refugio|shelter)\b/, 'module_shelter_basic'],
  ];
  for (const [pattern, assetId] of structures) {
    if (pattern.test(text)) { const position = nearPosition(world, 9); return [{ type: 'create_structure', assetId, ...position }]; }
  }

  if (/\b(habitante|morador|moradora|cidadao|cidada|personagem|pessoa)\b/.test(text)) {
    const nameMatch = message.match(/\b(?:chamad[oa]|com o nome|nomead[oa])\s+([\p{L}][\p{L}'-]{1,27})/iu);
    if (!nameMatch) return [];
    const displayName = nameMatch[1].trim();
    if (/cowila|oraculo/i.test(normalize(displayName))) return [];
    let profession = 'worker';
    if (/\b(engenheir[oa])\b/.test(text)) profession = 'engineer';
    else if (/\b(agente|guarda|vigia|patrulheiro)\b/.test(text)) profession = 'agent';
    else if (/\b(fazendeir[oa]|agricultor[oa])\b/.test(text)) profession = 'farmer';
    else if (/\b(madeireir[oa]|lenhador[oa])\b/.test(text)) profession = 'lumberjack';
    else if (/\b(mineir[oa])\b/.test(text)) profession = 'miner';
    else if (/\b(carpinteir[oa])\b/.test(text)) profession = 'carpenter';
    else if (/\b(mercador[oa]|comerciante)\b/.test(text)) profession = 'merchant';
    const position = nearPosition(world, 5);
    return [{ type: 'spawn_agent', displayName, profession, ...position }];
  }
  return [];
}