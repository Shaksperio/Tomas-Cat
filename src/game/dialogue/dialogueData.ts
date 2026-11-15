import type { DialogueNode } from './types';

/** Falas escritas à mão; não há geração de texto por IA durante a execução. */
const residents = [
  { id: 'engineer-01', name: 'Íris', greeting: 'Se cada um reparar um pouco da cidade, ainda podemos reconstruí-la.', weather: 'O tempo muda depressa. Reforce o abrigo antes da próxima tempestade.', task: 'Pode verificar os materiais perto da oficina? Precisamos organizar a reconstrução.', low: 'Está difícil manter a esperança, mas não vou abandonar este lugar.' },
  { id: 'worker-01', name: 'Tico', greeting: 'Ei! Bom ver alguém circulando por aqui.', weather: 'Com essa chuva, o chão fica traiçoeiro. Vá com cuidado.', task: 'Se encontrar madeira aproveitável, traga para o depósito comunitário.', low: 'Hoje o trabalho parece não acabar. Uma conversa já ajuda.' },
  { id: 'worker-02', name: 'Nina', greeting: 'Olá! Sempre aparece alguma coisa para consertar por aqui.', weather: 'Esse vento está gelado. Procure um canto protegido.', task: 'Dê uma olhada nas tábuas do abrigo quando puder.', low: 'A comunidade está cansada. Precisamos nos apoiar.' },
  { id: 'agent-01', name: 'Bento', greeting: 'Estou de olho nas ruas. Por enquanto, parece tudo tranquilo.', weather: 'O clima está ruim para patrulhar. Fique atento às áreas abertas.', task: 'Pode observar o caminho ao norte e me contar se notar algo estranho?', low: 'A ronda tem sido pesada. Não custa admitir quando precisamos descansar.' },
  { id: 'farmer-01', name: 'Amora', greeting: 'Oi! As plantas estão resistindo, apesar de tudo.', weather: 'A chuva ajuda a plantação, mas a chuva ácida pode estragar tudo.', task: 'Veja se há água limpa disponível para a próxima colheita.', low: 'Sem alimento suficiente, todo mundo sente. Vamos cuidar da horta.' },
  { id: 'lumberjack-01', name: 'Cedro', greeting: 'Dia bom para separar madeira que ainda pode ser usada.', weather: 'Com o vento assim, evite ficar perto das árvores mais altas.', task: 'Procure madeira caída, sem derrubar o que ainda está saudável.', low: 'Até quem trabalha com madeira precisa parar um pouco.' },
  { id: 'miner-01', name: 'Brita', greeting: 'Está procurando pedra ou só dando uma volta?', weather: 'A chuva deixa as encostas escorregadias. Cuidado ao explorar.', task: 'Precisamos de pedra para reforçar as estruturas. Ajude quando puder.', low: 'O estoque está baixo e isso preocupa todo mundo.' },
  { id: 'carpenter-01', name: 'Serafim', greeting: 'Uma boa peça de madeira pode salvar uma construção inteira.', weather: 'A umidade não ajuda a madeira. Guarde as tábuas em local seco.', task: 'Pode separar algumas tábuas para os reparos do abrigo?', low: 'As ferramentas estão gastas e o serviço acumulou.' },
  { id: 'merchant-01', name: 'Mercê', greeting: 'Chegue mais! Sempre tento conseguir algo útil para a comunidade.', weather: 'Em dias assim, mantenha seus mantimentos protegidos.', task: 'Dê uma olhada no depósito. Posso negociar quando houver excedente.', low: 'Até uma mercadora fica preocupada quando as moedas rareiam.' },
] as const;

export const DIALOGUE_DATA: DialogueNode[] = residents.flatMap((resident) => [
  {
    id: `${resident.id}.greeting`, agentId: resident.id, speaker: resident.name, trigger: 'greeting',
    text: resident.greeting,
    options: [
      { id: 'ask_weather', text: 'Como está o tempo?', nextNodeId: `${resident.id}.weather`, effects: [{ kind: 'affinity', amount: 1 }] },
      { id: 'ask_task', text: 'Precisa de ajuda?', nextNodeId: `${resident.id}.task` },
      { id: 'say_goodbye', text: 'Até mais.', effects: [{ kind: 'set_flag', flagId: `met:${resident.id}`, value: true }] },
    ],
  },
  {
    id: `${resident.id}.weather`, agentId: resident.id, speaker: resident.name, trigger: 'ambient',
    text: resident.weather,
    options: [{ id: 'weather_continue', text: 'Entendi. Obrigado.', effects: [{ kind: 'affinity', amount: 1 }] }],
  },
  {
    id: `${resident.id}.task`, agentId: resident.id, speaker: resident.name, trigger: 'ambient',
    text: resident.task,
    options: [
      { id: 'accept_task', text: 'Vou ajudar.', effects: [{ kind: 'open_task', taskId: `help:${resident.id}` }, { kind: 'set_flag', flagId: `task-offered:${resident.id}`, value: true }] },
      { id: 'decline_task', text: 'Talvez depois.', effects: [{ kind: 'affinity', amount: 1 }] },
    ],
  },
  {
    id: `${resident.id}.low_morale`, agentId: resident.id, speaker: resident.name, trigger: 'greeting',
    priority: 10, conditions: [{ kind: 'morale_below', value: 30 }],
    text: resident.low,
    options: [{ id: 'encourage', text: 'Vamos superar isso juntos.', effects: [{ kind: 'affinity', amount: 2 }, { kind: 'trust', amount: 1 }] }],
  },
]);

export const DIALOGUE_RESIDENT_IDS = residents.map((resident) => resident.id);
