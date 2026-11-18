import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const apiKey = process.env.GEMINI_API_KEY;
const task = (process.env.ENGINEERING_TASK || "").trim();
const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const baseBranch = process.env.BASE_BRANCH || "main";
if (!apiKey) throw new Error("GEMINI_API_KEY ausente; nenhuma alteração foi feita.");
if (!task && process.env.GITHUB_EVENT_NAME !== "schedule") throw new Error("Informe ENGINEERING_TASK no workflow_dispatch.");

const read = (path) => readFileSync(path, "utf8");
const agents = read("AGENTS.md");
const policy = read("docs/architecture/AUTONOMOUS-ENGINEERING-AND-RELEASES.md");
const roadmap = agents.slice(0, 28000);
const system = `Você é o agente de engenharia do jogo Tomas Vagabundo. Respeite integralmente AGENTS.md e a política de autonomia. Preserve o jogo e implemente uma melhoria pequena, completa, testável e compatível com o roteiro. Não altere autenticação, Firebase Rules, saves/persistência, dependências, workflows, scripts de CI/integração, infraestrutura, permissões ou segredos. Não invente APIs. Retorne SOMENTE JSON válido no formato { "title": string, "summary": string, "files": [{ "path": string, "content": string }] }. Cada arquivo deve ser um arquivo novo ou substituição integral. Não inclua markdown fences. Limite a 8 arquivos e 100 KB somados. Caminhos permitidos: src/game/** e docs/**, exceto docs/architecture/AUTONOMOUS-ENGINEERING-AND-RELEASES.md. Não exclua arquivos. Se não houver melhoria segura e claramente justificada, retorne files: [].`;
const prompt = `REGRAS DO PROJETO (AGENTS.md):\n${roadmap}\n\nPOLÍTICA DE AUTONOMIA:\n${policy}\n\nTAREFA:\n${task || "Analise o estado atual do jogo e a seção 5 (roteiro) de AGENTS.md. Implemente o próximo incremento pequeno e seguro ainda não concluído, sem duplicar funcionalidades existentes."}`;
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  })
});
if (!response.ok) throw new Error(`Gemini API respondeu HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
const payload = await response.json();
const raw = payload.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
let result;
try { result = JSON.parse(raw); } catch { throw new Error("A resposta do modelo não é JSON válido."); }
if (!result || typeof result.title !== "string" || typeof result.summary !== "string" || !Array.isArray(result.files)) throw new Error("Formato de resposta inválido.");
if (result.files.length === 0) { console.log("Nenhuma alteração segura proposta; encerrando sem PR."); process.exit(0); }
if (result.files.length > 8) throw new Error("Limite de 8 arquivos excedido.");
let total = 0;
const changed = [];
for (const file of result.files) {
  if (!file || typeof file.path !== "string" || typeof file.content !== "string") throw new Error("Entrada de arquivo inválida.");
  const path = file.path.replaceAll("\\", "/");
  if (path !== file.path || path.startsWith("/") || path.split("/").includes("..") || !(path.startsWith("src/game/") || path.startsWith("docs/")) || path === "docs/architecture/AUTONOMOUS-ENGINEERING-AND-RELEASES.md") throw new Error(`Caminho bloqueado: ${path}`);
  if (path.endsWith(".yml") || path.endsWith(".yaml") || path.endsWith(".json") || path.endsWith(".lock") || path.includes("/auth/") || path.includes("/save") || path.includes("/saves/")) throw new Error(`Tipo/área protegida: ${path}`);
  total += Buffer.byteLength(file.content, "utf8");
  if (total > 100_000) throw new Error("Limite de 100 KB excedido.");
  const target = resolve(process.cwd(), path);
  if (!target.startsWith(resolve(process.cwd()) + sep)) throw new Error("Caminho fora do repositório.");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.content, "utf8");
  changed.push(path);
}
const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const unexpected = status.filter(line => !changed.some(path => line.slice(3) === path));
if (unexpected.length) throw new Error(`Arquivos inesperados no workspace: ${unexpected.join(", ")}`);
execFileSync("git", ["config", "user.name", "tomas-engineering-agent"]);
execFileSync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
const slug = `agent/${runId}`;
execFileSync("git", ["switch", "-c", slug]);
execFileSync("git", ["add", "--", ...changed]);
execFileSync("git", ["commit", "-m", `feat(game): ${result.title.slice(0, 65)}`]);
execFileSync("git", ["push", "origin", slug]);
const body = [
  "## Proposta do agente de engenharia",
  "",
  result.summary,
  "",
  "### Arquivos",
  ...changed.map(path => `- \`${path}\``),
  "",
  "### Segurança e validação",
  "- Gerada por IA com escopo limitado a código de jogo e documentação.",
  "- Esta PR não recebe permissão de merge ou deploy.",
  "- CI obrigatório deve validar o SHA exato antes de qualquer integração.",
  "- Alterações em áreas protegidas são bloqueadas pelo executor."
].join("\n");
execFileSync("gh", ["pr", "create", "--base", baseBranch, "--head", slug, "--title", result.title.slice(0, 120), "--body", body], { stdio: "inherit" });
console.log(`PR criada com ${changed.length} arquivo(s): ${changed.join(", ")}`);
