import type { FlowConfig, FlowStep } from '../types/flow';
import { createId, createStep, createWebWidgetConfig, createWhatsappConfig } from './defaultFlow';

export type FlowTemplateSummary = {
  id: string;
  name: string;
  segment: string;
  description: string;
  channel: FlowConfig['channel'];
  config: FlowConfig;
};

function connect(source: FlowStep, target: FlowStep) {
  return { id: createId('edge'), source: source.id, target: target.id };
}

function baseConfig(title: string, channel: FlowConfig['channel']): Omit<FlowConfig, 'startStepId' | 'steps' | 'edges'> {
  return {
    title,
    responseName: createId('flow').replace(/-/g, '_'),
    execute: 'firstQuestion',
    model: 'gpt-4o',
    llmProvider: 'openai',
    channel,
    isMainFlow: true,
    webWidget: createWebWidgetConfig(),
    whatsapp: createWhatsappConfig(),
    turnHistoricMessages: 20,
  };
}

function createSupportWhatsappRagTemplate(): FlowConfig {
  const start = createStep('message', 0);
  start.title = 'Boas vindas';
  start.instruction = 'Ola! Sou o assistente de atendimento. Me conte o que voce precisa.';

  const input = createStep('input', 1);
  input.title = 'Pergunta do cliente';
  input.responseName = 'pergunta';
  input.instruction = 'Digite sua duvida.';

  const supervisor = createStep('component', 2, 'flowRouter');
  supervisor.position = { x: 590, y: 160 };
  supervisor.title = 'Supervisor de intencao';
  supervisor.instruction = 'Classifica a intencao e roteia para fluxos especializados quando existirem.';
  supervisor.component = {
    ...supervisor.component!,
    flowRouterReasonResponseName: 'supervisor',
    flowRouterRules: [
      {
        id: createId('rule'),
        label: 'Financeiro',
        targetAgentId: '',
        targetFlowId: '',
        conditionMode: 'llm',
        condition: 'Roteie se o usuario falar de boleto, pagamento, segunda via, cobranca ou financeiro.',
        conditionTemperature: 0,
      },
      {
        id: createId('rule'),
        label: 'Suporte tecnico',
        targetAgentId: '',
        targetFlowId: '',
        conditionMode: 'llm',
        condition: 'Roteie se o usuario relatar erro, falha tecnica, acesso, integracao ou instabilidade.',
        conditionTemperature: 0,
      },
    ],
  };

  const rag = createStep('component', 3, 'rag');
  rag.position = { x: 850, y: 160 };
  rag.title = 'Resposta com base de conhecimento';
  rag.component = {
    ...rag.component!,
    responseName: 'respostaRag',
    queryTemplate: '{{context.slots.pergunta}}',
    prompt: 'Responda em pt-BR de forma objetiva. Use a base de conhecimento quando houver documentos relevantes. Se faltar contexto, diga o que precisa confirmar.',
  };

  const end = createStep('end', 4);
  end.position = { x: 1110, y: 160 };
  end.title = 'Responder cliente';
  end.instruction = '{{context.slots.respostaRag.text}}';

  return {
    ...baseConfig('Atendimento WhatsApp com RAG e Supervisor', 'whatsapp'),
    startStepId: start.id,
    steps: [start, input, supervisor, rag, end],
    edges: [connect(start, input), connect(input, supervisor), connect(supervisor, rag), connect(rag, end)],
  };
}

