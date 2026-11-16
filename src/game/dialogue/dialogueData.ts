import type { DialogueNode } from './types';

/** Falas escritas à mão; não há geração de texto por IA durante a execução. */
const residents = [
  { id: 'engineer-01', name: 'Íris', greeting: 'Se cada um reparar um pouco da cidade, ainda podemos reconstruí-la.', weather: 'O tempo muda depressa. Reforce o abrigo antes da próxima tempestade.', task: 'Pode verificar os materiais perto da oficina? Precisamos organizar a reconstrução.', low: 'Está difícil manter a esperança, mas não vou abandonar este lugar.', injured: 'Está difícil manter a esperança, mas não vou abandonar este lugar.', night: 'Cuide dessa ferida antes de voltar a explorar. A cidade precisa de você inteiro.', territory: 'À noite, mantenho uma luz acesa perto da oficina para orientar quem está perdido.', familiar: 'Conquistar um território abre espaço para reconstruir, mas também exige vigilância.', acid: 'Lembro de você. É bom quando alguém volta para conversar.' },
  { id: 'worker-01', name: 'Tico', greeting: 'Ei! Bom ver alguém circulando por aqui.', weather: 'Com essa chuva, o chão fica traiçoeiro. Vá com cuidado.', task: 'Se encontrar madeira aproveitável, traga para o depósito comunitário.', low: 'Hoje o trabalho parece não acabar. Uma conversa já ajuda.', injured: 'Hoje o trabalho parece não acabar. Uma conversa já ajuda.', night: 'Se estiver machucado, procure um abrigo e recupere as forças antes de carregar materiais.', territory: 'À noite o bairro fica silencioso, mas ainda há gente trabalhando em turnos.', familiar: 'Com um território a mais, podemos transportar materiais com mais segurança.', acid: 'Claro que lembro! Você já faz parte da rotina daqui.' },
  { id: 'worker-02', name: 'Nina', greeting: 'Olá! Sempre aparece alguma coisa para consertar por aqui.', weather: 'Esse vento está gelado. Procure um canto protegido.', task: 'Dê uma olhada nas tábuas do abrigo quando puder.', low: 'A comunidade está cansada. Precisamos nos apoiar.', injured: 'A comunidade está cansada. Precisamos nos apoiar.', night: 'Não force o passo se estiver ferido. Uma pausa agora evita problemas depois.', territory: 'Quando anoitece, organizo as ferramentas para ninguém tropeçar no escuro.', familiar: 'Território conquistado também significa mais responsabilidade com quem mora nele.', acid: 'Lembro sim. É bom ver que você continua por perto.' },
  { id: 'agent-01', name: 'Bento', greeting: 'Estou de olho nas ruas. Por enquanto, parece tudo tranquilo.', weather: 'O clima está ruim para patrulhar. Fique atento às áreas abertas.', task: 'Pode observar o caminho ao norte e me contar se notar algo estranho?', low: 'A ronda tem sido pesada. Não custa admitir quando precisamos descansar.', injured: 'A ronda tem sido pesada. Não custa admitir quando precisamos descansar.', night: 'Se está ferido, evite patrulhar sozinho. Vou ficar de olho nas ruas próximas.', territory: 'À noite redobro a atenção nas entradas do bairro.', familiar: 'Agora que avançamos, precisamos patrulhar as novas rotas sem deixar a comunidade desprotegida.', acid: 'Você voltou. Isso facilita meu trabalho de conhecer quem circula por aqui.' },
  { id: 'farmer-01', name: 'Amora', greeting: 'Oi! As plantas estão resistindo, apesar de tudo.', weather: 'A chuva ajuda a plantação, mas a chuva ácida pode estragar tudo.', task: 'Veja se há água limpa disponível para a próxima colheita.', low: 'Sem alimento suficiente, todo mundo sente. Vamos cuidar da horta.', injured: 'Sem alimento suficiente, todo mundo sente. Vamos cuidar da horta.', night: 'Descanse e se recupere antes de ajudar na plantação. Saúde também é recurso.', territory: 'À noite verifico se as plantas estão protegidas do frio.', familiar: 'Com o novo território, talvez possamos ampliar a horta quando houver água suficiente.', acid: 'Lembro de você! A horta fica mais animada com visitas.' },
  { id: 'lumberjack-01', name: 'Cedro', greeting: 'Dia bom para separar madeira que ainda pode ser usada.', weather: 'Com o vento assim, evite ficar perto das árvores mais altas.', task: 'Procure madeira caída, sem derrubar o que ainda está saudável.', low: 'Até quem trabalha com madeira precisa parar um pouco.', injured: 'Até quem trabalha com madeira precisa parar um pouco.', night: 'Não carregue madeira ferido. Espere se recuperar para evitar uma queda.', territory: 'À noite deixo os troncos organizados longe das passagens.', familiar: 'O território novo pode ter madeira útil, mas só devemos recolher o que já caiu.', acid: 'Lembro de você. Ainda estou separando madeira para os reparos.' },
  { id: 'miner-01', name: 'Brita', greeting: 'Está procurando pedra ou só dando uma volta?', weather: 'A chuva deixa as encostas escorregadias. Cuidado ao explorar.', task: 'Precisamos de pedra para reforçar as estruturas. Ajude quando puder.', low: 'O estoque está baixo e isso preocupa todo mundo.', injured: 'O estoque está baixo e isso preocupa todo mundo.', night: 'Se estiver ferido, não tente descer encostas ou carregar pedra agora.', territory: 'À noite evito a área de mineração sem iluminação adequada.', familiar: 'Com a área conquistada, podemos procurar pedra em locais antes inacessíveis.', acid: 'Você voltou! Ainda temos muito trabalho pela frente.' },
  { id: 'carpenter-01', name: 'Serafim', greeting: 'Uma boa peça de madeira pode salvar uma construção inteira.', weather: 'A umidade não ajuda a madeira. Guarde as tábuas em local seco.', task: 'Pode separar algumas tábuas para os reparos do abrigo?', low: 'As ferramentas estão gastas e o serviço acumulou.', injured: 'As ferramentas estão gastas e o serviço acumulou.', night: 'Primeiro cuide da saúde. Não quero que você se machuque tentando ajudar nos reparos.', territory: 'À noite guardo as ferramentas para que ninguém se corte no escuro.', familiar: 'O território conquistado pode fornecer materiais, mas precisamos avaliar a qualidade antes de construir.', acid: 'Lembro de você. A oficina está sempre aberta para uma conversa.' },
  { id: 'merchant-01', name: 'Mercê', greeting: 'Chegue mais! Sempre tento conseguir algo útil para a comunidade.', weather: 'Em dias assim, mantenha seus mantimentos protegidos.', task: 'Dê uma olhada no depósito. Posso negociar quando houver excedente.', low: 'Até uma mercadora fica preocupada quando as moedas rareiam.', injured: 'Até uma mercadora fica preocupada quando as moedas rareiam.', night: 'Não se arrisque ferido por causa de uma troca. Podemos negociar depois.', territory: 'À noite fecho o depósito e mantenho apenas uma pequena luz na entrada.', familiar: 'Com mais território, as rotas comerciais podem crescer, desde que estejam seguras.', acid: 'É você de novo! Já conheço esse jeito de chegar perto do balcão.' },
] as const;

