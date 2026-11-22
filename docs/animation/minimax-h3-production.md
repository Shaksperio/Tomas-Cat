# Pipeline cinematográfico MiniMax H3 — Tomas Vagabundo

> **Estado (2026-11-21):** especificação técnica; nenhuma geração de vídeo, chamada autenticada à API, upload para R2 ou integração no runtime. O responsável informou que cadastrou `MINIMAX_API_KEY` nos GitHub Actions Secrets; o valor e a existência do secret não são verificáveis por esta documentação/conector e não devem ser expostos.
>
> **Tarefa:** T-222. Esta especificação é independente da implementação da abertura em Three.js (T-221). A cena em tempo real permanece como fallback obrigatório.

## 1. Objetivo e limites

Usar MiniMax H3 para produzir clipes cinematográficos pré-renderizados da chegada de Tomas ao planeta, mantendo Three.js responsável por gameplay, câmera interativa, combate ATB e transições que exigem controle do jogador.

O H3 não será executado no navegador, no Worker nem por dispositivo de jogador. A geração ocorre em processo de produção controlado, fora do runtime. O Worker poderá futuramente autenticar/autorizar pedidos e entregar metadados, mas não hospedará o modelo nem exporá credenciais.

**Princípios obrigatórios**
- Nenhuma chave MiniMax em código cliente, bundle, repositório, logs ou D1.
- Nenhuma geração por jogador ou em cada carregamento. Clipes são artefatos versionados.
- Não substituir o combate ATB por vídeo. O vídeo termina antes do ponto de entrada do combate jogável.
- Preservar a cinemática procedural Three.js como fallback offline, acessível e de baixa latência.
- Não fazer upload/publicação até revisão visual, licença, custo, direitos de uso e integridade dos arquivos.
- Não assumir endpoint, payload, limite de duração, codec, retenção ou política comercial sem confirmar documentação oficial e condições vigentes da conta.

## 2. Primeiro pacote de produção

- Formato: 16:9.
- Idioma de falas e textos: português brasileiro.
- Modelo-alvo: MiniMax H3.
- Primeiro passe: 768p para avaliar composição, identidade e continuidade; resolução final superior somente após aprovação visual e confirmação de custo/capacidade.
- Estrutura: seis clipes independentes de 8 segundos (48 segundos de vídeo no total). Cada clipe fica abaixo do limite de 15 segundos descrito no guia de produção consultado.
- O tempo efetivo da experiência será maior porque o combate ATB jogável acontece entre S04 e S05.

## 3. Identidade visual e continuidade

### Tomas — forma original androide
- Não começa como gato.
- Silhueta sintética humanoide/androide, claramente não orgânica; aparência e proporções finais precisam ser aprovadas em character card antes da renderização.
- Tecnologia de exploração embarcada, sem armadura ou linguagem visual derivada de franquias existentes.
- A forma felina não deve aparecer antes do mapeamento biológico pós-combate.

### Tomas — forma felina adaptativa
- Referência de paleta do modelo atual do jogo: pelagem cinza-escura `#3b4252`, peito claro `#d8dee9`, olhos âmbar `#f59e0b`, detalhes tecnológicos ciano `#06b6d4`.
- Essa referência corresponde a Tomas transformado, não ao organismo nativo.
- A transformação não transfere consciência, memória ou identidade do organismo escaneado.

### Gato nativo
- É um indivíduo independente, não uma versão do protagonista.
- Design próprio a ser aprovado; não copiar o modelo de Tomas.
- Sua motivação é proteger o habitat/território, não agir como vilão genérico.

### Cowila
- IA central da nave, representada por interface/HUD holográfica, luz, ondas ou projeção abstrata.
- Não é personagem humanoide nem entidade onisciente.
- Analisa dados observáveis, informa incertezas e recomenda ações; Tomas decide.

### Âncoras de continuidade
- A nave, o planeta, o horizonte, o local de pouso e a direção da luz devem permanecer consistentes entre clipes.
- Fixar posição relativa de nave, rampa, Tomas e gato em cada handoff.
- Não mudar unilateralmente cores, proporções, acessórios, escala, clima ou hora do dia.
- Criar e aprovar character cards e scene cards antes de qualquer geração final. Não inventar detalhes ausentes como se fossem canon.

## 4. Shot table — seis colunas

