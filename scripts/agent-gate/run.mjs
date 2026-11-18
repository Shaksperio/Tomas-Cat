// Executa a porta de segurança para uma PR. Roda a partir da `main` (nunca do código da PR).
// Sem a variável de repositório AGENT_GATE_ENABLED=true, apenas relata a decisão (modo simulação).
import { DEFAULT_GATE_CONFIG, evaluateGate } from './policy.ts';

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA, AGENT_GATE_ENABLED } = process.env;
if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER) {
  console.log('Sem PR associada à execução; nada a fazer.');
  process.exit(0);
}
const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${body.message ?? ''}`);
  return body;
};

const repo = `/repos/${GITHUB_REPOSITORY}`;
const pr = await api(`${repo}/pulls/${PR_NUMBER}`);
if (pr.state !== 'open') { console.log('PR não está aberta.'); process.exit(0); }
if (HEAD_SHA && pr.head.sha !== HEAD_SHA) { console.log('A PR recebeu novos commits depois deste CI; aguardando o próximo.'); process.exit(0); }

const files = await api(`${repo}/pulls/${PR_NUMBER}/files?per_page=100`);
const runs = await api(`${repo}/commits/${pr.head.sha}/check-runs?per_page=100`);
const day = new Date().toISOString().slice(0, 10);
const merged = await api(`/search/issues?q=${encodeURIComponent(`repo:${GITHUB_REPOSITORY} is:pr is:merged label:${DEFAULT_GATE_CONFIG.label} merged:>=${day}`)}`);

const decision = evaluateGate({
  labels: pr.labels.map((l) => l.name), baseRef: pr.base.ref, draft: pr.draft,
  files: files.map((f) => ({ filename: f.filename, additions: f.additions, deletions: f.deletions })),
  checks: runs.check_runs.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion })),
  mergedToday: merged.total_count,
});
console.log(JSON.stringify({ pr: Number(PR_NUMBER), ...decision }, null, 2));
if (!decision.allow) process.exit(0);
if (AGENT_GATE_ENABLED !== 'true') { console.log('Liberada pela política, mas AGENT_GATE_ENABLED não é "true": modo simulação, nada foi integrado.'); process.exit(0); }
const result = await api(`${repo}/pulls/${PR_NUMBER}/merge`, {
  method: 'PUT', body: JSON.stringify({ merge_method: 'squash', sha: pr.head.sha }),
});
console.log(`Integrada: ${result.sha}`);
