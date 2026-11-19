# Cowila AI — Tomas Vagabundo

Worker independente para decisões estratégicas generativas da Cowila.

## Deploy

1. Instale Wrangler: `npm install -g wrangler`.
2. Autentique: `wrangler login`.
3. Entre nesta pasta e execute `wrangler deploy`.
4. Copie a URL publicada e configure `VITE_COWILA_AI_URL` no build do GitHub Pages como `https://<worker>.<subdominio>.workers.dev`.

O binding `AI` usa Cloudflare Workers AI; não há chave de provedor no navegador. O Worker limita payloads, restringe CORS ao GitHub Pages e aplica um limite básico por IP em memória do isolate. Para produção com tráfego público, substitua esse limite por Durable Objects ou Cloudflare Rate Limiting e exija autenticação Firebase validada no Worker.

Modelo inicial: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Se não estiver habilitado na conta, ajuste `MODEL` para um modelo Workers AI disponível.

A IA apenas recomenda tarefas. A simulação TypeScript verifica profissão, tarefa permitida, tick, disponibilidade, recursos e duplicidade antes de enfileirar. Se o Worker estiver ausente ou indisponível, a rotina determinística existente continua.