| ID / duração | Objetivo e ação | Câmera e composição | Direção por segundo | Continuidade / handoff | Áudio e texto |
|---|---|---|---|---|---|
| S01 / 8s | Nave de Tomas cruza o espaço e aproxima-se do planeta desconhecido. | Plano geral espacial; planeta cresce no quadro; nave legível como silhueta original. | 0–2s: campo estelar e planeta distante. 2–5s: nave entra no quadro e avança. 5–8s: aproximação revela atmosfera e escala. | Termina com planeta ocupando o fundo e nave orientada para a entrada atmosférica. | Ambiência espacial discreta; sem diálogo obrigatório; sem texto gerado na imagem. |
| S02 / 8s | Entrada atmosférica e descida controlada. | Plano externo acompanhando nave; corte interno breve apenas se preservar orientação. | 0–2s: contato com atmosfera. 2–5s: turbulência controlada, brilho térmico sem ocultar a nave. 5–8s: estabilização e local de pouso visível. | Mesmo planeta, nuvens, direção de deslocamento e local de pouso de S03. | Som de vibração/propulsão; eventual alerta da nave será adicionado na pós-produção. |
| S03 / 8s | Pouso, abertura da nave e apresentação da forma androide de Tomas. | Plano médio/geral com rampa e silhueta inteira; câmera não atravessa objetos. | 0–2s: trem de pouso toca o solo. 2–5s: poeira/partículas assentam e rampa abre. 5–8s: Tomas androide aparece e observa o ambiente. | Tomas permanece androide; posição final estabelece eixo visual para o encontro em S04. | Cowila pode dizer: “Pouso confirmado. Atmosfera e organismos ainda não classificados.” Voz será gravada/adicionada separadamente. |
| S04 / 8s | Tomas detecta o gato nativo; tensão termina no gatilho de combate. | Plano de estabelecimento do habitat; alternância de olhares sem transformar o clipe em luta. | 0–2s: sinal de movimento no habitat. 2–5s: gato nativo aparece e protege o território. 5–8s: aproximação/pose de confronto; congelar no instante anterior ao primeiro golpe. | Último frame deve permitir transição para arena/estado de batalha ATB. Não mostrar resultado da luta. | Som ambiente do habitat; sem narração explicando o combate. |
| S05 / 8s | Após vitória ATB, Cowila inicia análise biológica do organismo e apresenta resultados limitados. | Close/medium de Tomas e organismo, com interface holográfica legível e sem texto gerado ilegível. | 0–2s: combate já terminou; mostrar distância segura. 2–5s: varredura luminosa percorre o organismo sem o ferir. 5–8s: holograma indica compatibilidade parcial e incertezas. | O organismo não é absorvido nem tem consciência copiada. A análise autoriza a transformação adaptativa de Tomas. | Cowila: “Mapeamento concluído. Estrutura compatível identificada. Iniciando adaptação controlada.” |
| S06 / 8s | Tomas assume a forma felina adaptativa e dá os primeiros passos no habitat. | Plano contínuo de corpo inteiro; transformação legível, sem cortes que escondam a mudança. | 0–2s: silhueta androide inicia reorganização tecnológica. 2–5s: morph gradual para forma felina com paleta aprovada. 5–8s: Tomas testa equilíbrio e olha para o ambiente. | Último frame deve casar com o modelo felino 3D do jogo; handoff para gameplay, não para outro vídeo. | Ambiência do habitat; Cowila pode concluir: “Forma adaptativa estável. Você pode explorar com menor exposição.” |

**Regra de fronteira:** S04 encerra antes do combate. O jogo entrega o controle ao sistema ATB existente. S05 e S06 só são apresentados após a confirmação de vitória do combate real. Se o jogador perder, fugir ou interromper, não reproduzir os clipes de vitória/transformação.

## 5. Fluxo de produção e aprovação

