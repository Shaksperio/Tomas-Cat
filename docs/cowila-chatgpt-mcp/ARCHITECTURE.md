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
3. Identidade de serviço do Google armazenada somente como segredo do Worker; credencial nunca vai para GitHub, D1, resposta MCP ou logs.
4. Acesso ao Firestore por API REST com escopo mínimo de leitura e database ID explicitamente configurado.
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

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
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
