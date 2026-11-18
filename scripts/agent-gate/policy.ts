/**
 * Porta de segurança para PRs de agentes de IA. Regras puras e determinísticas:
 * decidem se uma PR pode entrar na `main` sem revisão humana. Mudanças em áreas
 * sensíveis nunca passam por aqui; ficam esperando aprovação humana.
 */
export interface GateFile {
  filename: string;
  additions: number;
  deletions: number;
  /** added | modified | removed | renamed | copied | changed */
  status?: string;
  previousFilename?: string;
}
export interface GateReview { login: string; state: string; association: string; }
export interface GateCheck { name: string; status: string; conclusion: string | null; }

export interface GateInput {
  labels: string[];
  author: string;
  headRef: string;
  /** Repositório de origem da branch; PRs de fork nunca passam. */
  headRepo: string;
  baseRepo: string;
  /** Revisões mais recentes por usuário. */
  reviews: GateReview[];
  /** PRs de agentes abertas neste momento (esta inclusive). */
  openAgentPrs: number;
  baseRef: string;
  draft: boolean;
  files: GateFile[];
  checks: GateCheck[];
  /** PRs de agentes já integradas hoje (UTC). */
  mergedToday: number;
}

export interface GateConfig {
  label: string;
  /** Contas autorizadas a abrir PRs de agentes. Vazio = nada passa (falha fechada). */
  agentAuthors: string[];
  branchPattern: RegExp;
  maxOpenAgentPrs: number;
  requireIndependentApproval: boolean;
  baseRef: string;
  allowedPrefixes: string[];
  /** Padrões que exigem humano mesmo dentro de pastas permitidas. */
  deniedPatterns: RegExp[];
  maxFiles: number;
  maxChangedLines: number;
  maxPerDay: number;
  requiredChecks: string[];
  /** Checks que podem aparecer como `skipped` por desenho (ex.: deploy em PR). */
  allowedSkipped: string[];
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  label: 'agent-pr',
  agentAuthors: [],
  branchPattern: /^(claude|codex|grok|agent)\/[a-z0-9][a-z0-9._/-]{2,80}$/,
  maxOpenAgentPrs: 2,
  requireIndependentApproval: true,
  baseRef: 'main',
  allowedPrefixes: ['src/game/', 'docs/', 'AGENTS.md'],
  deniedPatterns: [
    /^\.github\//, /^scripts\/agent-gate\//, /^workers\//, /^firestore\.rules$/, /^firebase\.json$/,
    /^package(-lock)?\.json$/, /^bun\.lock$/, /^vite\.config\./, /^\.env/,
    /(^|\/)tsconfig[^/]*\.json$/, /\.config\.[cm]?[jt]s$/, /^(SECURITY|CODEOWNERS)/i, /^\.gitignore$/,
    /^src\/firebase\//, /^src\/game\/saves\//, /secret|credential|token/i,
  ],
  maxFiles: 25,
  maxChangedLines: 1500,
  maxPerDay: 5,
  requiredChecks: ['build'],
  allowedSkipped: ['deploy'],
};

export interface GateDecision { allow: boolean; reasons: string[]; }

/** Rejeita travessia de diretório, caminhos absolutos, escapes e qualquer segmento oculto (começa com ponto). */
export function isSafePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('%') || path.includes('\0')) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '..' && segment !== '.' && !segment.startsWith('.'));
}

export function evaluateGate(input: GateInput, config: GateConfig = DEFAULT_GATE_CONFIG): GateDecision {
  const reasons: string[] = [];
  if (!config.agentAuthors.includes(input.author)) reasons.push(`Autor "${input.author}" não está na lista de agentes autorizados.`);
  if (!config.branchPattern.test(input.headRef)) reasons.push(`Branch "${input.headRef}" fora do padrão permitido.`);
  if (input.headRepo !== input.baseRepo) reasons.push('PR vinda de fork ou de outro repositório.');
  if (input.openAgentPrs > config.maxOpenAgentPrs) reasons.push(`Mais de ${config.maxOpenAgentPrs} PRs de agentes abertas ao mesmo tempo.`);
  if (config.requireIndependentApproval) {
    const independent = input.reviews.some((r) => r.state === 'APPROVED'
      && r.login !== input.author && !config.agentAuthors.includes(r.login)
      && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(r.association));
    if (!independent) reasons.push('Falta aprovação de um revisor independente (não é o autor nem outro agente).');
  }
  if (!input.labels.includes(config.label)) reasons.push(`Sem o rótulo "${config.label}": PR comum, só humano integra.`);
  if (input.baseRef !== config.baseRef) reasons.push(`Base "${input.baseRef}" diferente de "${config.baseRef}".`);
  if (input.draft) reasons.push('PR em rascunho.');
  if (input.files.length === 0) reasons.push('PR sem arquivos alterados.');
  if (input.files.length > config.maxFiles) reasons.push(`Mais de ${config.maxFiles} arquivos alterados.`);
  const lines = input.files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  if (lines > config.maxChangedLines) reasons.push(`Mais de ${config.maxChangedLines} linhas alteradas.`);

  for (const file of input.files) {
    // Renomeações são avaliadas na origem e no destino; exclusões também.
    for (const path of [file.filename, file.previousFilename].filter((p): p is string => Boolean(p))) {
      const denied = config.deniedPatterns.find((pattern) => pattern.test(path));
      if (denied) reasons.push(`Área sensível exige aprovação humana: ${path}`);
      else if (!isSafePath(path)) reasons.push(`Caminho suspeito ou arquivo oculto: ${path}`);
      else if (!config.allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
        reasons.push(`Arquivo fora das pastas permitidas: ${path}`);
      }
    }
    if (file.status === 'removed' && /\.test\.[cm]?[jt]sx?$/.test(file.filename)) {
      reasons.push(`Agente não pode excluir testes: ${file.filename}`);
    }
  }

  for (const required of config.requiredChecks) {
    const check = input.checks.find((c) => c.name === required);
    if (!check) reasons.push(`Check obrigatório ausente: ${required}`);
  }
  for (const check of input.checks) {
    if (check.status !== 'completed') reasons.push(`Check ainda em andamento: ${check.name}`);
    else if (check.conclusion === 'success') continue;
    else if (check.conclusion === 'skipped' && config.allowedSkipped.includes(check.name)) continue;
    else reasons.push(`Check não aprovado: ${check.name} (${check.conclusion ?? 'sem conclusão'})`);
  }
  if (input.mergedToday >= config.maxPerDay) reasons.push(`Teto diário de ${config.maxPerDay} PRs de agentes atingido.`);
  return { allow: reasons.length === 0, reasons };
}
