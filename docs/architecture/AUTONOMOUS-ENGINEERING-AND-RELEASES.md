# Política de autonomia e publicação contínua — Tomas Vagabundo

## Objetivo

O mundo deve evoluir sem exigir aprovação humana para cada atualização de conteúdo ou código de jogo. Agentes autorizados podem propor, implementar e testar mudanças; a integração automática só pode ocorrer por um avaliador determinístico separado do modelo generativo.

## Fluxo operacional desejado

1. Agentes do jogo e Cowila identificam necessidades e oportunidades de expansão.
2. O agente de engenharia consulta `AGENTS.md` e o roteiro atual.
3. O agente cria uma branch isolada e abre uma PR limitada a código de jogo e documentação.
4. GitHub Actions executa testes, TypeScript e build no SHA exato da PR.
5. Um avaliador confiável, executado a partir da branch padrão e sem executar código da PR, verifica autoria, origem, caminhos, limites, checks e políticas.
6. Somente quando o integrador estiver habilitado e todas as regras forem satisfeitas, ele poderá fazer squash merge de mudanças de baixo risco.
7. O push em `main` aciona GitHub Pages.
8. Uma verificação pós-deploy deve confirmar disponibilidade e saúde básica antes de liberar a fila seguinte.

## Classes de risco

### Elegíveis à autonomia após aprovação do integrador

- Conteúdo original: missões, diálogos, itens, construções, NPCs, biomas e cenários.
- Sistemas isolados de jogo e extensões de módulos existentes.
- Correções, testes, desempenho e balanceamento dentro de limites declarados.
- Documentação técnica e atualização do estado de `AGENTS.md`.

### Bloqueadas para merge automático

- Autenticação, identidade, Firebase Rules, contas e permissões.
- Segredos, tokens, variáveis protegidas e credenciais.
- Dados persistentes, migrações, exclusão de saves e alterações irreversíveis.
- Dependências, workflows, scripts de integração, branch protection, permissões GitHub e infraestrutura Cloudflare.
- Pagamentos, privacidade e exportação de dados.

Essas categorias podem receber PR e diagnóstico, mas exigem revisão humana específica.

## Requisitos obrigatórios do integrador

- Executar somente em workflow confiável da branch padrão; nunca fazer checkout nem executar código da PR em job com permissão de escrita.
- Usar permissões mínimas e token de curta duração.
- Exigir allowlist explícita de autores; fork, autor desconhecido ou branch inesperada falha fechada.
- Comparar o SHA atual da PR com o SHA que recebeu CI verde imediatamente antes do merge.
- Exigir todos os checks obrigatórios em `success`; falha, cancelamento, skip não autorizado, ausência ou pendência bloqueiam.
- Validar caminhos de origem e destino, renomeações, exclusões, volume, concorrência e limites diários.
- Verificar estado de merge imediatamente antes da operação e usar proteção contra corrida por SHA.
- Registrar decisão, autor, SHA, arquivos, checks, política, merge SHA e deploy.
- Não permitir que o agente altere o próprio integrador, allowlists, permissões ou políticas.
- Permanecer desabilitado por padrão até existir revisão humana da implementação e configuração.

## Recuperação

- Não presumir rollback transacional do GitHub Pages.
- Preservar o último commit conhecido como estável e o artefato publicado.
- Falha de deploy ou health check deve congelar novas integrações e abrir incidente.
- Reversão deve ocorrer por novo commit controlado, sem apagar histórico.
- Mudanças de schema/dados precisam de estratégia compatível e reversível.

## Estado real em 2026-11-19

- O Agent Gate em `.github/workflows/agent-gate.yml` e `scripts/agent-gate/` é somente leitura; ele avalia elegibilidade e não faz merge.
- O executor generativo em `scripts/engineering-agent/run.mjs` é proponente: consulta Gemini, limita os arquivos, cria branch e PR.
- O workflow do executor roda manualmente ou a cada 12 horas. Requer os secrets `GEMINI_API_KEY` e `AGENT_PR_TOKEN`. O segundo deve ser um fine-grained PAT ou GitHub App token com acesso somente a este repositório e permissões Contents: read/write e Pull requests: read/write. Ele é usado no checkout/push e no GitHub CLI para que PRs criadas pelo agente acionem os workflows de CI; o `GITHUB_TOKEN` padrão não deve ser usado para esse fluxo porque eventos originados por ele não disparam novos workflows.
- O executor não faz merge, não publica diretamente e não comprova que o secret esteja configurado.
- A proteção de caminhos inclui rejeição de symlinks, duplicatas, exclusões, arquivos ocultos e caminhos fora do escopo.
- O rótulo `agent-pr` é apenas metadado de classificação; não é autorização.
- Ainda não há integrador automático de merge, health check pós-deploy ou rollback automático verificado. Portanto, o ciclo completo PR → merge → deploy → health check ainda não está ativo.