export const DIALOGUE_DATA: DialogueNode[] = residents.flatMap((resident): DialogueNode[] => [
  {
    id: `${resident.id}.greeting`, agentId: resident.id, speaker: resident.name, trigger: 'greeting',
    text: resident.greeting,
    options: [
      { id: 'ask_weather', text: 'Como está o tempo?', nextNodeId: `${resident.id}.weather`, effects: [{ kind: 'affinity', amount: 1 }] },
      { id: 'ask_task', text: 'Precisa de ajuda?', nextNodeId: `${resident.id}.task` },
      { id: 'say_goodbye', text: 'Até mais.', effects: [{ kind: 'set_flag', flagId: `met:${resident.id}`, value: true }] },
      { id: 'ask_injury', text: 'Estou ferido. Algum conselho?', nextNodeId: `${resident.id}.injured`, conditions: [{ kind: 'player_injured', belowRatio: 0.65 }] },
      { id: 'ask_night', text: 'Como fica o bairro à noite?', nextNodeId: `${resident.id}.night`, conditions: [{ kind: 'night' }] },
      { id: 'ask_territory', text: 'O que muda com o território conquistado?', nextNodeId: `${resident.id}.territory`, conditions: [{ kind: 'territory_controlled' }] },
      { id: 'ask_familiar', text: 'Já nos conhecemos, não é?', nextNodeId: `${resident.id}.familiar`, conditions: [{ kind: 'flag', flagId: `met:${resident.id}`, value: true }] },
      { id: 'ask_weather_alert', text: 'A chuva ácida preocupa você?', nextNodeId: `${resident.id}.weather_alert`, conditions: [{ kind: 'weather_is', value: 'acid_rain' }] },
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
  {
    id: `${resident.id}.injured`, agentId: resident.id, speaker: resident.name, trigger: 'ambient',
    text: resident.injured,
    options: [{ id: 'injury_thanks', text: 'Vou me cuidar.', effects: [{ kind: 'trust', amount: 1 }] }],
  },
  {
    id: `${resident.id}.night`, agentId: resident.id, speaker: resident.name, trigger: 'ambient',
    text: resident.night,
    options: [{ id: 'night_thanks', text: 'Obrigado pelo aviso.', effects: [{ kind: 'affinity', amount: 1 }] }],
  },
  {
    id: `${resident.id}.territory`, agentId: resident.id, speaker: resident.name, trigger: 'ambient',
    text: resident.territory,
    options: [{ id: 'territory_thanks', text: 'Vamos cuidar da comunidade.', effects: [{ kind: 'trust', amount: 1 }] }],
  },
  {
    id: `${resident.id}.familiar`, agentId: resident.id, speaker: resident.name, trigger: 'ambient',
    text: resident.familiar,
    options: [{ id: 'familiar_thanks', text: 'Também é bom falar com você.', effects: [{ kind: 'affinity', amount: 1 }] }],
  },
  {
    id: `${resident.id}.weather_alert`, agentId: resident.id, speaker: resident.name, trigger: 'ambient',
    text: resident.acid,
    options: [{ id: 'weather_alert_thanks', text: 'Vou procurar abrigo.', effects: [{ kind: 'trust', amount: 1 }] }],
  },
]);

export const DIALOGUE_RESIDENT_IDS = residents.map((resident) => resident.id);
