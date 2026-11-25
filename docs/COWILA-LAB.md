# Laboratório Real de Treinamento da Cowila

**Rota:** `https://shaksperio.github.io/Tomas-Cat/cowila-lab`

O laboratório é um ambiente real de treinamento e avaliação de IA, separado da experiência narrativa do jogo. Usa uma rota de treinamento isolada na API do Worker `tomas-cowila-ai`:
`POST https://tomas-cowila-ai.antonyopintor.workers.dev/v1/oracle-chat` com `mode: training`.

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

- Histórico, instruções e feedback são sincronizados em Firestore no documento `users/{uid}/cowilaLab/current`, separados pelo UID Firebase; até 100 mensagens são mantidas na nuvem e há também uma cópia local em `localStorage`.
- As regras de `firestore.rules` limitam leitura/escrita à conta administrativa verificada e ao próprio UID. As regras precisam ser publicadas no banco Firestore selecionado pelo `VITE_FIREBASE_DATABASE_ID` (o workflow usa `ai-studio-780f41f1-7f4e-40c2-91b7-1ac37ba9bac6` como padrão) para habilitar a persistência remota.
- O Worker atual é stateless para o chat: recebe o histórico do cliente, processa a solicitação e retorna a resposta.
- A exportação JSONL é um conjunto de candidatos; aprovação na interface não substitui revisão de privacidade, deduplicação, validação e avaliação.
- Não há treinamento online. Workers AI executa inferência; os pesos do modelo não são alterados pela conversa.
- O endpoint atual reporta o modelo `@cf/meta/llama-3.3-70b-instruct-fp8-fast` quando responde pelo Cloudflare. O fallback Gemini pode ocorrer quando configurado; a interface mostra o provedor retornado.

## Persistência na nuvem

O histórico é salvo no Firestore já utilizado pelo jogo, no caminho `users/{uid}/cowilaLab/current`. As regras foram adicionadas em `firestore.rules` para permitir acesso apenas ao usuário autenticado, com e-mail administrativo verificado e UID correspondente. A publicação das regras depende do Firebase Console/CLI e não é executada pelo workflow do GitHub Pages. No Console, selecione o mesmo banco nomeado configurado no build e publique o conteúdo de `firestore.rules`.

O chat e a inferência continuam no Worker Cloudflare. Não é necessário adicionar D1, R2 ou Durable Objects para esta primeira versão.

## Treinamento real

Pipeline futuro:
1. Exportar exemplos aprovados.
2. Revisar privacidade, remover dados pessoais e segredos, deduplicar.
3. Criar tarefas de avaliação e baseline.
4. Preparar dataset SFT.
5. Treinar apenas em modelo/infra compatíveis, com recursos e licenças aprovados.
6. Comparar com baseline e promover somente após aprovação.

O feedback em chat é supervisão humana e coleta de experiências, não aprendizagem de pesos em tempo real.


## Isolamento do jogo (v2)

- O modo `training` estabelece a identidade de Cowila como IA em treinamento real, fora de Tomas Vagabundo, da Matrix e de qualquer roleplay.
- O operador é tratado como responsável humano pelo projeto e treinador, nunca como O Escolhido ou personagem.
- O Worker não injeta lore, perfil de personagem, snapshot do mundo ou contexto de jogo no modo `training`.
- O modo `training` não executa `generateOracleActions` e sempre retorna `actions: []`; não pode emitir comandos para alterar o mundo do jogo.
- As skills de jogo permanecem no runtime da sociedade do jogo, onde são necessárias aos NPCs/agentes simulados. Elas não são carregadas nem disponibilizadas ao chat do laboratório. Removê-las do runtime do jogo quebraria os agentes do jogo, por isso a separação é feita na fronteira correta.
- O histórico anterior do laboratório não é reutilizado: o navegador usa a chave local `cowila-real-training:v2` e o Firestore usa o documento `real-training-v2`, evitando contaminar o novo ambiente com conversas antigas que mencionem O Escolhido ou a Matrix.
- Feedback continua sendo contextual e supervisionado. Não representa alteração dos pesos do modelo.
