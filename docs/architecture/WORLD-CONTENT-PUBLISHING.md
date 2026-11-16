# Publicação e versionamento do conteúdo criado pela sociedade

## Objetivo

Separar três coisas que não devem compartilhar o mesmo ciclo de publicação:

1. **Simulação viva:** decisões, tarefas, recursos, posições e construções que acontecem durante a partida.
2. **Conteúdo de mundo versionado:** plantas, distritos, cenários e colocações de módulos aprovados que podem ser distribuídos como uma versão do jogo.
3. **Código do jogo:** motor, regras, renderização, física, catálogo de assets e ferramentas de validação.

Os agentes atuam no primeiro nível. Eles podem propor conteúdo para o segundo nível. Não recebem acesso direto ao terceiro.

## Fluxo de execução

1. Cowila coordena a proposta e os agentes especializados produzem um plano tipado.
2. O motor autoritativo valida identidade, permissões, mundo/setor, catálogo de templates e assets, limites espaciais, dependências e orçamento de recursos.
3. O motor aplica a construção aprovada na simulação e grava eventos versionados. A cena Three.js apenas renderiza o estado confirmado; não é a fonte de verdade.
4. O estado vivo é persistido no backend do jogo (Firestore ou serviço autoritativo futuro), com versão, mundo, região, tick e chaves de idempotência. Isso permite que jogadores vejam a mesma construção sem esperar por uma alteração no GitHub.
5. Uma ação separada de **promover para conteúdo oficial** seleciona uma construção ou conjunto de construções, remove dados pessoais/temporários e gera um pacote declarativo.
6. Um executor de publicação confiável valida o pacote novamente, cria uma branch no GitHub, grava os arquivos, executa CI e abre um Pull Request.
7. O merge aprovado gera uma versão imutável do pacote. O pipeline de distribuição publica essa versão; clientes baixam apenas manifests/pacotes assinados ou publicados pelo canal oficial.

## O que vai para cada lugar

| Informação | Destino |
| --- | --- |
| Posição atual de habitantes, tarefas em andamento e recursos | Persistência do mundo no backend |
| Construções realizadas durante a partida | Estado do mundo no backend, com eventos e revisões |
| Planta aprovada, distrito curado, cenário reutilizável | Pacote de conteúdo versionado no GitHub |
| Novo código, regras, física, renderer ou novos tipos de assets | Branch de engenharia + Pull Request + CI |
| Segredos, tokens e credenciais | Secrets do serviço executor; nunca no jogo, nos pacotes ou no Git |

GitHub não deve ser usado como banco de dados de cada tick ou como destino de cada movimento de operário. Commits por ação de jogo causariam exposição de dados, ruído, limites de API e histórico impraticável.

## Formato declarativo do pacote

O pacote deve conter somente dados validados, por exemplo:

- `manifest.json`: schemaVersion, contentId, contentVersion, worldId, compatibilidade mínima do motor e lista de arquivos.
- `district.json`: limites do distrito, setores, pontos de interesse e metadados.
- `placements.json`: assetId do catálogo, coordenadas, rotação e parâmetros limitados por schema.
- `provenance.json`: IDs de propostas/eventos de origem, versão da simulação e aprovação/promoção.

Nunca aceitar JavaScript, TypeScript, HTML, shaders ou geometria arbitrária produzidos pelos agentes como conteúdo de mundo. `assetId` deve resolver exclusivamente para um asset já incluído e aprovado pelo jogo. Novos assets exigem uma mudança de código revisada separadamente.

## Validações obrigatórias no executor

- Schema e versão compatíveis; IDs únicos e estáveis.
- Todos os mundos, templates e assets existem e estão habilitados.
- Coordenadas finitas, dentro dos limites do mundo e do setor autorizado.
- Colisões, sobreposições proibidas, acessibilidade e orçamento de geometria.
- Limites de tamanho/quantidade de módulos e dependências.
- Nenhuma credencial, dado pessoal ou estado transitório de jogador no pacote.
- Hashes dos arquivos, idempotência da promoção e testes de regressão.
- CI verde antes de merge; branch principal protegida por revisão e checks.

## Segurança e autonomia

- O cliente do jogo nunca recebe token de escrita do GitHub.
- Cowila e os agentes não podem chamar GitHub nem executar comandos de shell.
- Um backend autenticado emite uma solicitação de promoção limitada a um pacote e a um conjunto de permissões.
- O executor usa credencial de curta duração/escopo mínimo, grava somente em branch de publicação e abre PR; não faz push direto em `main`.
- Rejeições e falhas deixam o mundo vivo intacto. A publicação não é condição para a construção aparecer na partida.
- A promoção pode ser automática apenas para categorias previamente autorizadas e com limites rígidos. Conteúdo novo, estrutural ou que altere código requer aprovação explícita.

## Estado atual e integração pendente

A base existente já tem contratos de `ConstructionProject`/`ConstructionModule`, validação de propostas de expansão, `WorldSceneManager` e renderização de construções pela `SocietyActors`. Porém:

- A construção mostrada hoje por `SocietyActors` é uma representação visual local genérica, acionada pela conclusão de `build_module`; ela não é ainda uma aplicação autoritativa de um `ConstructionProject` com assetId real.
- `WorldSceneManager` gerencia raízes de cenas, mas ainda não oferece um serviço de mutação/persistência de construções por região.
- As propostas de expansão ainda não estão ligadas ao scheduler nem ao construtor real do mundo.
- Não existe ainda exportador, executor de publicação, schema de pacote, workflow de PR de conteúdo ou distribuição de versões de conteúdo.

Portanto, esta especificação define a fronteira segura e o destino da integração; não declara que a publicação automática já esteja implementada.
