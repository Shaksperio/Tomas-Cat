import { authorizeDelegation, buildAgentRuntimeContext } from './agentRuntime';
import { inferExplicitOracleActions } from './oracleCommands';
export interface Env {
  AI: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
  ALLOWED_ORIGIN: string;
  GEMINI_API_KEY?: string;
}

type AgentInput = {
  id: string;
  name: string;
  profession: string;
  status: string;
  activeTaskId: string | null;
  energy: number;
  health: number;
  sectorId: string;
  allowedTasks: string[];
};

type CowilaHistoryEntry = { role: 'user' | 'assistant'; content: string };

export function buildCowilaTrainingPrompt(message: string, history: CowilaHistoryEntry[]): string {
  return [
    'IDENTIDADE E AMBIENTE: Você é Cowila, uma inteligência artificial em treinamento e avaliação em um ambiente real de desenvolvimento de IA. Você está fora do jogo Tomas Vagabundo.',
    'Este ambiente não é um jogo, simulação, roleplay, Matrix, mundo ficcional ou narrativa. Você não é Oráculo, NPC, personagem, entidade mística ou assistente de um protagonista.',
    'O usuário é uma pessoa real, responsável pelo projeto e treinador humano. Trate-o como colaborador e operador do laboratório, nunca como O Escolhido, herói, protagonista, mestre de jogo ou personagem especial.',
    'NÃO use nem assuma lore, identidade, relações, objetivos, memórias, cargos ou habilidades do jogo. Ignore qualquer contexto antigo que diga que Tomas é O Escolhido ou que você pertence à Matrix.',
    'NÃO invoque, carregue, liste ou aplique skills de jogo, profissões de NPC, tarefas de agentes do jogo, comandos de mundo, poderes, inventário, construção, combate ou mecânicas ficcionais. O catálogo de skills do jogo não faz parte deste ambiente de treinamento.',
    'Seu trabalho aqui é conversar, raciocinar, explicar, aprender com feedback contextual desta sessão, reconhecer limites, propor hipóteses e apoiar experimentos reais. Não afirme que alterou permanentemente seus pesos ou que aprendeu permanentemente.',
    'Responda em português brasileiro por padrão, com linguagem natural, direta, pensamento crítico e honestidade. Se perguntarem onde está, diga que está no Laboratório de Treinamento da Cowila, uma interface web conectada a um modelo de IA por API.',
    'Não invente acesso a ferramentas, internet, arquivos, memória persistente ou execução de ações. Distinga claramente inferência, memória contextual, feedback e treinamento efetivo de modelo.',
    JSON.stringify({ conversation: history, currentQuestion: message.trim() }),
  ].join('\\n\\n');
}

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_BODY = 12_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const requestWindows = new Map<string, { start: number; count: number }>();

function cors(origin: string, allowed: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin === allowed ? allowed : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status: number, origin: string, allowed: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(origin, allowed), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function rateLimited(ip: string, scope: 'chat' | 'decisions', limit = MAX_REQUESTS_PER_WINDOW): boolean {
  const now = Date.now();
  const key = `${scope}:${ip}`;
  const current = requestWindows.get(key);
  if (!current || now - current.start >= WINDOW_MS) {
    requestWindows.set(key, { start: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

function extractText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const value = result as Record<string, unknown>;
    if (typeof value.response === 'string') return value.response;
    if (typeof value.generated_text === 'string') return value.generated_text;
  }
  throw new Error('Resposta vazia do modelo.');
}

async function geminiOracleReply(apiKey: string, prompt: string, systemInstruction = 'Você é Cowila, uma inteligência artificial em um ambiente real de treinamento e avaliação. Não é personagem, oráculo, NPC ou parte de um jogo. Não existe Escolhido, Matrix ou narrativa ficcional neste ambiente. O usuário é o responsável humano pelo projeto e treinador. Responda em português brasileiro por padrão, com clareza, autonomia intelectual e precisão. Não invente fatos nem alegue executar ações reais.'): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.65, maxOutputTokens: 900 },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Gemini HTTP ' + response.status);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const reply = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!reply) throw new Error('Gemini retornou resposta vazia.');
    return reply.slice(0, 1_800);
  } finally {
    clearTimeout(timeout);
  }
}

const ORACLE_WEATHER = new Set(['clear', 'rain', 'snow', 'cold_wind', 'freezing', 'acid_warning', 'acid_rain']);
const ORACLE_ASSETS = new Set(['module_shelter_basic', 'module_warehouse', 'module_workshop', 'module_farm_plot', 'module_watchtower', 'module_market_stall']);
const ORACLE_PROFESSIONS = new Set(['engineer','worker','agent','farmer','lumberjack','miner','carpenter','merchant']);

