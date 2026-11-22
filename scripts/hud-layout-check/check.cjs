// Falha (exit 1) se, em tela de celular, o painel de agentes cobrir o cartão de energia/status ou o aviso sair da tela.
const { chromium } = require('playwright');
const dir = process.argv[2], tag = process.argv[3] || 'depois';
const W = 384, H = 720;
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + dir + '/index.html'); await page.waitForTimeout(3500);
  const measure = () => page.evaluate(({ W }) => {
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const box = (el) => { while (el && !(el.className && String(el.className).includes('rounded-xl'))) el = el.parentElement; return el; };
    const byText = (t) => [...document.querySelectorAll('span,div')].find(e => e.children.length === 0 && e.textContent.trim() === t);
    const agents = document.querySelector('section[aria-label^="Tarefas dos agentes"]');
    const energy = box(byText('Energia'));
    const toastEl = [...document.querySelectorAll('div')].find(e => e.children.length === 0 && e.textContent.startsWith('Organismo catalogado'));
    return { agents: rect(agents), energy: rect(energy), toast: rect(toastEl), W };
  }, { W });
  let res = await measure();
  const inter = (a, b) => a && b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  await page.screenshot({ path: `${dir}/hud-${tag}.png` });
  const fails = [];
  const rightCol = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Mochila/.test(x.textContent)); const r = b && b.getBoundingClientRect(); return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; });
  if (inter(res.toast, res.energy)) fails.push('aviso cobre o cartão de energia/vida');
  if (inter(res.toast, rightCol)) fails.push('aviso cobre a mochila/controles da direita');
  // painel expandido não pode cobrir o cartão de energia nem passar da altura da tela
  await page.click('section[aria-label^="Tarefas dos agentes"] button');
  await page.waitForTimeout(300);
  const ex = await measure();
  await page.screenshot({ path: `${dir}/hud-${tag}-expandido.png` });
  if (inter(ex.agents, ex.energy)) fails.push('painel expandido cobre o cartão de energia/vida');
  if (ex.agents && ex.agents.b > 720) fails.push('painel expandido passa da altura da tela');
  if (!res.agents) fails.push('painel de agentes não encontrado');
  if (inter(res.agents, res.energy)) fails.push('painel de agentes cobre o cartão de energia/vida');
  if (res.toast && (res.toast.l < 0 || res.toast.r > W)) fails.push(`aviso fora da tela (${Math.round(res.toast.l)}..${Math.round(res.toast.r)} de ${W})`);
  if (errors.length) fails.push('erros de página: ' + errors.slice(0, 2).join(' | '));
  console.log(tag, JSON.stringify(res), fails.length ? 'FALHAS: ' + fails.join('; ') : 'OK');
  await browser.close(); process.exit(fails.length ? 1 : 0);
})();
