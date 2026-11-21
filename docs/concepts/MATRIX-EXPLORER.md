# Matrix Explorer — registro de concepção

| | |
|---|---|
| **Concepção e direção** | Tom (Antonio), GitHub `Shaksperio` — conforme declarado por ele |
| **Data do registro** | 2026-11-21 |
| **Estado** | Conceito registrado. **Nenhuma implementação existe.** Fora do roteiro da seção 5 do `AGENTS.md` (o autor decide se e quando entra). |
| **Origem** | Conversas de Tom com assistentes de IA (ChatGPT/Codex e Claude) sobre fazer IAs explorarem e testarem o mundo de Tomas Vagabundo e outros ambientes virtuais. |

## Ideia, nas palavras do autor
Em vez de depender apenas de código, descrições e imagens enviadas por pessoas, IAs poderiam **explorar ambientes virtuais, observar acontecimentos, executar tarefas e produzir evidências**. A Cowila supervisiona; agentes exploradores executam; o resultado são relatórios verificáveis.

Trilha imaginada pelo autor: **Tomas Vagabundo** (primeiro mundo e laboratório de testes) → **Matrix Explorer** (tecnologia de percepção, exploração e interação) → possível **Matrix Platform** (conectar outros jogos e agentes). A parte comercial é só hipótese do autor; não há mercado validado.

## Conceito técnico (rascunho)
Uma interface comum entre um ambiente virtual e um agente de IA, em três partes:
1. **Observação:** estado estruturado do mundo (entidades, itens, posições, interativos, HUD) e capturas de tela, de forma reproduzível.
2. **Ação:** comandos discretos e validados (mover, interagir, abrir loja, iniciar batalha), nunca controle por quadro nem mutação livre do estado.
3. **Evidência:** relatório por execução com ID, semente, passos, imagens, achados (defeito, objeto fora do lugar, texto cortado) e resultado, para que outra pessoa ou IA possa reproduzir.

Princípios herdados do projeto: determinismo onde possível, a IA só propõe e regras validam, falha degradável, transparência sobre limites e nenhuma afirmação de sucesso sem prova.

## Protótipo conceitual já existente (não é o produto)
`scripts/battle-render-check/` roda o `GameEngine` real num Chromium headless, com o laço de renderização verdadeiro, e verifica a batalha do início ao fim. Foi feito para a correção da tela branca (T-216) e mostra a ideia em escala mínima: observar, agir e coletar evidência. Limites: renderização por software (SwiftShader), sem medir desempenho nem toque em dispositivo real.

## Primeiro marco proposto
Passeio automatizado pelo Tomas: inventário gerado do código (itens, lojas, pickups, habitantes, prédios, abrigos, terminais), foto de cada elemento no motor real em vários horários e relatório de achados. Critério de sucesso: encontrar defeitos reais que o autor ainda não tinha visto. Se não encontrar, isso também é resultado.

## O que este registro NÃO faz
- Não é registro legal de propriedade intelectual, patente ou marca, e não garante exclusividade nem originalidade absoluta: agentes de IA para jogos e testes automatizados já existem. O diferencial precisaria ser demonstrado por resultados.
- Não define a titularidade do código escrito por IAs ou por terceiros; isso depende da lei aplicável e de licença explícita. O repositório não declara uma licença neste momento.
- Não cria compromisso de implementação nem altera o roteiro fixo.

## Para fortalecer a autoria (decisão do autor)
Manter este arquivo e o histórico do Git; decidir a licença do repositório; guardar as conversas de origem; consultar um profissional de propriedade intelectual no Brasil sobre autoria, marca e eventual registro.