function createSchedulingTemplate(): FlowConfig {
  const start = createStep('message', 0);
  start.title = 'Inicio do agendamento';
  start.instruction = 'Vamos agendar seu atendimento. Primeiro, informe seu CPF.';

  const cpf = createStep('input', 1);
  cpf.title = 'Coletar CPF';
  cpf.responseName = 'cpf';
  cpf.inputValidationMode = 'type';
  cpf.inputValidationType = 'cpf';
  cpf.inputValidationErrorMessage = 'CPF invalido. Informe novamente somente os numeros.';

  const consulta = createStep('component', 2, 'mcp');
  consulta.position = { x: 580, y: 180 };
  consulta.title = 'Consultar disponibilidade';
  consulta.component = {
    ...consulta.component!,
    responseName: 'agenda',
    mcpMode: 'api',
    mcpToolName: 'consultar_agenda',
    mcpToolDescription: 'Consulta disponibilidade de agenda por CPF.',
    mcpInstruction: 'Use o CPF do contexto para consultar disponibilidade. Normalize providers, services, dates e times.',
    mcpInputSchema: '{\n  "type": "object",\n  "properties": {\n    "cpf": { "type": "string" }\n  },\n  "required": ["cpf"]\n}',
    mcpOutputSchema: '{\n  "type": "object",\n  "properties": {\n    "providers": { "type": "array" },\n    "services": { "type": "array" },\n    "dates": { "type": "array" },\n    "times": { "type": "array" }\n  }\n}',
    mcpApiBaseUrl: '',
    mcpApiBodyJson: '{\n  "cpf": "{{context.slots.cpf}}"\n}',
  };

  const options = createStep('richMessage', 3);
  options.position = { x: 850, y: 180 };
  options.title = 'Escolher horario';
  options.richMessage = {
    ...options.richMessage!,
    type: 'appointmentFlow',
    text: 'Escolha uma opcao de agendamento.',
    appointmentFlow: {
      ...options.richMessage!.appointmentFlow!,
      mode: 'auto',
      providersTemplate: '{{context.slots.agenda.providers}}',
      servicesTemplate: '{{context.slots.agenda.services}}',
      datesTemplate: '{{context.slots.agenda.dates}}',
      timesTemplate: '{{context.slots.agenda.times}}',
    },
  };

  const end = createStep('end', 4);
  end.position = { x: 1110, y: 180 };
  end.title = 'Confirmacao';
  end.instruction = 'Perfeito. Registrei sua escolha e sigo com a confirmacao.';

  return {
    ...baseConfig('Agendamento assistido por WhatsApp Flow', 'whatsapp'),
    startStepId: start.id,
    steps: [start, cpf, consulta, options, end],
    edges: [connect(start, cpf), connect(cpf, consulta), connect(consulta, options), connect(options, end)],
  };
}

function createBackofficeTemplate(): FlowConfig {
  const cron = createStep('component', 0, 'cron');
  cron.title = 'Rotina programada';
  cron.position = { x: 120, y: 180 };
  cron.component = {
    ...cron.component!,
    cronEnabled: false,
    cronMode: 'daily',
    cronTime: '09:00',
    cronInputText: 'Executar rotina de backoffice',
  };

  const api = createStep('api', 1);
  api.title = 'Buscar dados operacionais';
  api.position = { x: 380, y: 180 };
  api.responseName = 'dadosOperacionais';

  const mongo = createStep('component', 2, 'mongodb');
  mongo.title = 'Registrar resultado';
  mongo.position = { x: 640, y: 180 };
  mongo.component = {
    ...mongo.component!,
    responseName: 'registro',
    mongoCollectionName: 'agentic_backoffice_runs',
    mongoOperation: 'insertOne',
    mongoDocument: '{\n  "runAt": "{{context.now}}",\n  "agentId": "{{context.agentId}}",\n  "dados": "{{context.slots.dadosOperacionais}}"\n}',
  };

  const dashboard = createStep('component', 3, 'dashboard');
  dashboard.title = 'Resumo operacional';
  dashboard.position = { x: 900, y: 180 };
  dashboard.component = {
    ...dashboard.component!,
    dashboardSource: 'trace',
    dashboardMode: 'summary',
    dashboardTitle: 'Resumo da rotina',
  };

  const end = createStep('end', 4);
  end.position = { x: 1160, y: 180 };
  end.instruction = 'Rotina executada. Veja o dashboard no trace.';

  return {
    ...baseConfig('Backoffice agentico com cron, API e Mongo', 'webWidget'),
    startStepId: cron.id,
    steps: [cron, api, mongo, dashboard, end],
    edges: [connect(cron, api), connect(api, mongo), connect(mongo, dashboard), connect(dashboard, end)],
  };
}

