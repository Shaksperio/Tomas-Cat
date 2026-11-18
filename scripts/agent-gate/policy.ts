/**
 * Porta de segurança para PRs de agentes de IA. Regras puras e determinísticas:
 * decidem se uma PR pode entrar na `main` sem revisão humana. Mudanças em áreas
 * sensíveis nunca passam por aqui; ficam esperando aprovação humana.
 */
export interface GateFile { filename: string; additions: number; deletions: number; }
export interface GateCheck { name: string; status: string; conclusion: string | null; }

export interface GateInput {
  labels: string[];
  baseRef: string;
  draft: boolean;
  files: GateFile[];
  checks: GateCheck[];
  /** PRs de agentes já integradas hoje (UTC). */
  mergedToday: number;
}

export interface GateConfig {
  label: string;
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
  baseRef: 'main',
  allowedPrefixes: ['src/game/', 'docs/', 'AGENTS.md'],
  deniedPatterns: [
    /^\.github\//, /^scripts\/agent-gate\//, /^workers\//, /^firestore\.rules$/, /^firebase\.json$/,
    /^package(-lock)?\.json$/, /^bun\.lock$/, /^vite\.config\./, /^\.env/,
    /^src\/firebase\//, /^src\/game\/saves\//, /secret|credential|token/i,
  ],
  maxFiles: 25,
  maxChangedLines: 1500,
  maxPerDay: 5,
  requiredChecks: ['build'],
  allowedSkipped: ['deploy'],
};

export interface GateDecision { allow: boolean; reasons: string[]; }

export function evaluateGate(input: GateInput, config: GateConfig = DEFAULT_GATE_CONFIG): GateDecision {
  const reasons: string[] = [];
  if (!input.labels.includes(config.label)) reasons.push(`Sem o rótulo "${config.label}": PR comum, só humano integra.`);
  if (input.baseRef !== config.baseRef) reasons.push(`Base "${input.baseRef}" diferente de "${config.baseRef}".`);
  if (input.draft) reasons.push('PR em rascunho.');
  if (input.files.length === 0) reasons.push('PR sem arquivos alterados.');
  if (input.files.length > config.maxFiles) reasons.push(`Mais de ${config.maxFiles} arquivos alterados.`);
  const lines = input.files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  if (lines > config.maxChangedLines) reasons.push(`Mais de ${config.maxChangedLines} linhas alteradas.`);

  for (const file of input.files) {
    const denied = config.deniedPatterns.find((pattern) => pattern.test(file.filename));
    if (denied) reasons.push(`Área sensível exige aprovação humana: ${file.filename}`);
    else if (!config.allowedPrefixes.some((prefix) => file.filename.startsWith(prefix))) {
      reasons.push(`Arquivo fora das pastas permitidas: ${file.filename}`);
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
