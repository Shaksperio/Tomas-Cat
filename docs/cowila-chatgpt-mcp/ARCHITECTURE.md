# Cowila Firestore Connector — ChatGPT MCP

Status: arquitetura inicial em revisão; ainda não implantado nem conectado ao ChatGPT.

## Objetivo

Disponibilizar ao ChatGPT um servidor MCP remoto e dedicado para consultar, em modo estritamente somente leitura, o histórico e os registros de treinamento da Cowila no Firebase Firestore. O consumidor pretendido é exclusivamente o ChatGPT. Não é um conector genérico para Claude, Gemini ou outros clientes MCP.

## Contexto verificado no repositório

- Projeto: `Shaksperio/Tomas-Cat`.
- Worker de inferência existente: `tomas-cowila-ai`, em `workers/cowila-ai/`.
- Endpoint de chat existente: `POST /v1/oracle-chat`; o modo `training` é separado do runtime do jogo.
- Firestore configurado pelo app: `VITE_FIREBASE_PROJECT_ID` e, opcionalmente, `VITE_FIREBASE_DATABASE_ID`.
- O código atual do laboratório lê/grava `users/{uid}/cowilaLab/real-training-v2` e mantém até 100 mensagens no documento.
- O arquivo `docs/COWILA-LAB.md` descreve também o caminho legado `users/{uid}/cowilaLab/current`; portanto, o conector deve descobrir e reportar ambos os documentos, sem presumir que um substituiu o outro.
- A conta administrativa reconhecida pela interface é `antonyopintor@gmail.com`. O UID deve ser obtido por autenticação/autorização real; nunca inferido apenas pelo e-mail.
- A tarefa T-105 reserva toda a pasta `workers/`; esta entrega fica isolada em `integrations/cowila-chatgpt-mcp/` e não modifica o Worker existente.

## Arquitetura proposta

1. Servidor MCP remoto independente em Cloudflare Workers, com transporte HTTP compatível com MCP.
2. Autorização OAuth compatível com o fluxo de conexão de aplicativos do ChatGPT. A implementação deve ser validada contra a documentação atual do ChatGPT antes de declarar compatibilidade. Não depender de token estático colado no chat.
3. Identidade Firebase delegada do próprio operador, autenticada por Google no fluxo de autorização; nenhum UID ou token é aceito como argumento de ferramenta.
4. Acesso ao Firestore por API REST com ID token Firebase renovado a partir de refresh token protegido e database ID explicitamente configurado; as Firestore Security Rules continuam sendo a barreira de autorização.
5. Autorização do lado do conector vinculada ao usuário autorizado do ChatGPT e ao UID Firestore permitido. O e-mail isoladamente não é prova de identidade.
6. Allowlist explícita de coleções/caminhos; nenhuma consulta arbitrária, gravação, exclusão ou enumeração irrestrita.
7. Auditoria com metadados mínimos (ferramenta, horário, resultado/erro, identidade pseudonimizada), sem registrar conteúdo integral das conversas.

## Ferramentas MCP previstas

| Ferramenta | Comportamento |
| --- | --- |
| `cowila_firestore_diagnostics` | Verificar configuração e existência dos documentos conhecidos, sem expor segredos |
| `cowila_list_conversations` | Listar metadados de conversas autorizadas, com limite e paginação |
| `cowila_get_conversation` | Recuperar mensagens de uma conversa autorizada |
| `cowila_search_messages` | Pesquisar texto em dados explicitamente permitidos, com limite de resultados |
| `cowila_get_training_results` | Recuperar os resultados do experimento de autonomia, se ainda estiverem presentes nos documentos permitidos |

Todas as ferramentas são read-only. Não haverá ferramenta de escrita, exclusão, migração, execução de código ou alteração de regras Firebase.

## Segurança e privacidade