1. **Brief:** congelar premissa, objetivo emocional, público, duração e restrições de IP.
2. **Character cards:** Tomas androide, Tomas felino, gato nativo e representação visual de Cowila. Aprovação humana obrigatória.
3. **Scene cards:** espaço, planeta/atmosfera, interior/rampa da nave e habitat do primeiro contato.
4. **Shot table:** usar exatamente as seis colunas acima; incluir instruções por segundo e handoff explícito.
5. **Storyboard/animatic:** revisar ordem, escala, eixo, ritmo e legibilidade antes de renderizar.
6. **Single-shot generation:** renderizar um clipe por vez, começando por S03 e S04 para validar personagens e continuidade; depois S01/S02 e S05/S06.
7. **QC por clipe:** identidade, anatomia, movimento, câmera, ausência de artefatos, continuidade e áudio. Rejeitar clipes com alteração de identidade ou anatomia.
8. **Montagem:** editar os clipes aprovados; manter uma trilha de ambiência/BGM contínua na pós-produção, com mixagem e direitos verificados.
9. **Aprovação final:** revisão humana quadro a quadro em transições críticas, teste no dispositivo-alvo e comparação com a cena Three.js.
10. **Publicação:** só após licença/termos, custos, integridade, armazenamento e rollback estarem documentados.

Se uma tomada falhar, primeiro reforçar referências/âncoras e reduzir a complexidade. Uma tentativa alternativa pode reduzir o clipe para até 6 segundos. A troca para outro modelo só ocorre após três tentativas malsucedidas e nova aprovação do modelo, custo e consistência; nunca trocar silenciosamente o modelo.

## 6. Arquitetura de integração — proposta, não implantada

```text
Processo de produção protegido
  ├─ brief / cards / shot table aprovados
  ├─ credencial MiniMax em secret do ambiente
  ├─ adaptador de API (contrato oficial a confirmar)
  ├─ geração e polling fora do runtime do jogo
  ├─ QC humano + automático
  └─ artefatos aprovados
       └─ armazenamento de objetos (R2 é candidato)
            └─ manifesto versionado publicado
                 └─ cliente do jogo baixa/usa clipes aprovados
                      └─ fallback: cinemática Three.js

Cloudflare Worker (futuro, opcional)
  ├─ autentica/administra manifesto e permissões
  ├─ nunca recebe chave MiniMax no cliente
  ├─ nunca executa o modelo
  └─ pode emitir URLs temporárias/entrega autorizada, se necessário
```

O processo de produção deve usar uma credencial com escopo mínimo e acesso restrito. Para automação futura, preferir GitHub Actions manual/dispatch protegido ou runner dedicado; exigir aprovação antes de gerar custos. Não imprimir secrets em logs. Não armazenar credenciais em D1. O Worker não deve aceitar prompts arbitrários de jogadores.

### Manifesto de clipes

Cada versão publicada deverá registrar, no mínimo:
- `schemaVersion`, `sequenceId`, `clipId`, `revision`;
- `durationMs`, `width`, `height`, `codec`, `container`;
- `sha256`, `storageKey`, `publishedAt`;
- `modelId` e identificador de geração permitido pela API, quando fornecidos;
- `characterCardRevision`, `sceneCardRevision`, `shotTableRevision`;
- estado de aprovação, responsável e notas de QC;
- gatilho de gameplay anterior/posterior e regra de fallback.

Não publicar URL mutável sem checksum. Uma nova geração cria nova revisão; nunca sobrescreve silenciosamente o artefato que já está em produção.

## 7. Contrato de API e segurança — bloqueado até verificação oficial

Antes de escrever adaptador ou workflow:
- confirmar na documentação oficial vigente MiniMax H3: endpoint, autenticação, formato de requisição, status assíncrono, polling/webhook, download, limites, regiões, resolução, duração, áudio, política de retenção e erros;
- confirmar se o modelo H3 está disponível para a conta e para o país/região;
- confirmar licença e permissão de uso comercial dos resultados, incluindo personagens, vozes e trilhas;
- confirmar preços, limites e mecanismo de cancelamento para evitar gastos inesperados;
- registrar a versão/data da documentação consultada e testes de contrato.
- O README oficial `MiniMax-AI/MiniMax-H3` aponta para o endpoint global `https://platform.minimax.io/docs/api-reference/video-generation-v2-create`; isso identifica a página de referência, mas não confirma por si só o esquema de autenticação, payload, modelo ou fluxo de polling.
- O responsável informou que cadastrou o secret de repositório `MINIMAX_API_KEY` em GitHub Actions. Isso é um relato do operador, não uma verificação técnica do secret. O valor nunca deve ser lido em logs, impresso, copiado para arquivos ou enviado ao cliente.

