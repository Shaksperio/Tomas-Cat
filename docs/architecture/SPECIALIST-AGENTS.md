# Agentes especialistas — missão planetária de Tomas

## Objetivo

Os agentes especialistas apoiam Tomas e Cowila na exploração, pesquisa e construção do novo mundo. Cada agente tem um domínio delimitado, ferramentas autorizadas e tarefas verificáveis. Os perfis são uma adaptação própria para React, TypeScript e Three.js e para as profissões já presentes na simulação.

## O que está integrado

- Catálogo tipado dos oito papéis profissionais existentes.
- Princípios operacionais e lista de tarefas permitidas por profissão.
- Validação de propostas: identidade, tick, prioridade, setor, alvo, recursos, disponibilidade e ausência de trabalho duplicado.
- Orquestrador local determinístico que gera propostas para habitantes ociosos.
- Caminho de fallback sem provedor generativo, rede ou aleatoriedade.

## Domínios de especialidade

| Perfil atual | Papel na missão planetária | Possíveis tarefas futuras |
|---|---|---|
| Engenheiro comunitário | Engenharia de bases, módulos, rotas e infraestrutura | Levantamento, projeto, preparação e reparo |
| Operário de construção | Execução física de obras aprovadas | Coleta, transporte, preparação e construção |
| Guardião comunitário | Segurança operacional e investigação de incidentes | Patrulha, inspeção e mediação |
| Agricultor | Produção de alimento em ambientes controlados | Preparar cultivo, plantar, monitorar e colher |
| Lenhador | Gestão de biomassa e materiais renováveis, quando existentes | Coleta sustentável e reposição |
| Minerador | Extração de minerais em locais liberados | Inspecionar depósito, extrair e transportar |
| Carpinteiro | Fabricação de componentes a partir de insumos disponíveis | Processar materiais e fabricar peças |
| Comerciante | Logística e equilíbrio de estoques | Transferir, trocar e distribuir suprimentos |

Essas descrições adaptam papéis existentes; não significam que mineração planetária, terraformação, agricultura em solo alienígena ou logística interbases já estejam implementadas.

## Limites de segurança

Os especialistas não recebem ferramentas arbitrárias, não executam código, não alteram geometria, não teleportam habitantes, não concedem recursos e não editam saves. Uma proposta aceita significa apenas que passou pelas políticas locais; ela ainda precisa ser encaminhada a um controlador autorizado para atribuição, consumo atômico de recursos e emissão de eventos.

Cowila coordena a missão, mas não é um executor irrestrito. A IA generativa pode sugerir prioridades e planos com base em dados disponíveis; não pode inventar leituras de sensores, resultados laboratoriais ou conclusões de obras. O runtime determinístico permanece como autoridade operacional.

## Próximas integrações

1. Definir contratos de observação para sensores, sondas e amostras.
2. Criar inventário de recursos da nave separado dos recursos do planeta, com origem e rastreabilidade.
3. Modelar projetos de pesquisa com hipótese, amostras, requisitos, duração e resultado verificável.
4. Adaptar os projetos de construção existentes para bases e módulos planetários sem quebrar saves ou IDs.
5. Acrescentar perfis de geologia, análise atmosférica, ecologia e manutenção da nave somente quando houver contratos e tarefas testadas.
6. Conectar propostas ao ciclo de tarefas por API transacional, preservando dependências, reservas e idempotência.

Nenhuma chamada generativa deve ocorrer por frame.