function createClinicTriageTemplate(): FlowConfig {
  const start = createStep('message', 0);
  start.title = 'Recepcao';
  start.instruction = 'Ola! Vou te ajudar com agendamento, exame, convenio ou remarcacao.';

  const input = createStep('input', 1);
  input.title = 'Solicitacao';
  input.responseName = 'solicitacao';
  input.instruction = 'Descreva o que voce precisa.';

  const classify = createStep('component', 2, 'mcp');
  classify.title = 'Classificar atendimento';
  classify.position = { x: 580, y: 180 };
  classify.component = {
    ...classify.component!,
    responseName: 'triagem',
    mcpMode: 'fields',
    mcpToolName: 'classificar_triagem_clinica',
    mcpToolDescription: 'Classifica demanda de clinica e extrai dados essenciais.',
    mcpInstruction: 'Classifique a solicitacao em agendamento, exame, convenio, remarcacao ou humano. Extraia especialidade, convenio e urgencia quando aparecerem.',
    mcpOutputSchema: '{\n  "type": "object",\n  "properties": {\n    "intencao": { "type": "string" },\n    "especialidade": { "type": "string" },\n    "convenio": { "type": "string" },\n    "urgente": { "type": "boolean" }\n  }\n}',
  };

  const agenda = createStep('component', 3, 'mcp');
  agenda.title = 'Consultar agenda';
  agenda.position = { x: 850, y: 180 };
  agenda.component = {
    ...agenda.component!,
    responseName: 'agenda',
    mcpMode: 'api',
    mcpToolName: 'consultar_agenda_clinica',
    mcpToolDescription: 'Consulta agenda no sistema da clinica.',
    mcpInstruction: 'Monte a consulta usando especialidade e convenio extraidos na triagem.',
    mcpApiMethod: 'POST',
    mcpApiBaseUrl: '',
    mcpApiBodyJson: '{\n  "especialidade": "{{context.slots.triagem.output.especialidade}}",\n  "convenio": "{{context.slots.triagem.output.convenio}}"\n}',
  };

  const approve = createStep('component', 4, 'approval');
  approve.title = 'Aprovar encaixe';
  approve.position = { x: 1120, y: 180 };
  approve.component = {
    ...approve.component!,
    responseName: 'aprovacaoEncaixe',
    approvalTitle: 'Aprovar encaixe de agenda',
    approvalDescription: 'A solicitacao parece urgente. Revise antes de oferecer encaixe fora da regra padrao.',
    approvalRisk: 'high',
    approvalScopes: ['agenda_write', 'exception'],
  };

  const end = createStep('end', 5);
  end.position = { x: 1390, y: 180 };
  end.instruction = 'Encontrei as melhores opcoes e vou seguir com a confirmacao.';

  return {
    ...baseConfig('Clinica: triagem e agendamento com aprovacao', 'whatsapp'),
    startStepId: start.id,
    steps: [start, input, classify, agenda, approve, end],
    edges: [connect(start, input), connect(input, classify), connect(classify, agenda), connect(agenda, approve), connect(approve, end)],
  };
}

function createEcommerceSupportTemplate(): FlowConfig {
  const start = createStep('message', 0);
  start.title = 'Atendimento loja';
  start.instruction = 'Ola! Posso ajudar com pedido, troca, rastreio ou produto.';

  const order = createStep('input', 1);
  order.title = 'Pedido ou duvida';
  order.responseName = 'pedido';
  order.instruction = 'Informe seu numero de pedido ou descreva sua duvida.';

  const lookup = createStep('component', 2, 'mcp');
  lookup.title = 'Consultar pedido';
  lookup.position = { x: 580, y: 180 };
  lookup.component = {
    ...lookup.component!,
    responseName: 'consultaPedido',
    mcpMode: 'api',
    mcpToolName: 'consultar_pedido',
    mcpToolDescription: 'Consulta dados de pedido, rastreio e status.',
    mcpInstruction: 'Use o texto do cliente para localizar pedido e status. Nunca invente codigo de rastreio.',
    mcpApiMethod: 'GET',
    mcpApiBaseUrl: '',
    mcpApiQueryJson: '{\n  "q": "{{context.slots.pedido}}"\n}',
  };

  const approveRefund = createStep('component', 3, 'approval');
  approveRefund.title = 'Aprovar reembolso';
  approveRefund.position = { x: 850, y: 180 };
  approveRefund.component = {
    ...approveRefund.component!,
    responseName: 'aprovacaoReembolso',
    approvalTitle: 'Aprovar reembolso ou cupom',
    approvalDescription: 'Antes de gerar cupom/reembolso, confira valor, politica e historico do cliente.',
    approvalRisk: 'high',
    approvalScopes: ['refund', 'coupon_write'],
  };

  const answer = createStep('component', 4, 'openaiGen');
  answer.title = 'Resposta final';
  answer.position = { x: 1120, y: 180 };
  answer.component = {
    ...answer.component!,
    responseName: 'resposta',
    prompt: 'Responda de forma clara usando context.slots.consultaPedido e o status da aprovacao quando existir.',
    queryTemplate: '{{context.slots.pedido}}',
  };

  const end = createStep('end', 5);
  end.position = { x: 1390, y: 180 };
  end.instruction = '{{context.slots.resposta.text}}';

  return {
    ...baseConfig('E-commerce: pedido, troca e reembolso seguro', 'whatsapp'),
    startStepId: start.id,
    steps: [start, order, lookup, approveRefund, answer, end],
    edges: [connect(start, order), connect(order, lookup), connect(lookup, approveRefund), connect(approveRefund, answer), connect(answer, end)],
  };
}

