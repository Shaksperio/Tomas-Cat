# Arquitetura da realidade simulada — Tomas Vagabundo

## Diretriz do produto

Tomas Vagabundo deve funcionar como uma realidade simulada coerente, com habitantes e sistemas que continuam tendo uma vida operacional mesmo quando o jogador não está observando. A expressão “mundo virtual” descreve essa ambição de simulação; não significa reproduzir obras de terceiros, seus personagens, estética, símbolos ou narrativa.

O jogador é um participante da realidade, não o centro que liga e desliga todos os acontecimentos.

## Camadas do mundo

1. **Física e território:** regiões, setores, clima, ciclo do dia, recursos, fauna, estruturas, rotas e portais.
2. **Sociedade:** habitantes com identidade, profissão, necessidades, rotinas, tarefas, relações e histórico de eventos.
3. **Economia:** produção, consumo, estoques, transporte, comércio, salários e escassez.
4. **Governança:** regras verificáveis, proteção, mediação, investigação, sanções proporcionais e possibilidade de reintegração.
5. **Memória e persistência:** eventos idempotentes, snapshots versionados, histórico de mudanças e recuperação após desconexão.
6. **Percepção e interação:** o jogador vê apenas o que está ao alcance de seus sentidos, instrumentos, relações e descobertas; a interface não deve revelar automaticamente todo o estado interno do mundo.

## Isolamento entre mundos

Cada worldId deve possuir relógio, sociedade, recursos, eventos, construções e estado persistente próprios. Uma transição por portal muda o contexto ativo sem fundir estados de mundos diferentes. Dados compartilhados entre mundos devem ser explicitamente modelados (por exemplo, identidade do jogador ou regras globais), nunca compartilhados por acidente.

## Autonomia sem jogador

A simulação deve ter dois níveis de detalhe:

- **Região próxima:** atualização detalhada, adequada à interação e à cena 3D.
- **Regiões distantes:** atualização abstrata, determinística e limitada, preservando produção, consumo, deslocamentos e eventos relevantes sem simular cada frame.

O avanço do mundo precisa usar tempo lógico e limites de recuperação para evitar saltos ilimitados depois de longos períodos offline. A política de tempo offline, limites e resolução de conflitos deverá ser definida antes da persistência autoritativa.

## Autoridade e IA

- Cowila e agentes especializados podem observar, analisar e propor.
- Contratos TypeScript validam identidade, permissões, recursos, localização, dependências e limites.
- O controlador autoritativo confirma transições e emite eventos.
- O cliente 3D apenas apresenta o estado recebido; não é autoridade para inventário, recursos, construção ou punições.
- Conteúdo executável, geometria arbitrária e mutações livres não podem ser fornecidos por agentes.

## Estado implementado nesta etapa

src/game/society/worldSocietyRegistry.ts cria uma simulação determinística independente por mundo registrado e permite avançar um mundo ou todos explicitamente. Testes garantem isolamento entre ticks, agentes, tarefas, relações e recursos.

## Limitações atuais

O registro é local e em memória. Ainda não existe:

- persistência por mundo ou recuperação de snapshots;
- simulação em background quando o jogador fecha o jogo;
- integração do registro com GameEngine e WorldSceneManager;
- aplicação de ConstructionProject real aos assets da cena;
- backend autoritativo, multiplayer ou coordenação compartilhada entre servidores;
- percepção/sensores do jogador ou revelação gradual do estado do mundo.

Essas limitações são deliberadas e devem ser resolvidas em etapas testáveis, sem declarar autonomia ou persistência antes de sua implementação.