- Negar por padrão; sem autenticação válida, nenhuma ferramenta é executada.
- Validar o token em toda requisição e rejeitar audience/issuer/client inválidos.
- Limitar tamanho de entrada, paginação, frequência e quantidade de mensagens retornadas.
- Remover campos sensíveis e nunca devolver tokens, chaves, e-mails de terceiros ou dados fora da allowlist.
- Não criar endpoint de proxy genérico para Firestore.
- Não confiar em parâmetros de UID fornecidos pelo modelo/cliente; derivar o UID da identidade autorizada no servidor.
- Respostas MCP devem identificar claramente ausência de dados versus erro de permissão/configuração.
- Não alterar nem migrar documentos existentes.

## Configuração esperada (nomes ilustrativos; valores nunca versionados)

- `FIREBASE_PROJECT_ID`
- `FIRESTORE_DATABASE_ID`
- segredos/estado necessários ao OAuth do servidor, definidos após confirmar o fluxo oficial suportado pelo ChatGPT.

Nenhum segredo será solicitado em mensagem de chat. O provisionamento deverá ocorrer pelo painel de Secrets do Cloudflare ou mecanismo seguro equivalente.

## Critérios de aceite

1. Testes cobrem inicialização MCP, descoberta de ferramentas, chamadas válidas e inválidas, autenticação, limites e erros.
2. Testes comprovam que não existem métodos de escrita Firestore no código exposto.
3. Testes comprovam que UID não pode ser escolhido pelo chamador.
4. Diagnóstico confirma os caminhos Firestore existentes sem modificar dados.
5. Verificação de segurança não encontra credenciais ou conteúdo pessoal em logs.
6. Compatibilidade OAuth e cadastro do aplicativo são demonstrados no ChatGPT; o uso no Android só será declarado depois de teste real no aplicativo.
7. Deploy somente após aprovação humana de secrets, projeto Firebase, database ID e permissões.

## Bloqueios conhecidos

- Ainda não há acesso autorizado do conector a um projeto Firebase real nesta conversa.
- O projeto Firebase e o database ID de produção precisam ser confirmados em configuração segura. O app usa variáveis Vite, mas elas não são credenciais administrativas e não concedem acesso ao servidor.
- O cadastro de um MCP personalizado no ChatGPT e a disponibilidade mobile dependem dos recursos atuais da plataforma. Criar e publicar um Worker não instala automaticamente um aplicativo no ChatGPT.
- A integração não deve ser implantada nem anunciada como conectada até validar OAuth, permissões, dados e uso no Android.

## Plano de implementação

1. Validar o fluxo oficial de MCP/OAuth aceito pelo ChatGPT.
2. Implementar o transporte MCP e a camada de autorização isolada.
3. Implementar leitura Firestore restrita e testes com respostas simuladas.
4. Executar revisão de segurança e testes de contrato.
5. Configurar secrets e projeto real somente após autorização explícita.
6. Fazer diagnóstico read-only e, por último, cadastrar o aplicativo no ChatGPT e testar no Android.


## Configuração Firebase já existente no GitHub Actions (verificada em 2026-11-25)

O workflow `.github/workflows/deploy-pages.yml` já injeta no build do frontend:

- Secrets: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`.
- Database ID: `VITE_FIREBASE_DATABASE_ID`, lido de Secret se definido; caso contrário, o workflow usa o valor padrão `ai-studio-780f41f1-7f4e-40c2-91b7-1ac37ba9bac6`.
- Variable: `VITE_COWILA_AI_URL`, alimentada por `vars.COWILA_AI_URL`.

O cliente em `src/firebase/client.ts` usa esses valores para inicializar Firebase Auth e Firestore. Isso confirma que o build publicado já conhece o projeto e o banco usados pelo app. Não é necessário pedir ao operador que recadastre esses mesmos valores para o frontend.

**Limite de segurança:** variáveis `VITE_*` são incorporadas ao bundle do navegador; mesmo quando o valor de origem está cadastrado como GitHub Secret, o valor compilado pode ser extraído do app publicado. A Firebase Web API key e a configuração web identificam o projeto, mas não substituem autenticação nem concedem privilégios administrativos por si só. O conector MCP no servidor não deve tratar esses valores como credencial de serviço nem presumir que o MCP pode ler Firestore apenas por conhecê-los.

Para leitura server-side, o conector usará a identidade Firebase delegada do operador, e não uma service account privilegiada. O ID token será renovado no servidor usando o refresh token obtido no fluxo de vinculação Google/Firebase. O refresh token é uma credencial de alto impacto: deve ser cifrado em repouso com chave em Cloudflare Secret, nunca gravado em claro em D1, GitHub, logs, prompts ou respostas MCP. A viabilidade dessa renovação precisa ser provada com uma conta e documento de teste antes de qualquer leitura de histórico real.

A variável `COWILA_AI_URL` é o endereço do Worker de inferência/chat, não o endpoint de dados do Firestore; ela não deve ser confundida com a URL do servidor MCP. O MCP será um serviço separado.


## Decisão técnica após consulta à documentação Cloudflare (2026-11-25)

A documentação oficial atual do Cloudflare Agents confirma:

- Para um servidor MCP novo e sem estado de protocolo, usar `createMcpHandler` de `agents/mcp/server` com `McpServer` de `@modelcontextprotocol/server` (SDK MCP v2), em vez do `McpAgent` legado.
- O transporte remoto recomendado é Streamable HTTP; SSE antigo não será usado.
- A camada de recurso autenticado é `OAuthResourceServer` de `@cloudflare/workers-oauth-provider`. Ela valida token e audience/recurso antes de encaminhar ao handler.
- O escopo `requiredScopes` é anunciado, mas não aplicado automaticamente: o handler precisa validar `ctx.auth.scope` e rejeitar chamadas sem `mcp:read`.
- A identidade e os atributos aprovados no fluxo OAuth chegam às ferramentas por `getMcpAuthContext()?.props`; o UID Firebase deve vir de um vínculo confiável gravado no servidor durante a autorização, nunca de argumento MCP.
- A documentação recomenda um authorization server e resource server separados, com validação de tokens via Service Binding dentro da rede Cloudflare.

Referências oficiais consultadas:
- https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/
- https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/
- https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/
- https://developers.cloudflare.com/agents/model-context-protocol/guides/securing-mcp-server/

### Consequência para a implementação

Não será criado um endpoint MCP aberto nem um token estático compartilhado. A arquitetura precisa incluir OAuth Authorization Server + MCP Resource Server, consentimento explícito, audience exata do MCP e escopo mínimo `mcp:read`. O servidor só poderá consultar o UID Firebase previamente vinculado a uma identidade autorizada. A URL final do MCP e a compatibilidade do OAuth com o cadastro de conectores do ChatGPT ainda precisam ser verificadas antes de fixar os metadados e implantar.

### Decisão sobre acesso Firestore

As variáveis `VITE_FIREBASE_*` do GitHub Actions pertencem ao cliente web e não serão usadas como identidade server-side. A decisão está tomada: **Firebase Auth delegado**. Não haverá fallback silencioso para service account. O fluxo OAuth do próprio conector deve autenticar o operador com Google/Firebase, vincular o UID validado ao principal OAuth e emitir autorização MCP com esse vínculo. Se a renovação do token Firebase não puder ser implementada com segurança, o projeto para e apresenta alternativas; não contorna as Security Rules. Nenhum dado real será consultado até a prova de conceito e aprovação explícita.

## Revisão de autorização Firestore e decisão de identidade (2026-11-25)

A leitura direta dos arquivos atuais em `main` confirmou:

- `firestore.rules` permite `get/list` em `users/{userId}/cowilaLab/{sessionId}` somente quando o token Firebase autenticado tem o mesmo UID do caminho, e-mail `antonyopintor@gmail.com` e `email_verified == true`.
- As regras de escrita também impõem `ownerUid`, `schemaVersion == 1`, lista `messages` com no máximo 100 itens, `instructions` string até 1500 caracteres e `updatedAt` inteiro.
- O caminho legado documentado é `users/{uid}/cowilaLab/current`; a documentação da versão v2 registra `users/{uid}/cowilaLab/real-training-v2`. Ambos estão sob o mesmo match de regras, mas isso não prova que ambos existam no banco.
- O cliente Firebase usa Firebase Auth no navegador e inicializa Firestore com o database ID definido em `VITE_FIREBASE_DATABASE_ID` (ou o banco padrão da SDK).

### Consequência de segurança

Uma service account usada no servidor normalmente acessa Firestore via IAM e não fica sujeita às Security Rules do mesmo modo que um cliente Firebase. Portanto, uma allowlist de UID no código MCP não equivale à proteção por usuário das regras. Não adotaremos service account como solução padrão para este conector.

### Estratégia preferida: delegação Firebase Auth

A próxima prova de conceito deve preservar as regras existentes usando uma identidade Firebase do próprio operador:

1. O usuário inicia um fluxo de vinculação em uma página HTTPS controlada pelo projeto e autentica-se no Firebase pelo método já suportado pelo app.
2. O servidor valida o ID token Firebase (assinatura, issuer, audience, expiração, UID, e-mail e e-mail verificado) e vincula esse UID à identidade OAuth autenticada do ChatGPT.
3. Para chamadas MCP posteriores, o servidor usa um mecanismo seguro de renovação da sessão Firebase do próprio usuário; tokens e refresh tokens ficam cifrados em armazenamento server-side, nunca em argumentos MCP, logs ou Git.
4. Consultas Firestore REST usam o token Firebase do usuário, de modo que as Security Rules continuam sendo aplicadas. A autorização também restringe os caminhos às sessões Cowila permitidas e ao UID vinculado.
5. Desvincular/revogar a conexão invalida a associação e elimina os tokens armazenados conforme política de retenção.

**Bloqueio técnico a resolver antes de codificar:** confirmar qual provedor/método de login Firebase o app usa e demonstrar que a renovação de credenciais pode ser feita com segurança sem exigir que o usuário cole tokens no ChatGPT. Se isso não for possível, interromper e apresentar alternativas; não contornar as regras com credencial administrativa silenciosamente.

### Escopo de leitura inicial

A primeira versão deve expor somente:
- diagnóstico da existência e metadados mínimos dos dois IDs de documento conhecidos (`current` e `real-training-v2`);
- leitura paginada e limitada das mensagens de uma sessão selecionada dentro desses caminhos;
- pesquisa limitada apenas sobre conteúdo desses documentos autorizados.

Não oferecer ferramentas MCP para criar, atualizar, excluir, exportar em massa ou consultar caminhos arbitrários. Não afirmar que o histórico está presente até o diagnóstico real retornar os documentos.

## Inspeção do código real de autenticação e persistência (2026-11-25)

Arquivos conferidos em `main`: `src/App.tsx`, `src/components/CowilaLab.tsx`, `src/firebase/cowilaLabStore.ts`, `src/firebase/client.ts` e `docs/FIREBASE-AUTH.md`.

### Autenticação efetivamente usada

- O app usa **Firebase Authentication com Google** (`GoogleAuthProvider`, `signInWithPopup`, fallback `signInWithRedirect`).
- O cliente observa a sessão com `onAuthStateChanged`; a SDK tenta persistência IndexedDB, localStorage, sessionStorage e, por último, memória.
- O Laboratório recebe o objeto `User` já autenticado pelo app. Não há fluxo de login por senha/email no código verificado.
- O token de sessão atual vive na sessão Firebase do navegador. O app não envia um token Firebase ao Worker `tomas-cowila-ai` no fluxo do chat.

### Persistência efetivamente usada

- O módulo `src/firebase/cowilaLabStore.ts` lê com `getDoc` e grava com `setDoc` exclusivamente em `users/{uid}/cowilaLab/real-training-v2`.
- O componente também mantém cópia local em `localStorage`, chave `cowila-real-training:v2:{uid}`.
- O caminho `current` aparece na documentação como legado; não é consultado pelo módulo de persistência atual.
- O registro remoto valida `ownerUid`, `schemaVersion`, `messages`, `instructions` e `updatedAt`. A gravação remota é limitada a 100 mensagens e instruções de até 1500 caracteres.

### Impacto para a vinculação MCP

A simples autenticação OAuth do ChatGPT não entrega ao servidor a sessão Firebase que hoje existe no navegador. O MCP não pode reutilizar `firebaseAuth.currentUser` remotamente e não deve pedir ao usuário para copiar ID token/refresh token no chat.

A próxima implementação deve separar duas autorizações:
1. OAuth ChatGPT → autentica e autoriza o cliente a chamar o MCP.
2. Vinculação Firebase Google → autentica o proprietário do Firestore e prova o UID permitido.

A vinculação precisa ocorrer numa página HTTPS própria, com callback protegido contra CSRF/state replay e validação de domínio/audience/issuer. O servidor deve guardar somente o material mínimo necessário, cifrado e com revogação. Para consultar Firestore preservando as regras, a opção delegada exigirá uma forma segura de renovar a sessão Firebase do usuário. A SDK web atual, por si só, não fornece essa sessão ao MCP.

### Prova de conceito obrigatória antes de qualquer acesso real

- Demonstrar um fluxo Google/Firebase de vinculação que não dependa de copiar tokens manualmente.
- Demonstrar renovação do token Firebase e leitura REST de um documento de teste sob as mesmas Security Rules.
- Demonstrar que UID não pode ser alterado por parâmetro de ferramenta nem por outra conta ChatGPT.
- Demonstrar revogação/desvinculação e limpeza segura do material de sessão.
- Usar apenas dados de teste inicialmente; nenhuma leitura de histórico real nesta fase.

### Correção de escopo dos documentos

A documentação de produto cita `users/{uid}/cowilaLab/current` como caminho legado, mas o código atual só lê/escreve `real-training-v2`. A primeira versão MCP não deve prometer consulta a `current` até existir uma justificativa de migração/recuperação e teste específico. O diagnóstico inicial deve priorizar o documento v2; o caminho legado fica fora do escopo até confirmação do operador.


## Próxima prova de conceito — sessão Firebase delegada (2026-11-25)

### Fluxo candidato

1. O ChatGPT inicia o OAuth do servidor MCP; o servidor de autorização conduz o usuário ao login Google/Firebase numa página HTTPS controlada pelo projeto.
2. O Firebase Authentication conclui o login com o provedor Google já usado pelo Cowila Lab. O callback valida state de uso único, origem/redirect URI exatos e proteção contra replay.
3. O backend valida o Firebase ID token (assinatura, issuer, audience, expiração, subject, e-mail e e-mail verificado) e confirma o UID permitido. O UID nunca vem de parâmetro MCP.
4. O backend recebe o refresh token por canal HTTPS de back-channel, cifra-o antes de persistir e associa o registro ao identificador estável do principal OAuth. O token não é retornado ao ChatGPT.
5. Em cada chamada autorizada, o backend troca o refresh token por um ID token recente no endpoint oficial de refresh do Firebase Authentication e chama Firestore REST com o ID token.
6. A consulta só pode acessar o documento users/{uid}/cowilaLab/real-training-v2; limites de tamanho, campos e paginação são aplicados antes da resposta MCP.
7. Desvincular remove a associação e o refresh token cifrado. A revogação também deve ser testada com a revogação de sessões Firebase; a exclusão local do token não revoga por si só tokens já emitidos.

### Riscos e controles obrigatórios

- O refresh token Firebase equivale a uma credencial duradoura. A chave de cifragem fica em Cloudflare Secret; D1 guarda somente ciphertext, nonce, versão da chave, UID, timestamps e estado de revogação.
- Não registrar corpos de callback, cabeçalhos Authorization, ID tokens, refresh tokens nem conteúdo integral de mensagens.
- Restringir a conta por UID e e-mail verificado conforme as regras existentes; não confiar somente no endereço de e-mail.
- Validar state, PKCE quando aplicável, redirect URI exato, issuer, audience, assinatura e expiração; impedir vinculação de conta por CSRF ou troca de sessão.
- Renovação deve tratar invalid_grant, token revogado, expiração e indisponibilidade sem cair para credenciais administrativas.
- A prova inicial usa projeto/documento de teste isolado. Não ler nem alterar real-training-v2 de produção nesta etapa.

### Testes de saída da prova

- Login Google/Firebase completo sem copiar tokens manualmente.
- Refresh do token Firebase com sucesso e leitura REST de documento de teste sob Firestore Security Rules.
- Usuário/UID diferente, e-mail não verificado, state repetido, token expirado e token revogado são rejeitados.
- O chamador não consegue selecionar outro UID, database, coleção ou caminho.
- Desvinculação remove a credencial cifrada e bloqueia chamadas subsequentes.
- Testes automatizados confirmam ausência de ferramentas de escrita e ausência de segredos em logs.

### Bloqueio externo ainda aberto

A compatibilidade do fluxo OAuth/registro de servidor MCP com a modalidade de conexão personalizada disponível na conta ChatGPT e no aplicativo Android ainda não foi demonstrada. A implementação não será declarada conectada até esse teste real. A existência de um endpoint MCP remoto, por si só, não instala o conector no ChatGPT.


## Primeira implementação isolada (2026-11-25)

Foi criado o primeiro incremento executável em `integrations/cowila-chatgpt-mcp/src/`, sem tocar em `workers/`, no cliente Firebase existente ou nas regras/dados:

- `firebase-auth.ts`: troca o refresh token Firebase por ID token novo via Secure Token API; exige UID esperado, valida campos/expiração e sanitiza erros sem incluir o corpo do provedor.
- `secret-vault.ts`: cifra/decifra refresh tokens com AES-256-GCM, nonce aleatório de 96 bits e contexto autenticado versionado. A chave de 32 bytes é fornecida em runtime e não está no repositório.
- Testes: renovação válida, UID divergente, erro do provedor sem vazamento de corpo, resposta incompleta, round-trip AES-GCM, nonce exclusivo, chave inválida, ciphertext adulterado e versão não suportada.
- Workflow isolado `.github/workflows/cowila-chatgpt-mcp.yml`: instala dependências travadas e executa somente os testes do conector em PR/push relevante.

**Limite desta implementação:** estes módulos não fazem a vinculação inicial Google/Firebase, não persistem credenciais, não iniciam OAuth, não expõem MCP e não acessam Firestore. A segurança do refresh depende de o fluxo de vinculação validar o ID token inicial e vincular o UID ao principal OAuth antes de guardar o refresh token. O workflow foi criado, mas seu resultado precisa ser observado no GitHub Actions antes de considerar os testes aprovados.


### Resultado da primeira execução CI

- Primeira execução falhou antes dos testes porque o repositório não possui `package-lock.json`; o passo `setup-node` com cache npm exigia um lockfile.
- Workflow corrigido para executar a versão fixada `tsx@4.21.0` via `npx`, sem presumir lockfile nem instalar a árvore completa do jogo.
- Execução seguinte: **9 testes aprovados, 0 falhas** (GitHub Actions run #4, job `Firebase auth + encrypted vault tests`).
- O teste valida os módulos isolados em Node 22. Ainda não é prova de compatibilidade em produção Cloudflare Workers, nem valida o fluxo OAuth completo.
