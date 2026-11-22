// Uso: node build.cjs <raiz-do-repo> <saida>   (a raiz pode ser um worktree de outra branch para comparar antes/depois)
const fs = require('fs'), path = require('path');
const NM = '/opt/npm-tools/node_modules';
const root = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
fs.mkdirSync(out, { recursive: true });
const here = __dirname;
fs.copyFileSync(path.join(here, 'index.html'), path.join(out, 'index.html'));
// stub de ícones (mantém o espaço ocupado, sem desenhar)
const names = new Set();
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.tsx?$/.test(f)) { const t = fs.readFileSync(f, 'utf8'); for (const m of t.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g)) m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach(n => names.add(n)); } });
walk(path.join(root, 'src'));
fs.writeFileSync(path.join(out, 'lucide-stub.js'), `import {createElement} from 'react';\n` + [...names].map(n => `export const ${n} = (p) => createElement('svg', {className: p && p.className, 'data-icon': '${n}'});`).join('\n'));
require(NM + '/esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts/hud-layout-check/entry.tsx')], bundle: true, format: 'iife', outfile: path.join(out, 'out.js'), logLevel: 'error', jsx: 'automatic',
  alias: { 'lucide-react': path.join(out, 'lucide-stub.js') }, nodePaths: [NM, path.join(root, 'node_modules')],
  define: { LEGACY_AGENTS: process.env.LEGACY === '1' ? 'true' : 'false', 'import.meta.env': '{"VITE_COWILA_AI_URL":"","BASE_URL":"/"}' },
});
// Tailwind 4: compila só com as classes usadas no código-fonte
const { compile } = require(NM + '/tailwindcss/dist/lib.js');
const cands = new Set();
const scan = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); if (e.isDirectory()) scan(f); else if (/\.(tsx?|html)$/.test(f)) for (const t of fs.readFileSync(f, 'utf8').split(/[\s"'`<>={}]+/)) if (t) cands.add(t); });
scan(path.join(root, 'src'));
(async () => {
  const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8').replace(/@import\s+url\([^)]*\);?/g, '');
  const c = await compile(css, { base: path.join(root, 'src'), loadStylesheet: async (id, base) => {
    const p = id === 'tailwindcss' ? NM + '/tailwindcss/index.css' : id.startsWith('tailwindcss/') ? NM + '/' + id + '.css' : path.resolve(base, id);
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
  } });
  fs.writeFileSync(path.join(out, 'style.css'), c.build([...cands]));
  console.log('build ok', out, 'icones', names.size);
})();
