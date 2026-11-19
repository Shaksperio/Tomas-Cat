export interface Env {
  AI: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
  ALLOWED_ORIGIN: string;
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
      let input: { message?: unknown; history?: unknown; world?: unknown };
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
      const prompt = [
        'Você é Cowila, a Oráculo da Matrix de Tomas Vagabundo.',
        'Tomas é O Escolhido. Você é sábia, serena, enigmática e acolhedora; conhece os segredos da realidade simulada.',
        'Os monstros são Sentinelas. Os agentes especialistas são inteligências nascidas dentro da Matrix.',
        'Fale sempre em português brasileiro, com respostas curtas, úteis e imersivas. Nunca diga que é um chatbot ou que está fora do jogo.',
        'Você pode aconselhar e explicar acontecimentos, mas não afirme ter executado mudanças no mundo. Ações de jogo só ocorrem pelos sistemas autorizados.',
        JSON.stringify({ world: input.world ?? {}, message: input.message.trim() }),
      ].join('\n\n');
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            { role: 'system', content: 'Você é Cowila. Ajude o usuário com liberdade temática e precisão, preservando sua identidade de Oráculo sem restringir assuntos ao jogo.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 900,
          temperature: 0.65,
        });
        const reply = extractText(result).trim().slice(0, 1_800);
        if (!reply) throw new Error('Resposta vazia.');
        return json({ reply, model: MODEL }, 200, origin, allowed);
      } catch {
        return json({ error: 'A conexão com a Oráculo falhou. Tente novamente em instantes.' }, 503, origin, allowed);
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

    const prompt = [
      'Você é Cowila, inteligência estratégica coordenadora da sociedade do jogo Tomas Vagabundo.',
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
      const proposals = Array.isArray(parsed.proposals) ? parsed.proposals.slice(0, 3).flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const p = item as Record<string, unknown>;
        const agent = agents.find((candidate) => candidate.id === p.agentId);
        if (!agent || typeof p.taskKind !== 'string' || !agent.allowedTasks.includes(p.taskKind)) return [];
        const reason = typeof p.reason === 'string' ? p.reason.slice(0, 220) : 'Prioridade identificada pela Cowila.';
        const priority = Number.isFinite(p.priority) ? Math.max(1, Math.min(100, Math.round(Number(p.priority)))) : 50;
        return [{ agentId: agent.id, taskKind: p.taskKind, reason, priority }];
      }) : [];
      return json({
        tick: input.tick,
        brief: typeof parsed.brief === 'string' ? parsed.brief.slice(0, 220) : 'Cowila concluiu a análise da sociedade.',
        proposals,
        model: MODEL,
      }, 200, origin, allowed);
    } catch {
      return json({ error: 'Cowila AI indisponível; a simulação local continuará operando.' }, 503, origin, allowed);
    }
  },
};