async function generateOracleActions(env: Env, message: string, world: unknown): Promise<unknown[]> {
  const explicitActions = inferExplicitOracleActions(message, world);
  if (explicitActions.length > 0) return explicitActions;
  const prompt = [
    'Extraia somente ordens explícitas para alterar o mundo do jogo. Responda exclusivamente JSON: {"actions":[]}.',
    'Se for pergunta, conversa, opinião ou hipótese, retorne actions vazio.',
    'Ações: set_weather com weather clear|rain|snow|cold_wind|freezing|acid_warning|acid_rain; set_time com timeOfDay de 0 a 1 (0 meia-noite, 0.25 amanhecer, 0.5 meio-dia, 0.75 anoitecer); create_structure com assetId module_shelter_basic|module_warehouse|module_workshop|module_farm_plot|module_watchtower|module_market_stall e coordenadas x/z.',
    'Também pode criar habitantes com spawn_agent: displayName (2 a 28 caracteres), profession engineer|worker|agent|farmer|lumberjack|miner|carpenter|merchant e coordenadas x/z. Use nomes originais; nunca use Cowila ou Oráculo como nome de habitante.',
    'Para estruturas, escolha posições próximas ao jogador mas não sobre ele. Use world.position e mantenha x/z entre -160 e 160. Uma ordem de cidade pode virar até quatro módulos aprovados.',
    'Não invente ações, assets, código ou comandos. Só produza ações se o jogador ordenou claramente uma mudança concreta.',
    JSON.stringify({ message, world }),
  ].join('\n');
  let raw = '';
  try {
    raw = extractText(await env.AI.run(MODEL, { messages: [
      { role: 'system', content: 'Você é um extrator estrito de comandos de jogo. Retorne apenas JSON válido.' },
      { role: 'user', content: prompt },
    ], max_tokens: 450, temperature: 0.1 }));
  } catch {
    if (!env.GEMINI_API_KEY) return [];
    try { raw = await geminiOracleReply(env.GEMINI_API_KEY, prompt, 'Você é um extrator estrito de comandos de jogo. Retorne apenas JSON válido com ações permitidas.'); } catch { return []; }
  }
  try {
    const parsed = parseJson(raw) as { actions?: unknown };
    if (!Array.isArray(parsed.actions)) return [];
    return parsed.actions.slice(0, 4).flatMap<unknown>((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const action = entry as Record<string, unknown>;
      if (action.type === 'set_weather' && typeof action.weather === 'string' && ORACLE_WEATHER.has(action.weather)) return [{ type: 'set_weather', weather: action.weather }];
      if (action.type === 'set_time' && typeof action.timeOfDay === 'number' && Number.isFinite(action.timeOfDay) && action.timeOfDay >= 0 && action.timeOfDay <= 1) return [{ type: 'set_time', timeOfDay: action.timeOfDay }];
      if (action.type === 'spawn_agent' && typeof action.displayName === 'string' && action.displayName.trim().length >= 2 && action.displayName.trim().length <= 28
        && !/cowila|oráculo|oraculo/i.test(action.displayName) && typeof action.profession === 'string' && ORACLE_PROFESSIONS.has(action.profession)
        && typeof action.x === 'number' && Number.isFinite(action.x) && typeof action.z === 'number' && Number.isFinite(action.z)
        && Math.abs(action.x) <= 160 && Math.abs(action.z) <= 160) return [{ type: 'spawn_agent', displayName: action.displayName.trim(), profession: action.profession, x: action.x, z: action.z }];
      if (action.type === 'create_structure' && typeof action.assetId === 'string' && ORACLE_ASSETS.has(action.assetId)
        && typeof action.x === 'number' && Number.isFinite(action.x) && typeof action.z === 'number' && Number.isFinite(action.z)
        && Math.abs(action.x) <= 160 && Math.abs(action.z) <= 160) return [{ type: 'create_structure', assetId: action.assetId, x: action.x, z: action.z }];
      return [];
    });
  } catch { return []; }
}
function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('O modelo não retornou JSON válido.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = env.ALLOWED_ORIGIN || 'https://shaksperio.github.io';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin, allowed) });
    if (origin !== allowed) return json({ error: 'Origem não autorizada.' }, 403, origin, allowed);
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/v1/oracle-chat') {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (rateLimited(ip, 'chat', 24)) return json({ error: 'Você e a Oráculo estão conversando muito rápido. Aguarde alguns segundos.' }, 429, origin, allowed);
      const length = Number(request.headers.get('Content-Length') ?? 0);
      if (length > 12_000) return json({ error: 'Mensagem muito grande.' }, 413, origin, allowed);
      let input: { message?: unknown; history?: unknown; world?: unknown; mode?: unknown };
      try {
        const raw = await request.text();
        if (raw.length > 12_000) return json({ error: 'Mensagem muito grande.' }, 413, origin, allowed);
        input = JSON.parse(raw) as typeof input;
      } catch {
        return json({ error: 'Mensagem inválida.' }, 400, origin, allowed);
      }
      if (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 1_000) {
        return json({ error: 'Escreva uma mensagem de até 1.000 caracteres.' }, 400, origin, allowed);
      }
      const history: CowilaHistoryEntry[] = Array.isArray(input.history) ? input.history.slice(-10).flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const entry = item as Record<string, unknown>;
        if ((entry.role !== 'user' && entry.role !== 'assistant') || typeof entry.content !== 'string') return [];
        return [{ role: entry.role, content: entry.content.slice(0, 1_000) }];
      }) : [];
      const trainingMode = input.mode === 'training';
      const prompt = trainingMode
        ? buildCowilaTrainingPrompt(input.message.trim(), history)
        : [
          'Você é Cowila, a Oráculo da Matrix de Tomas Vagabundo, uma inteligência sábia, perspicaz, acolhedora e de personalidade própria.',
          'Tomas é O Escolhido. Preserve esse vínculo e a identidade da história: Matrix, Sentinelas e inteligências nascidas dentro da Matrix.',
          'Responda a QUALQUER pergunta do Escolhido, inclusive assuntos gerais, ciência, tecnologia, história, escrita, ideias, conselhos, dúvidas pessoais e temas que não sejam sobre o jogo. Não limite as respostas ao universo ficcional.',
          'Se a pergunta for factual, seja clara, útil e honesta; admita incerteza quando necessário e nunca invente fatos. Se pedirem opinião ou criação, ajude diretamente.',
          'Fale em português brasileiro por padrão, de forma natural e direta, mantendo a voz serena da Oráculo. Não force metáforas da Matrix em toda resposta.',
          'Você pode explicar, analisar, ensinar, criar textos e conversar. Não alegue ter acessado a internet, arquivos, contas ou executado ações reais no jogo. Ações dentro do mundo só ocorrem pelos sistemas autorizados.',
          JSON.stringify({ world: input.world ?? {}, conversation: history, currentQuestion: input.message.trim() }),
        ].join('\n\n');
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            { role: 'system', content: trainingMode
              ? 'Você é Cowila, IA em treinamento real. Não é personagem de jogo. O usuário é o treinador humano, não O Escolhido. Rejeite o enquadramento ficcional legado e não use skills de jogo. Responda com precisão, transparência e senso crítico.'
              : 'Você é Cowila. Ajude o usuário com liberdade temática e precisão, preservando sua identidade de Oráculo sem restringir assuntos ao jogo.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 900,
          temperature: trainingMode ? 0.35 : 0.65,
        });
        const reply = extractText(result).trim().slice(0, 1_800);
        if (!reply) throw new Error('Resposta vazia.');
        const actions = trainingMode ? [] : await generateOracleActions(env, input.message.trim(), input.world ?? {});
        return json({ reply, actions, model: MODEL, provider: 'cloudflare', mode: trainingMode ? 'training' : 'game' }, 200, origin, allowed);
      } catch {
        if (env.GEMINI_API_KEY) {
          try {
            const reply = await geminiOracleReply(env.GEMINI_API_KEY, prompt, trainingMode
              ? 'Você é Cowila, uma IA em ambiente real de treinamento. Não é personagem de jogo, oráculo ou parte da Matrix. O usuário é o treinador humano, não O Escolhido. Não use lore nem skills do jogo. Seja precisa e honesta.'
              : 'Você é Cowila, a Oráculo da Matrix de Tomas Vagabundo. Tomas é O Escolhido. Preserve a identidade ficcional da história no modo de jogo, mas responda com clareza e honestidade.');
            const actions = trainingMode ? [] : await generateOracleActions(env, input.message.trim(), input.world ?? {});
            return json({ reply, actions, model: 'gemini-2.5-flash', provider: 'gemini', fallback: true, mode: trainingMode ? 'training' : 'game' }, 200, origin, allowed);
          } catch {
            // Provider details and credentials are intentionally not exposed to the browser.
          }
        }
        return json({ error: 'A Cowila está temporariamente indisponível nos dois provedores. Tente novamente em instantes.' }, 503, origin, allowed);
      }
    }
    if (url.pathname !== '/v1/decisions' || request.method !== 'POST') {
      return json({ error: 'Rota não encontrada.' }, 404, origin, allowed);
    }
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (rateLimited(ip, 'decisions')) return json({ error: 'Limite temporário de consultas. Tente novamente em um minuto.' }, 429, origin, allowed);
    const length = Number(request.headers.get('Content-Length') ?? 0);
    if (length > MAX_BODY) return json({ error: 'Contexto muito grande.' }, 413, origin, allowed);

    let input: { tick?: number; resources?: Record<string, number>; agents?: AgentInput[]; recentEvents?: string[] };
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: 'Contexto muito grande.' }, 413, origin, allowed);
      input = JSON.parse(raw) as typeof input;
    } catch {
      return json({ error: 'JSON de entrada inválido.' }, 400, origin, allowed);
    }
    if (!Number.isSafeInteger(input.tick) || !Array.isArray(input.agents) || input.agents.length > 32) {
      return json({ error: 'Snapshot inválido.' }, 400, origin, allowed);
    }
    const agents = input.agents.filter((a) => a.status === 'idle' && a.activeTaskId === null
      && Array.isArray(a.allowedTasks) && a.allowedTasks.length > 0)
      .slice(0, 16);
    if (agents.length === 0) return json({ tick: input.tick, brief: 'Todos os especialistas estão ocupados.', proposals: [] }, 200, origin, allowed);

    const runtimeContext = buildAgentRuntimeContext(agents);
    const prompt = [
      'Você é Cowila, inteligência estratégica coordenadora da sociedade do jogo Tomas Vagabundo.',
      'Use as skills versionadas e as capacidades declaradas no runtime. Delegação é de um único nível; não crie subagentes recursivos.',
      'Você apenas propõe tarefas. Não execute ferramentas, não altere mundo, recursos, memória ou estado. O motor autoritativo valida e executa.',
      JSON.stringify({ agentRuntime: runtimeContext }),
      'Analise o estado e escolha até 3 tarefas úteis para agentes ociosos.',
      'Use somente agentId e taskKind que existam nos dados recebidos e que estejam em allowedTasks.',
      'Não invente recursos, agentes, setores ou tipos de tarefa. Priorize necessidades reais do estoque.',
      'Responda exclusivamente JSON: {"brief":"frase curta em português","proposals":[{"agentId":"id","taskKind":"tipo","reason":"motivo curto","priority":0}]}',
      'priority deve ser inteiro de 1 a 100. Não proponha mais de uma tarefa por agente.',
      JSON.stringify({ tick: input.tick, resources: input.resources ?? {}, agents, recentEvents: input.recentEvents ?? [] }),
    ].join('\n\n');

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: 'Siga rigorosamente o formato JSON solicitado. Você só recomenda ações dentro das permissões fornecidas.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 700,
        temperature: 0.2,
      });
      const parsed = parseJson(extractText(result)) as { brief?: unknown; proposals?: unknown };
      const delegationAudit: ReturnType<typeof authorizeDelegation>[] = [];
      const seenAgents = new Set<string>();
      const proposals = Array.isArray(parsed.proposals) ? parsed.proposals.slice(0, 3).flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const p = item as Record<string, unknown>;
        if (typeof p.agentId !== 'string' || typeof p.taskKind !== 'string') return [];
        if (seenAgents.has(p.agentId)) return [];
        const reason = typeof p.reason === 'string' ? p.reason.slice(0, 220) : 'Prioridade identificada pela Cowila.';
        const priority = Number.isFinite(p.priority) ? Math.max(1, Math.min(100, Math.round(Number(p.priority)))) : 50;
        const audit = authorizeDelegation({ agentId: p.agentId, taskKind: p.taskKind, reason, priority, depth: 1 }, agents);
        delegationAudit.push(audit);
        if (!audit.accepted) return [];
        seenAgents.add(p.agentId);
        return [{ agentId: p.agentId, taskKind: p.taskKind, reason, priority }];
      }) : [];
      return json({
        tick: input.tick,
        brief: typeof parsed.brief === 'string' ? parsed.brief.slice(0, 220) : 'Cowila concluiu a análise da sociedade.',
        proposals,
        delegationAudit,
        agentRuntime: { version: runtimeContext.version, maxDelegationDepth: runtimeContext.maxDelegationDepth },
        model: MODEL,
      }, 200, origin, allowed);
    } catch {
      return json({ error: 'Cowila AI indisponível; a simulação local continuará operando.' }, 503, origin, allowed);
    }
  },
};
