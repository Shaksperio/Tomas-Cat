import { execFileSync } from "node:child_process";
import {
  lstatSync, readFileSync, writeFileSync, mkdirSync, realpathSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";

const apiKey = process.env.GEMINI_API_KEY;
const task = (process.env.ENGINEERING_TASK || "").trim();
const runId = process.env.GITHUB_RUN_ID || "";
const baseBranch = process.env.BASE_BRANCH || "main";
const root = realpathSync(process.cwd());
if (!apiKey) throw new Error("GEMINI_API_KEY ausente; nenhuma alteração foi feita.");
if (!/^\d+$/.test(runId)) throw new Error("GITHUB_RUN_ID inválido; execução encerrada.");

const agents = readFileSync("AGENTS.md", "utf8");
const policy = readFileSync("docs/architecture/AUTONOMOUS-ENGINEERING-AND-RELEASES.md", "utf8");
const system = `Você é o agente de engenharia do jogo Tomas Vagabundo. Respeite AGENTS.md e a política de autonomia. Implemente uma melhoria pequena, completa, testável e compatível com o roteiro. Não altere autenticação, Firebase Rules, saves/persistência, dependências, workflows, scripts de CI/integração, infraestrutura, permissões ou segredos. Retorne SOMENTE JSON válido: {"title":string,"summary":string,"files":[{"path":string,"content":string}]}. Cada arquivo é uma criação ou substituição integral. Limite 8 arquivos e 100 KB. Caminhos permitidos: src/game/** e docs/**, exceto docs/architecture/AUTONOMOUS-ENGINEERING-AND-RELEASES.md. Não exclua arquivos. Se não houver melhoria segura, retorne files: [].`;
const prompt = `REGRAS DO PROJETO (AGENTS.md):\n${agents.slice(0, 28000)}\n\nPOLÍTICA DE AUTONOMIA:\n${policy}\n\nTAREFA:\n${task || "Analise o roteiro de AGENTS.md e implemente o próximo incremento pequeno, seguro, ainda não concluído e sem duplicar funcionalidades."}`;
const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
  method: "POST",
  headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
  signal: AbortSignal.timeout(120000),
  body: JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  }),
});
if (!response.ok) throw new Error(`Gemini API respondeu HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
const payload = await response.json();
const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
let result;
try { result = JSON.parse(raw); } catch { throw new Error("A resposta do modelo não é JSON válido."); }
if (!result || typeof result.title !== "string" || !result.title.trim() || result.title.length > 120
  || typeof result.summary !== "string" || !result.summary.trim() || result.summary.length > 12000
  || !Array.isArray(result.files)) throw new Error("Formato ou tamanho da resposta inválido.");
if (result.files.length === 0) { console.log("Nenhuma alteração segura proposta; encerrando sem PR."); process.exit(0); }
if (result.files.length > 8) throw new Error("Limite de 8 arquivos excedido.");

const changed = [];
const seen = new Set();
let total = 0;
for (const file of result.files) {
  if (!file || typeof file.path !== "string" || typeof file.content !== "string") throw new Error("Entrada de arquivo inválida.");
  const path = file.path;
  const parts = path.split("/");
  if (path.includes("\\") || path.includes("%") || path.includes("\0") || path.startsWith("/")
    || parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))
    || !(path.startsWith("src/game/") || path.startsWith("docs/"))
    || path === "docs/architecture/AUTONOMOUS-ENGINEERING-AND-RELEASES.md"
    || /(^|\/)(auth|saves?)(\/|$)/i.test(path)
    || /(secret|credential|token|firebase|worker|workflow)/i.test(path)
    || /\.(ya?ml|json|lock)$/i.test(path)) throw new Error(`Caminho/tipo protegido: ${path}`);
  if (seen.has(path)) throw new Error(`Arquivo duplicado na resposta: ${path}`);
  seen.add(path);
  total += Buffer.byteLength(file.content, "utf8");
  if (total > 100_000) throw new Error("Limite de 100 KB excedido.");

  const target = resolve(root, path);
  if (!target.startsWith(root + sep)) throw new Error("Caminho fora do repositório.");
  // Não seguir symlinks em nenhum segmento: impede escrita fora do workspace.
  let current = root;
  for (const part of parts) {
    current = resolve(current, part);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`Symlink bloqueado: ${path}`);
      if (current !== target && !stat.isDirectory()) throw new Error(`Componente não é diretório: ${path}`);
      if (current === target && !stat.isFile()) throw new Error(`Destino não é arquivo regular: ${path}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.content, { encoding: "utf8", flag: "w" });
  changed.push(path);
}

const diffNames = execFileSync("git", ["diff", "--name-only", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const deleted = execFileSync("git", ["diff", "--diff-filter=D", "--name-only", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const actual = new Set([...diffNames, ...untracked]);
if (deleted.length || actual.size !== seen.size || [...actual].some((path) => !seen.has(path))) {
  throw new Error("Workspace contém alterações inesperadas ou exclusões; PR não será criada.");
}

execFileSync("git", ["config", "user.name", "tomas-engineering-agent"]);
execFileSync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
const slug = `agent/${runId}`;
execFileSync("git", ["switch", "-c", slug]);
execFileSync("git", ["add", "--", ...changed]);
execFileSync("git", ["commit", "-m", `feat(game): ${result.title.slice(0, 65)}`]);
execFileSync("git", ["push", "origin", slug]);

// O rótulo permite que o avaliador reconheça a proposta, mas não substitui CI,
// aprovação independente nem qualquer outra regra de segurança.
execFileSync("gh", ["label", "create", "agent-pr", "--color", "1D76DB", "--description", "PR criada por agente autorizado"], { stdio: "ignore" , env: { ...process.env } });
const body = [
  "## Proposta do agente de engenharia", "", result.summary, "",
  "### Arquivos", ...changed.map((path) => `- \`${path}\``), "",
  "### Segurança e validação",
  "- Gerada por IA com escopo limitado a código de jogo e documentação.",
  "- Esta PR não recebe permissão de merge ou deploy.",
  "- CI obrigatório deve validar o SHA exato antes de qualquer integração.",
  "- O Agent Gate exige aprovação independente e mantém áreas sensíveis bloqueadas.",
].join("\n");
execFileSync("gh", ["pr", "create", "--base", baseBranch, "--head", slug, "--title", result.title, "--body", body, "--label", "agent-pr"], { stdio: "inherit" });
console.log(`PR criada com ${changed.length} arquivo(s): ${changed.join(", ")}`);