function createRealEstateLeadTemplate(): FlowConfig {
  const start = createStep('message', 0);
  start.title = 'Receber lead';
  start.instruction = 'Ola! Vou entender seu perfil para sugerir imoveis.';

  const input = createStep('input', 1);
  input.title = 'Perfil do cliente';
  input.responseName = 'perfil';
  input.instruction = 'Qual bairro, faixa de valor e tipo de imovel voce procura?';

  const context = createStep('component', 2, 'context');
  context.title = 'Normalizar perfil';
  context.position = { x: 580, y: 180 };
  context.component = {
    ...context.component!,
    responseName: 'lead',
    contextMode: 'llm',
    contextLlmPrompt: 'Extraia bairro, valorMaximo, quartos, tipo e urgencia do lead imobiliario.',
  };

  const search = createStep('component', 3, 'mcp');
  search.title = 'Buscar imoveis';
  search.position = { x: 850, y: 180 };
  search.component = {
    ...search.component!,
    responseName: 'imoveis',
    mcpMode: 'api',
    mcpToolName: 'buscar_imoveis',
    mcpToolDescription: 'Busca imoveis no CRM/imobiliaria.',
    mcpApiMethod: 'POST',
    mcpApiBaseUrl: '',
    mcpApiBodyJson: '{\n  "bairro": "{{context.slots.lead.bairro}}",\n  "valorMaximo": "{{context.slots.lead.valorMaximo}}",\n  "quartos": "{{context.slots.lead.quartos}}"\n}',
  };

  const end = createStep('end', 4);
  end.position = { x: 1120, y: 180 };
  end.instruction = 'Separei algumas opcoes e posso agendar uma visita.';

  return {
    ...baseConfig('Imobiliaria: qualificacao e busca no CRM', 'webWidget'),
    startStepId: start.id,
    steps: [start, input, context, search, end],
    edges: [connect(start, input), connect(input, context), connect(context, search), connect(search, end)],
  };
}

export function getFlowTemplates(): FlowTemplateSummary[] {
  return [
    {
      id: 'support-whatsapp-rag',
      name: 'Atendimento WhatsApp + RAG',
      segment: 'Suporte',
      description: 'Entrada WhatsApp com supervisor de intencao, fallback RAG e resposta final.',
      channel: 'whatsapp',
      config: createSupportWhatsappRagTemplate(),
    },
    {
      id: 'scheduling-whatsapp',
      name: 'Agendamento inteligente',
      segment: 'Atendimento',
      description: 'Coleta CPF, consulta disponibilidade via MCP/API e renderiza opcoes interativas.',
      channel: 'whatsapp',
      config: createSchedulingTemplate(),
    },
    {
      id: 'backoffice-agentops',
      name: 'Backoffice agentico',
      segment: 'Operacoes',
      description: 'Cron, API, MongoDB e dashboard para rotinas internas com rastreabilidade.',
      channel: 'webWidget',
      config: createBackofficeTemplate(),
    },
    {
      id: 'clinic-triage-approval',
      name: 'Clinica com aprovacao',
      segment: 'Saude',
      description: 'Triagem por MCP, consulta de agenda e gate humano para encaixes sensiveis.',
      channel: 'whatsapp',
      config: createClinicTriageTemplate(),
    },
    {
      id: 'ecommerce-refund-safe',
      name: 'E-commerce seguro',
      segment: 'E-commerce',
      description: 'Consulta pedido via MCP, aprova reembolso/cupom e responde com contexto.',
      channel: 'whatsapp',
      config: createEcommerceSupportTemplate(),
    },
    {
      id: 'real-estate-lead-crm',
      name: 'Imobiliaria CRM',
      segment: 'Vendas',
      description: 'Qualifica lead, normaliza perfil e busca imoveis no CRM por MCP/API.',
      channel: 'webWidget',
      config: createRealEstateLeadTemplate(),
    },
  ];
}
