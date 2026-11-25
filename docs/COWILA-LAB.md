# Laboratório da Cowila

**Rota:** `https://shaksperio.github.io/Tomas-Cat/cowila-lab`

O laboratório é uma interface separada do jogo, mas usa a mesma API de conversa do Worker `tomas-cowila-ai`:
`POST https://tomas-cowila-ai.antonyopintor.workers.dev/v1/oracle-chat`.

## Acesso

- Faça login no jogo com a conta administrativa verificada `antonyopintor@gmail.com`.
- Abra a rota `/Tomas-Cat/cowila-lab`.
- A rota reutiliza a autenticação Firebase já existente no aplicativo.
- Usuários sem o e-mail administrativo verificado recebem a tela de acesso restrito.

## Recursos

### Chat ao vivo
- Envia mensagens ao Worker Cloudflare em tempo real.
- Encaminha até dez mensagens anteriores como contexto, respeitando o contrato atual do Worker.
- Exibe provedor/modelo reportados pelo Worker e latência medida no navegador.
- Permite iniciar uma nova sessão.

### Avaliação
- Casos exploratórios para retenção de contexto, raciocínio lógico, personalidade e honestidade.
- Execução sequencial para reduzir a chance de atingir o rate limit atual do Worker.
- As respostas permanecem no chat para avaliação humana. Não há nota automática independente nesta versão.

### Feedback e treinamento
- Avaliação positiva/negativa por resposta.
- Campo de correção/instrução associado à resposta.
- Feedback e instruções são reenviados como mensagens de contexto nas próximas chamadas; portanto, influenciam a conversa atual, mas não atualizam pesos do modelo.
- Aprovação manual de exemplos.
- Exportação JSONL para curadoria e preparação de dataset.

## Persistência e limites atuais

- Histórico, instruções e feedback ficam em `localStorage`, no navegador e dispositivo utilizados. São separados pelo UID Firebase.
- Não há gravação em D1, Durable Objects, R2 ou outro banco da Cloudflare nesta versão.
- O Worker atual é stateless para o chat: recebe o histórico do cliente, processa a solicitação e retorna a resposta.
- A exportação JSONL é um conjunto de candidatos; aprovação na interface não substitui revisão de privacidade, deduplicação, validação e avaliação.
- Não há treinamento online. Workers AI executa inferência; os pesos do modelo não são alterados pela conversa.
- O endpoint atual reporta o modelo `@cf/meta/llama-3.3-70b-instruct-fp8-fast` quando responde pelo Cloudflare. O fallback Gemini pode ocorrer quando configurado; a interface mostra o provedor retornado.

## Próxima etapa para persistência na nuvem

Para que o histórico e os feedbacks fiquem disponíveis em diferentes dispositivos, a etapa seguinte é adicionar armazenamento server-side isolado por usuário (por exemplo, Durable Object com SQLite), autenticação do token Firebase no Worker, limites de retenção e endpoints protegidos para listar/exportar/apagar dados. Isso requer uma migration do Worker e configuração de autenticação; não é ativado automaticamente por esta interface.

## Treinamento real

Pipeline futuro:
1. Exportar exemplos aprovados.
2. Revisar privacidade, remover dados pessoais e segredos, deduplicar.
3. Criar tarefas de avaliação e baseline.
4. Preparar dataset SFT.
5. Treinar apenas em modelo/infra compatíveis, com recursos e licenças aprovados.
6. Comparar com baseline e promover somente após aprovação.

O feedback em chat é supervisão humana e coleta de experiências, não aprendizagem de pesos em tempo real.
