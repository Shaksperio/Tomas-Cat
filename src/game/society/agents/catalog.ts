/**
 * Catálogo de especialistas da sociedade de Tomas Vagabundo.
 *
 * A estrutura adapta papéis e princípios de organização multiagente do projeto
 * agency-agents (MIT), sem importar prompts executáveis nem acoplar o jogo a
 * Unity/Godot. Estes são perfis de domínio do mundo do jogo.
 *
 * Fonte de inspiração: https://github.com/msitarzewski/agency-agents
 * Licença da fonte: MIT. Esta adaptação é original e permanece integrada ao
 * código do Tomas; consulte a licença do projeto de origem para redistribuição.
 */
import type { AgentProfession, AgentTask } from '../contracts';

export interface SpecialistProfile {
  id: string;
  title: string;
  profession: AgentProfession;
  mission: string;
  operatingPrinciples: readonly string[];
  allowedTasks: readonly AgentTask['kind'][];
  priority: number;
}

export const SPECIALIST_PROFILES: readonly SpecialistProfile[] = [
  {
    id: 'community-engineer',
    title: 'Engenheiro comunitário',
    profession: 'engineer',
    mission: 'Explorar territórios, desenhar bairros, planejar a expansão da cidade e propor novos cenários com módulos aprovados.',
    operatingPrinciples: ['usar apenas módulos aprovados', 'propor novos cenários e distritos', 'respeitar orçamento, setor e limites do mundo', 'priorizar infraestrutura coletiva'],
    allowedTasks: ['survey_site', 'design_project', 'prepare_site', 'repair_structure'],
    priority: 90,
  },
  {
    id: 'construction-worker',
    title: 'Operário de construção',
    profession: 'worker',
    mission: 'Construir cenários, ampliar bairros, abrir caminhos e executar obras aprovadas.',
    operatingPrinciples: ['executar somente projetos aprovados pela Cowila e pelo motor', 'respeitar dependências e reservas', 'interromper trabalho diante de perigo'],
    allowedTasks: ['gather_materials', 'transport_materials', 'prepare_site', 'build_module', 'repair_structure'],
    priority: 80,
  },
  {
    id: 'community-warden',
    title: 'Guardião comunitário',
    profession: 'agent',
    mission: 'Patrulhar, investigar acontecimentos e mediar conflitos.',
    operatingPrinciples: ['usar mediação antes de escalar conflitos', 'não punir sem regra explícita', 'registrar motivos das decisões'],
    allowedTasks: ['patrol_area', 'investigate_event', 'mediate_conflict'],
    priority: 85,
  },
  {
    id: 'farmer',
    title: 'Agricultor',
    profession: 'farmer',
    mission: 'Manter a produção de alimentos e a segurança do abastecimento.',
    operatingPrinciples: ['priorizar alimento quando o estoque estiver baixo', 'não consumir sementes ou reservas não autorizadas'],
    allowedTasks: ['cultivate_field', 'harvest_food'],
    priority: 95,
  },
  {
    id: 'forester',
    title: 'Lenhador',
    profession: 'lumberjack',
    mission: 'Produzir madeira respeitando reservas ecológicas e necessidades de construção.',
    operatingPrinciples: ['respeitar limites de coleta', 'priorizar reservas comunitárias'],
    allowedTasks: ['chop_wood'],
    priority: 65,
  },
  {
    id: 'miner',
    title: 'Minerador',
    profession: 'miner',
    mission: 'Fornecer pedra e minerais para projetos aprovados.',
    operatingPrinciples: ['não exceder capacidade de armazenamento', 'não explorar áreas bloqueadas'],
    allowedTasks: ['mine_stone'],
    priority: 60,
  },
  {
    id: 'carpenter',
    title: 'Carpinteiro',
    profession: 'carpenter',
    mission: 'Transformar madeira excedente em peças úteis para a comunidade.',
    operatingPrinciples: ['preservar reservas destinadas à construção', 'produzir apenas com insumos disponíveis'],
    allowedTasks: ['craft_planks'],
    priority: 55,
  },
  {
    id: 'merchant',
    title: 'Comerciante',
    profession: 'merchant',
    mission: 'Equilibrar estoques e facilitar trocas sem comprometer reservas essenciais.',
    operatingPrinciples: ['priorizar alimentos em escassez', 'respeitar limites de estoque e preços do simulador'],
    allowedTasks: ['trade_goods'],
    priority: 75,
  },
] as const;

export function getSpecialistProfile(profession: AgentProfession): SpecialistProfile | undefined {
  return SPECIALIST_PROFILES.find((profile) => profile.profession === profession);
}
