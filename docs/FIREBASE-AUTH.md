# Login Google e personagem protegido

O jogo exige autenticação Google pelo Firebase Authentication antes de montar o motor 3D. O UID do Firebase é o proprietário do personagem.

## 1. Criar/configurar o projeto Firebase

1. No Firebase Console, crie ou selecione um projeto exclusivo para Tomas Vagabundo. Não reutilize os bancos do Shakstory nem do Guardião.
2. Em **Authentication → Sign-in method**, habilite **Google**.
3. Em **Authentication → Settings → Authorized domains**, adicione `shaksperio.github.io` e os domínios de desenvolvimento que forem usados.
4. Em **Firestore Database**, crie o banco em modo de produção.
5. Publique as regras deste repositório: `firebase deploy --only firestore:rules` (após selecionar o projeto com `firebase use`).

## 2. Configuração web

Registre um aplicativo Web no projeto Firebase e configure estas variáveis no GitHub, em **Settings → Secrets and variables → Actions → New repository secret**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_STORAGE_BUCKET` (opcional para este sistema)
- `VITE_FIREBASE_MESSAGING_SENDER_ID` (opcional para este sistema)

O workflow de GitHub Pages injeta essas variáveis apenas durante o build. Para desenvolvimento local, copie `.env.example` para `.env.local` e preencha os mesmos valores.

As configurações Web do Firebase (incluindo apiKey) identificam o aplicativo, não são chaves de conta de serviço. Nunca coloque JSON de service account, chave privada ou credenciais administrativas no frontend ou no repositório.

## 3. Propriedade e salvamento

- Caminho do save: `users/{uid}/gameSaves/main`.
- O documento contém o UID proprietário, versão do esquema, payload completo de `SavedGameState` e timestamp de atualização.
- As regras permitem que uma conta leia/escreva somente documentos dentro de seu próprio UID; todos os demais caminhos ficam bloqueados.
- O navegador mantém também uma cópia local separada por UID para recuperação rápida/offline. Ela não substitui o save remoto.
- Saves antigos sem UID podem ser reivindicados pela primeira conta autenticada neste navegador. Após a migração local, a chave legada é removida para não ser oferecida a outra conta.
- A sessão Firebase persiste no navegador. Sair salva/sincroniza o progresso pendente antes de encerrar a sessão.

## 4. Publicação e validação

O build pode ser compilado sem as variáveis, mas a tela de login ficará bloqueada e o jogo não poderá iniciar. Isso é intencional: não existe modo anônimo ou bypass local. Depois de cadastrar os secrets e publicar as regras, execute o workflow e teste:
- login Google em navegador desktop e Android;
- primeiro acesso cria um personagem novo;
- retorno recupera o mesmo nível, inventário, tarefas e posição;
- duas contas Google no mesmo dispositivo recebem saves locais/remotos diferentes;
- tentativa de leitura de `users/{outroUid}/gameSaves/main` é negada pelo Firestore.

## 5. Limite de confiança

Firebase Authentication identifica a conta e as regras Firestore impedem acesso cruzado entre UIDs. O cliente do jogo ainda calcula a simulação e escreve seu próprio documento; isso protege propriedade e privacidade do save, mas não torna moedas, XP ou combate invioláveis contra um cliente modificado. Para anti-cheat competitivo será necessário um backend autoritativo que valide as transações.
