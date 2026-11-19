import type { AgentProfession, AgentTask } from '../../contracts';
import type { SocietySimulationSnapshot } from '../../simulation';

export interface SkillStep {
  id: string;
  taskKind: AgentTask['kind'];
  purpose: string;
}

export interface SocietySkill {
  id: string;
  name: string;
  description: string;
  profession: AgentProfession;
  version: number;
  whenToUse: readonly string[];
  procedure: readonly SkillStep[];
  pitfalls: readonly string[];
  verification: readonly string[];
  allowedTaskKinds: readonly AgentTask['kind'][];
  toolset: string;
}

type Trigger = (snapshot: SocietySimulationSnapshot) => boolean;

interface SkillDefinition extends SocietySkill {
  matches: Trigger;
}

const skill = (
  definition: SkillDefinition,
): SkillDefinition => definition;

export const SOCIETY_SKILLS: readonly SkillDefinition[] = [
  skill({
    id: 'engineer.survey-and-design', name: 'Levantamento e projeto', description: 'Avalia terreno e planeja infraestrutura.',
    profession: 'engineer', version: 1, whenToUse: ['engenheiro ocioso', 'novo projeto ou expansão'],
    procedure: [
      { id: 'survey', taskKind: 'survey_site', purpose: 'Inspecionar terreno e restrições.' },
      { id: 'design', taskKind: 'design_project', purpose: 'Desenhar projeto usando módulos aprovados.' },
      { id: 'prepare', taskKind: 'prepare_site', purpose: 'Preparar o local após aprovação.' },
    ],
    pitfalls: ['Não projetar fora do setor autorizado.', 'Não iniciar obra sem recursos e módulo aprovado.'],
    verification: ['Projeto validado pelo contrato.', 'IDs de tarefas únicos e dependências resolvidas.'],
    allowedTaskKinds: ['survey_site', 'design_project', 'prepare_site', 'repair_structure'],
    toolset: 'construction-planning',
    matches: (s) => s.agents.some((a) => a.profession === 'engineer' && a.status === 'idle'),
  }),
  skill({
    id: 'worker.construction-execution', name: 'Execução de construção', description: 'Coleta e executa etapas de obras aprovadas.',
    profession: 'worker', version: 1, whenToUse: ['operário ocioso', 'obra validada aguardando execução'],
    procedure: [
      { id: 'gather', taskKind: 'gather_materials', purpose: 'Reunir materiais reservados.' },
      { id: 'transport', taskKind: 'transport_materials', purpose: 'Transportar materiais ao canteiro.' },
      { id: 'build', taskKind: 'build_module', purpose: 'Construir somente módulo aprovado.' },
    ],
    pitfalls: ['Respeitar reservas e dependências da obra.', 'Não duplicar tarefas de projeto.'],
    verification: ['Materiais disponíveis.', 'Dependências concluídas antes da construção.'],
    allowedTaskKinds: ['gather_materials', 'transport_materials', 'prepare_site', 'build_module', 'repair_structure'],
    toolset: 'construction-execution',
    matches: (s) => s.agents.some((a) => a.profession === 'worker' && a.status === 'idle'),
  }),
  skill({
    id: 'agent.security-and-mediation', name: 'Segurança e mediação', description: 'Patrulha e investiga incidentes comunitários.',
    profession: 'agent', version: 1, whenToUse: ['guardião ocioso', 'incidente ou conflito detectado'],
    procedure: [
      { id: 'patrol', taskKind: 'patrol_area', purpose: 'Patrulhar setor autorizado.' },
      { id: 'investigate', taskKind: 'investigate_event', purpose: 'Investigar evento registrado.' },
      { id: 'mediate', taskKind: 'mediate_conflict', purpose: 'Medir conflito sem sanção arbitrária.' },
    ],
    pitfalls: ['Não punir sem evidência verificada.', 'Mediação precede escalonamento.'],
    verification: ['Incidente possui evidência e identidade rastreável.'],
    allowedTaskKinds: ['patrol_area', 'investigate_event', 'mediate_conflict'],
    toolset: 'security-mediation',
    matches: (s) => s.agents.some((a) => a.profession === 'agent' && a.status === 'idle'),
  }),
  skill({
    id: 'farmer.food-security', name: 'Segurança alimentar', description: 'Mantém cultivo e abastecimento de alimentos.',
    profession: 'farmer', version: 1, whenToUse: ['estoque de comida baixo', 'agricultor ocioso'],
    procedure: [
      { id: 'harvest', taskKind: 'harvest_food', purpose: 'Colher quando houver produção madura.' },
      { id: 'cultivate', taskKind: 'cultivate_field', purpose: 'Manter produção contínua.' },
    ],
    pitfalls: ['Não consumir sementes reservadas.', 'Não colher sem produção disponível.'],
    verification: ['Estoque e produção atualizados pelo simulador.'],
    allowedTaskKinds: ['cultivate_field', 'harvest_food'],
    toolset: 'production',
    matches: (s) => s.resources.food < 20 && s.agents.some((a) => a.profession === 'farmer' && a.status === 'idle'),
  }),
  skill({
    id: 'lumberjack.sustainable-forestry', name: 'Manejo florestal', description: 'Produz madeira respeitando reservas ecológicas.',
    profession: 'lumberjack', version: 1, whenToUse: ['estoque de madeira baixo', 'lenhador ocioso'],
    procedure: [{ id: 'chop', taskKind: 'chop_wood', purpose: 'Coletar madeira dentro dos limites.' }],
    pitfalls: ['Preservar reservas ecológicas e materiais comprometidos.'],
    verification: ['Coleta não ultrapassa capacidade de armazenamento.'],
    allowedTaskKinds: ['chop_wood'], toolset: 'production',
    matches: (s) => s.resources.wood < 40 && s.agents.some((a) => a.profession === 'lumberjack' && a.status === 'idle'),
  }),
  skill({
    id: 'miner.resource-extraction', name: 'Extração mineral', description: 'Fornece pedra para projetos autorizados.',
    profession: 'miner', version: 1, whenToUse: ['estoque de pedra baixo', 'minerador ocioso'],
    procedure: [{ id: 'mine', taskKind: 'mine_stone', purpose: 'Extrair pedra em área permitida.' }],
    pitfalls: ['Não explorar áreas bloqueadas.', 'Respeitar capacidade de armazenamento.'],
    verification: ['Estoque atualizado e sem exceder capacidade.'],
    allowedTaskKinds: ['mine_stone'], toolset: 'production',
    matches: (s) => s.resources.stone < 40 && s.agents.some((a) => a.profession === 'miner' && a.status === 'idle'),
  }),
  skill({
    id: 'carpenter.material-processing', name: 'Processamento de materiais', description: 'Transforma madeira em peças para construção.',
    profession: 'carpenter', version: 1, whenToUse: ['estoque de tábuas baixo', 'carpinteiro ocioso'],
    procedure: [{ id: 'craft', taskKind: 'craft_planks', purpose: 'Produzir tábuas com madeira excedente.' }],
    pitfalls: ['Preservar madeira reservada para construção.'],
    verification: ['Insumos disponíveis antes do processamento.'],
    allowedTaskKinds: ['craft_planks'], toolset: 'production',
    matches: (s) => s.resources.planks < 30 && s.resources.wood > 4 && s.agents.some((a) => a.profession === 'carpenter' && a.status === 'idle'),
  }),
  skill({
    id: 'merchant.community-economy', name: 'Economia comunitária', description: 'Equilibra estoques e trocas essenciais.',
    profession: 'merchant', version: 1, whenToUse: ['estoque excedente ou escassez', 'comerciante ocioso'],
    procedure: [{ id: 'trade', taskKind: 'trade_goods', purpose: 'Negociar sem comprometer reservas essenciais.' }],
    pitfalls: ['Não vender abaixo das reservas-alvo.', 'Priorizar alimento em escassez.'],
    verification: ['Troca respeita preço, estoque e limites do simulador.'],
    allowedTaskKinds: ['trade_goods'], toolset: 'economy',
    matches: (s) => s.agents.some((a) => a.profession === 'merchant' && a.status === 'idle'),
  }),
];

export function listSocietySkills(): readonly SocietySkill[] {
  return SOCIETY_SKILLS.map(({ matches: _matches, ...publicSkill }) => publicSkill);
}

export function getSocietySkill(skillId: string): SocietySkill | undefined {
  const found = SOCIETY_SKILLS.find((entry) => entry.id === skillId);
  if (!found) return undefined;
  const { matches: _matches, ...publicSkill } = found;
  return publicSkill;
}

export function selectSkillForAgent(
  profession: AgentProfession,
  snapshot: SocietySimulationSnapshot,
): SocietySkill | undefined {
  const selected = SOCIETY_SKILLS.find((entry) => entry.profession === profession && entry.matches(snapshot));
  if (!selected) return undefined;
  const { matches: _matches, ...publicSkill } = selected;
  return publicSkill;
}