Até essa verificação, **não inventar URL, nomes de campos, payload, SDK ou estados da API**. O nome `MINIMAX_API_KEY` é a convenção adotada para o secret; seu cadastro foi informado pelo responsável, mas não foi verificado por ferramenta.

### Evidência adicional encontrada no repositório oficial (2026-11-21)

Foi feita leitura dos exemplos oficiais do repositório `MiniMax-AI/MiniMax-H3`, em especial:
- `scripts/readme/full-2k-i2va-reference-768p-result-by-directly-calling-open-platform-api.sh`
- `scripts/readme/full-2k-i2va-reference-2k-result-by-directly-calling-open-platform-api.sh`
- `README.md`

Os exemplos de chamada direta à Open Platform documentam parcialmente o contrato:
- criação: `POST $MINIMAX_API_BASE/v2/video_generation`;
- cabeçalho: `Authorization: Bearer $TOKEN` e `Content-Type: application/json`;
- modelo: `MiniMax-H3`;
- corpo ilustrativo: `content` com itens de texto/imagem, além de `resolution`, `duration` e `ratio`;
- resposta: extração de `.task_id`;
- consulta: `GET $MINIMAX_API_BASE/v2/query/video_generation/{task_id}`;
- resultado: consulta de `.task.status` e URL de saída em `.task.content.url`, seguida de download do MP4.

O README oficial aponta a documentação global para `https://platform.minimax.io/docs/api-reference/video-generation-v2-create` e a documentação CN para `https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create`. Os scripts usam `MINIMAX_API_BASE` e `TOKEN` como variáveis de ambiente, mas não definem neste trecho o host-base nem demonstram que o nome do secret GitHub `MINIMAX_API_KEY` já está mapeado para `TOKEN`.

**Conclusão:** endpoint relativo, padrão Bearer, criação, consulta e download estão evidenciados pelos exemplos oficiais. Permanecem pendentes a confirmação do host global/regional adequado à conta, o mapeamento seguro do secret, o contrato completo de erros/estados/limites, preços e disponibilidade regional. Os exemplos consultados são documentação de contrato, não teste executado contra a conta do projeto.

## 8. Critérios de aceite

- [ ] Character cards e scene cards aprovados.
- [ ] Seis clipes gerados e aprovados individualmente, sem inconsistências de identidade.
- [ ] S04 termina antes do combate e entrega controle ao ATB real.
- [ ] S05/S06 só são acionados após vitória confirmada e análise elegível.
- [ ] Forma felina final corresponde ao modelo 3D atual e não altera a identidade original de Tomas.
- [ ] Vídeos têm codec, dimensões, duração e checksum verificados.
- [ ] Manifesto versionado e rollback para revisão anterior testados.
- [ ] Fallback Three.js testado com rede indisponível, vídeo ausente ou erro de decodificação.
- [ ] API, licença, custos e retenção confirmados em documentação oficial.
- [ ] Nenhum secret no bundle, D1, logs ou histórico do Git.
- [ ] CI verde e validação visual real concluídas antes de qualquer merge/deploy.

## 9. Fora do escopo desta tarefa

- Implementar o combate ATB ou alterar o fluxo de batalha.
- Alterar `GameEngine`, `GameCanvas`, HUD ou persistência de saves.
- Integrar chamadas MiniMax no navegador ou Worker.
- Gerar ou publicar vídeos sem credencial, aprovação, revisão de termos e QC.
- Substituir ou remover a cinemática Three.js de T-221.


## 10. Estado operacional do acesso MiniMax

- Secret esperado: `MINIMAX_API_KEY`, cadastrado manualmente pelo responsável segundo confirmação no chat.
- Verificação independente do cadastro: pendente; a integração GitHub disponível não permite consultar valores/estado de secrets.
- Teste de autenticação: não executado.
- Geração e consumo de créditos: não autorizados nem executados.
- Próximo bloqueio: confirmar host global/regional, mapeamento seguro de `MINIMAX_API_KEY` para a variável de autenticação do exemplo, contrato completo de erros/estados/limites, preços e disponibilidade do H3 para a conta/região; depois implementar um workflow manual protegido, com aprovação explícita antes de qualquer operação faturável.
- Uma checagem que apenas confirme que o secret existe não prova que a chave é válida. Não registrar o valor nem mesmo parcialmente nos logs.
