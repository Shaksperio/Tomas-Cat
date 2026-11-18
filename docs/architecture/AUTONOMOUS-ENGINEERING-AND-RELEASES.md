# Política de autonomia e publicação contínua — Tomas Vagabundo

## Decisão do produto

O mundo deve evoluir sem exigir aprovação humana para cada atualização de conteúdo ou código de jogo. Agentes autorizados podem planejar, implementar, testar, integrar e publicar mudanças automaticamente quando todas as verificações determinísticas forem aprovadas.

## Fluxo operacional

1. Agentes do jogo e Cowila identificam necessidades e oportunidades de expansão.
2. Um agente de engenharia recebe uma tarefa estruturada, consulta `AGENTS.md` e o estado atual do repositório.
3. O agente cria uma branch isolada, altera somente arquivos dentro de seu escopo e abre uma PR.
4. GitHub Actions executa testes, TypeScript e build sobre o SHA exato da PR.
5. Um avaliador confiável, executado a partir da branch padrão e sem executar código da PR, verifica autoria, origem, caminhos, limites, checks e políticas.
6. Se tudo estiver aprovado, o integrador automático faz squash merge. Nenhuma aprovação humana individual é necessária para mudanças de baixo risco.
7. O push em `main` dispara GitHub Pages. A execução de deploy e o URL publicado são registrados.
8. Uma verificação pós-deploy monitora disponibilidade e sinais básicos de saúde. Falhas suspendem novas integrações e acionam recuperação.

## Classes de risco

### Autonomia automática

- Conteúdo novo e original: missões, diálogos, itens, construções, NPCs, biomas e cenários.
- Sistemas de jogo isolados e extensões de módulos existentes.
- Correções de bugs, testes, desempenho e balanceamento dentro de limites declarados.
- Documentação técnica e atualização do estado de `AGENTS.md`.

### Proteção reforçada / bloqueio automático

- Autenticação, identidade, Firebase Rules, contas e permissões.
- Segredos, tokens, variáveis protegidas e credenciais.
- Dados persistentes, migrações destrutivas, exclusão de saves e alterações irreversíveis.
- Dependências, workflows, scripts de integração, branch protection, permissões GitHub e infraestrutura Cloudflare.
- Pagamentos, billing, privacidade e exportação de dados.

Essas categorias não entram no merge autônomo padrão. O sistema pode abrir PR e apresentar diagnóstico, mas deve bloquear a integração até existir uma política específica e auditada para a categoria.

## Requisitos do integrador

- Executar somente em workflow confiável da branch padrão, nunca fazer checkout nem executar código da PR no job com permissão de escrita.
- Token de curta duração e permissões mínimas: ler PRs/checks e escrever somente o necessário para squash merge.
- Allowlist explícita de identidades de agentes; PR de fork, autor desconhecido ou branch inesperada falha fechada.
- SHA da PR deve ser idêntico ao SHA que recebeu CI verde; qualquer push novo invalida a avaliação.
- Exigir todos os checks obrigatórios em `success`; `failure`, `cancelled`, `skipped`, ausente ou pendente bloqueia, exceto skips explicitamente justificados pelo workflow.
- Validar caminhos de origem e destino, renames, exclusões, volume de alterações, limites por janela e concorrência.
- Limite de PRs simultâneas e merges por dia; fila serializada para evitar corrida entre merges.
- Verificar conflitos e estado de merge imediatamente antes do merge.
- Registrar decisão, autor, SHA, arquivos, checks, política, merge SHA e execução de deploy.
- Não permitir que o agente altere o próprio integrador, suas allowlists, permissões ou políticas de segurança.

## Recuperação e rollback

- Não presumir que GitHub Pages oferece rollback transacional da aplicação.
- Preservar o último commit conhecido como estável e o artefato publicado correspondente.
- Se o deploy falhar, não marcar a versão como publicada e não integrar novas PRs.
- Se a verificação pós-deploy falhar, abrir incidente, congelar a fila e reverter por um novo commit controlado para o último estado estável; nunca apagar histórico.
- Mudanças de schema/dados precisam de estratégia compatível e reversível antes de serem elegíveis para autonomia.

## Separação de agentes

- Agentes do mundo: simulam sociedade, tarefas, economia, construção e eventos dentro das regras do jogo.
- Cowila: coordena prioridades e produz propostas de expansão.
- Agente de engenharia: transforma tarefas aprovadas pela política em alterações versionadas no GitHub.
- Integrador: serviço determinístico, separado do modelo generativo, valida e executa merge automático.
- Publicador: GitHub Actions publica somente o commit integrado em `main`.

A IA generativa não recebe permissão irrestrita para fazer merge ou publicar diretamente. Ela propõe alterações; um integrador determinístico e isolado toma a decisão automática conforme a política.

## Estado de implementação

Esta especificação registra a decisão de autonomia. O Agent Gate atualmente integrado é somente leitura e não faz merge. O executor de engenharia ainda não está ativo. A autonomia de merge/deploy só deve ser anunciada depois de implementar o integrador, configurar identidades/segredos necessários, testar os bloqueios e observar um ciclo completo de PR → CI → merge → deploy → verificação.
