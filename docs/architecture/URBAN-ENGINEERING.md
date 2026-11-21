# Matrix Real Estate & Urban Engineering — fundação (T-217/T-218)

Origem: planejamento aprovado por Tom em 2026-11-21 (análises do ChatGPT anexadas). Regras simplificadas e verificáveis, inspiradas em urbanismo e engenharia reais; **não substituem normas técnicas profissionais**.

## O que existe (código em `src/game/urban/`, puro e testado)
- `types.ts` — contratos: lotes, vias, utilidades, edificações, projetos, violações. Norte = −z; sol de inverno ao sul.
- `urbanPlanning.ts` — `evaluateProject`: rejeita ANTES da obra por propriedade, lote livre/protegido, zoneamento e uso, declive, solo × altura, recuos (testada), ocupação, distância mínima entre edificações, sobreposição de via/calçada, acesso viário, sombra sobre moradias (insolação), corredor de vista protegido, ligação de água/energia/esgoto e densidade por setor. Devolve todas as violações em ordem estável.
- `landRegistry.ts` — matrícula simulada: lotes sem sobreposição, transferência só com dono correto, preço válido e contrato único; ciclo `free → under_construction → built`; histórico.
- `developmentRoles.ts` — urbanista, arquiteto, engenheiros (civil/elétrico/hidráulico/segurança), mestre de obras, operários e inspetor, **mapeados sobre as 8 profissões existentes** (sem segunda sociedade). Inspetor nunca é engenheiro.
- `developmentDirector.ts` — `planHousingDevelopment`: déficit de moradia → lote municipal livre → modelo aprovado → validação do motor → equipe disponível. Determinístico, sem rede; registra cada candidato rejeitado.

## Limites atuais (não declarar como funcional no jogo)
Nada disso está ligado ao `GameEngine`, ao `worldBuilder`, à simulação da sociedade ou aos saves; não há lotes/vias reais do mapa, interiores navegáveis, ciclo de obra por etapas nem mercado. A IA generativa (Cowila) ainda não consome o diretor.

## Próximas etapas (ordem)
1. Ligar lotes/vias/utilidades ao mapa real (`worldBuilder`) e `LandRegistry` ao save. 2. `ConstructionLifecycle` (fundação → estrutura → pavimentos → inspeção, concluído só com tudo pronto) usando as tarefas da sociedade. 3. `BuildingInteriorRuntime` (portas, escadas, navegação interna; toda área liberada com rota). 4. `RealEstateMarket`/`PropertyRegistry`. 5. Cowila generativa propondo via `planHousingDevelopment`.
