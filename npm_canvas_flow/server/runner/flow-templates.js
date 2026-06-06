"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCanvasFlowTemplates = getCanvasFlowTemplates;
function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}
function step(type, index, patch = {}) {
    return {
        id: createId(type),
        type,
        title: '',
        instruction: '',
        position: { x: 120 + index * 260, y: 180 },
        tags: [],
        ...patch,
    };
}
function edge(source, target) {
    return { id: createId('edge'), source: source.id, target: target.id };
}
function base(title, channel) {
    return {
        title,
        responseName: createId('flow').replace(/-/g, '_'),
        execute: 'firstQuestion',
        model: 'gpt-4o',
        llmProvider: 'openai',
        channel,
        isMainFlow: true,
        webWidget: {
            primaryColor: '#0f6bff',
            accentColor: '#00b37e',
            assistantName: 'Assistente IA',
            subtitle: 'Online agora',
            welcomeMessage: 'Ola! Como posso ajudar?',
            placeholder: 'Digite sua mensagem',
            bubbleLabel: 'Precisa de ajuda?',
            avatarText: 'IA',
            openByDefault: false,
            position: 'right',
        },
        whatsapp: {
            provider: 'meta',
            deliveryMode: 'provider',
            verifyToken: 'canvas-flow-token',
            phoneNumberId: '',
            accessToken: '',
            graphApiVersion: 'v20.0',
            autoReply: true,
        },
        turnHistoricMessages: 20,
    };
}
function supportWhatsappRag() {
    const start = step('message', 0, {
        title: 'Boas vindas',
        instruction: 'Ola! Sou o assistente de atendimento. Me conte o que voce precisa.',
    });
    const input = step('input', 1, {
        title: 'Pergunta do cliente',
        responseName: 'pergunta',
        instruction: 'Digite sua duvida.',
    });
    const supervisor = step('component', 2, {
        title: 'Supervisor de intencao',
        instruction: 'Classifica a intencao e roteia para fluxos especializados quando existirem.',
        component: {
            type: 'flowRouter',
            responseName: 'flowRouter',
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
            flowRouterFallbackAgentId: '',
            flowRouterFallbackFlowId: '',
        },
    });
    const rag = step('component', 3, {
        title: 'Resposta com base de conhecimento',
        responseName: 'respostaRag',
        component: {
            type: 'rag',
            responseName: 'respostaRag',
            collectionName: '',
            k: 8,
            turnHistoricMessages: 20,
            prompt: 'Responda em pt-BR de forma objetiva. Use a base de conhecimento quando houver documentos relevantes. Se faltar contexto, diga o que precisa confirmar.',
            queryTemplate: '{{context.slots.pergunta}}',
            ragLlmProvider: 'auto',
            ragEmbeddingProvider: 'auto',
            ragSearchProvider: 'auto',
            ragStorageProvider: 'none',
            ragUseAgentFilter: true,
        },
    });
    const end = step('end', 4, {
        title: 'Responder cliente',
        instruction: '{{context.slots.respostaRag.text}}',
    });
    return { ...base('Atendimento WhatsApp com RAG e Supervisor', 'whatsapp'), startStepId: start.id, steps: [start, input, supervisor, rag, end], edges: [edge(start, input), edge(input, supervisor), edge(supervisor, rag), edge(rag, end)] };
}
function schedulingWhatsapp() {
    const start = step('message', 0, {
        title: 'Inicio do agendamento',
        instruction: 'Vamos agendar seu atendimento. Primeiro, informe seu CPF.',
    });
    const cpf = step('input', 1, {
        title: 'Coletar CPF',
        responseName: 'cpf',
        instruction: 'Informe seu CPF.',
        inputValidationMode: 'type',
        inputValidationType: 'cpf',
        inputValidationErrorMessage: 'CPF invalido. Informe novamente somente os numeros.',
    });
    const mcp = step('component', 2, {
        title: 'Consultar disponibilidade',
        responseName: 'agenda',
        component: {
            type: 'mcp',
            responseName: 'agenda',
            mcpMode: 'api',
            mcpToolName: 'consultar_agenda',
            mcpToolDescription: 'Consulta disponibilidade de agenda por CPF.',
            mcpInstruction: 'Use o CPF do contexto para consultar disponibilidade. Normalize providers, services, dates e times.',
            mcpInputSchema: '{\n  "type": "object",\n  "properties": {\n    "cpf": { "type": "string" }\n  },\n  "required": ["cpf"]\n}',
            mcpOutputSchema: '{\n  "type": "object",\n  "properties": {\n    "providers": { "type": "array" },\n    "services": { "type": "array" },\n    "dates": { "type": "array" },\n    "times": { "type": "array" }\n  }\n}',
            mcpApiMethod: 'POST',
            mcpApiBaseUrl: '',
            mcpApiBodyJson: '{\n  "cpf": "{{context.slots.cpf}}"\n}',
            mcpApiExecute: true,
        },
    });
    const rich = step('richMessage', 3, {
        title: 'Escolher horario',
        instruction: 'Escolha uma opcao de agendamento.',
        richMessage: {
            type: 'appointmentFlow',
            text: 'Escolha uma opcao de agendamento.',
            appointmentFlow: {
                mode: 'auto',
                flowToken: '{{context.conversationId}}',
                flowCta: 'Agendar',
                flowScreen: 'START',
                headerText: 'Agendamento',
                buttonText: 'Ver opcoes',
                stage: 'providers',
                providersTemplate: '{{context.slots.agenda.providers}}',
                servicesTemplate: '{{context.slots.agenda.services}}',
                datesTemplate: '{{context.slots.agenda.dates}}',
                timesTemplate: '{{context.slots.agenda.times}}',
            },
        },
    });
    const end = step('end', 4, {
        title: 'Confirmacao',
        instruction: 'Perfeito. Registrei sua escolha e sigo com a confirmacao.',
    });
    return { ...base('Agendamento assistido por WhatsApp Flow', 'whatsapp'), startStepId: start.id, steps: [start, cpf, mcp, rich, end], edges: [edge(start, cpf), edge(cpf, mcp), edge(mcp, rich), edge(rich, end)] };
}
function clinicTriageApproval() {
    const start = step('message', 0, {
        title: 'Recepcao',
        instruction: 'Ola! Vou te ajudar com agendamento, exame, convenio ou remarcacao.',
    });
    const input = step('input', 1, {
        title: 'Solicitacao',
        responseName: 'solicitacao',
        instruction: 'Descreva o que voce precisa.',
    });
    const classify = step('component', 2, {
        title: 'Classificar atendimento',
        responseName: 'triagem',
        component: {
            type: 'mcp',
            responseName: 'triagem',
            mcpMode: 'fields',
            mcpToolName: 'classificar_triagem_clinica',
            mcpToolDescription: 'Classifica demanda de clinica e extrai dados essenciais.',
            mcpInstruction: 'Classifique a solicitacao em agendamento, exame, convenio, remarcacao ou humano. Extraia especialidade, convenio e urgencia quando aparecerem.',
            mcpOutputSchema: '{\n  "type": "object",\n  "properties": {\n    "intencao": { "type": "string" },\n    "especialidade": { "type": "string" },\n    "convenio": { "type": "string" },\n    "urgente": { "type": "boolean" }\n  }\n}',
        },
    });
    const agenda = step('component', 3, {
        title: 'Consultar agenda',
        responseName: 'agenda',
        component: {
            type: 'mcp',
            responseName: 'agenda',
            mcpMode: 'api',
            mcpToolName: 'consultar_agenda_clinica',
            mcpToolDescription: 'Consulta agenda no sistema da clinica.',
            mcpInstruction: 'Monte a consulta usando especialidade e convenio extraidos na triagem.',
            mcpApiMethod: 'POST',
            mcpApiBaseUrl: '',
            mcpApiBodyJson: '{\n  "especialidade": "{{context.slots.triagem.output.especialidade}}",\n  "convenio": "{{context.slots.triagem.output.convenio}}"\n}',
        },
    });
    const approve = step('component', 4, {
        title: 'Aprovar encaixe',
        responseName: 'aprovacaoEncaixe',
        component: {
            type: 'approval',
            responseName: 'aprovacaoEncaixe',
            approvalTitle: 'Aprovar encaixe de agenda',
            approvalDescription: 'A solicitacao parece urgente. Revise antes de oferecer encaixe fora da regra padrao.',
            approvalRisk: 'high',
            approvalScopes: ['agenda_write', 'exception'],
            approvalApproverHint: 'Recepcao ou coordenacao da clinica',
            approvalKeyword: 'aprovar',
            approvalRejectKeyword: 'reprovar',
            approvalApprovedText: 'Aprovado. Vou continuar com a confirmacao do encaixe.',
            approvalRejectedText: 'Nao vou oferecer encaixe fora da regra. Vou sugerir horarios padrao.',
            approvalRequireExplicitInput: true,
        },
    });
    const end = step('end', 5, {
        title: 'Responder paciente',
        instruction: 'Encontrei as melhores opcoes e vou seguir com a confirmacao.',
    });
    return { ...base('Clinica: triagem e agendamento com aprovacao', 'whatsapp'), startStepId: start.id, steps: [start, input, classify, agenda, approve, end], edges: [edge(start, input), edge(input, classify), edge(classify, agenda), edge(agenda, approve), edge(approve, end)] };
}
function ecommerceRefundSafe() {
    const start = step('message', 0, {
        title: 'Atendimento loja',
        instruction: 'Ola! Posso ajudar com pedido, troca, rastreio ou produto.',
    });
    const order = step('input', 1, {
        title: 'Pedido ou duvida',
        responseName: 'pedido',
        instruction: 'Informe seu numero de pedido ou descreva sua duvida.',
    });
    const lookup = step('component', 2, {
        title: 'Consultar pedido',
        responseName: 'consultaPedido',
        component: {
            type: 'mcp',
            responseName: 'consultaPedido',
            mcpMode: 'api',
            mcpToolName: 'consultar_pedido',
            mcpToolDescription: 'Consulta dados de pedido, rastreio e status.',
            mcpInstruction: 'Use o texto do cliente para localizar pedido e status. Nunca invente codigo de rastreio.',
            mcpApiMethod: 'GET',
            mcpApiBaseUrl: '',
            mcpApiQueryJson: '{\n  "q": "{{context.slots.pedido}}"\n}',
        },
    });
    const approveRefund = step('component', 3, {
        title: 'Aprovar reembolso',
        responseName: 'aprovacaoReembolso',
        component: {
            type: 'approval',
            responseName: 'aprovacaoReembolso',
            approvalTitle: 'Aprovar reembolso ou cupom',
            approvalDescription: 'Antes de gerar cupom/reembolso, confira valor, politica e historico do cliente.',
            approvalRisk: 'high',
            approvalScopes: ['refund', 'coupon_write'],
            approvalApproverHint: 'Lider de atendimento',
            approvalKeyword: 'aprovar',
            approvalRejectKeyword: 'reprovar',
            approvalApprovedText: 'Aprovado. Vou montar a resposta com a compensacao.',
            approvalRejectedText: 'Reembolso bloqueado. Vou orientar o cliente com alternativas seguras.',
            approvalRequireExplicitInput: true,
        },
    });
    const answer = step('component', 4, {
        title: 'Resposta final',
        responseName: 'resposta',
        component: {
            type: 'openaiGen',
            responseName: 'resposta',
            prompt: 'Responda de forma clara usando context.slots.consultaPedido e o status da aprovacao quando existir.',
            queryTemplate: '{{context.slots.pedido}}',
        },
    });
    const end = step('end', 5, {
        title: 'Enviar resposta',
        instruction: '{{context.slots.resposta.text}}',
    });
    return { ...base('E-commerce: pedido, troca e reembolso seguro', 'whatsapp'), startStepId: start.id, steps: [start, order, lookup, approveRefund, answer, end], edges: [edge(start, order), edge(order, lookup), edge(lookup, approveRefund), edge(approveRefund, answer), edge(answer, end)] };
}
function realEstateLeadCrm() {
    const start = step('message', 0, {
        title: 'Receber lead',
        instruction: 'Ola! Vou entender seu perfil para sugerir imoveis.',
    });
    const input = step('input', 1, {
        title: 'Perfil do cliente',
        responseName: 'perfil',
        instruction: 'Qual bairro, faixa de valor e tipo de imovel voce procura?',
    });
    const normalize = step('component', 2, {
        title: 'Normalizar perfil',
        responseName: 'lead',
        component: {
            type: 'context',
            responseName: 'lead',
            contextMode: 'llm',
            contextLlmPrompt: 'Extraia bairro, valorMaximo, quartos, tipo e urgencia do lead imobiliario.',
        },
    });
    const search = step('component', 3, {
        title: 'Buscar imoveis',
        responseName: 'imoveis',
        component: {
            type: 'mcp',
            responseName: 'imoveis',
            mcpMode: 'api',
            mcpToolName: 'buscar_imoveis',
            mcpToolDescription: 'Busca imoveis no CRM/imobiliaria.',
            mcpApiMethod: 'POST',
            mcpApiBaseUrl: '',
            mcpApiBodyJson: '{\n  "bairro": "{{context.slots.lead.bairro}}",\n  "valorMaximo": "{{context.slots.lead.valorMaximo}}",\n  "quartos": "{{context.slots.lead.quartos}}"\n}',
        },
    });
    const end = step('end', 4, {
        title: 'Pronta entrega',
        instruction: 'Separei algumas opcoes e posso agendar uma visita.',
    });
    return { ...base('Imobiliaria: qualificacao e busca no CRM', 'webWidget'), startStepId: start.id, steps: [start, input, normalize, search, end], edges: [edge(start, input), edge(input, normalize), edge(normalize, search), edge(search, end)] };
}
function backofficeAgentOps() {
    const cron = step('component', 0, {
        title: 'Rotina programada',
        component: { type: 'cron', responseName: 'cron', cronEnabled: false, cronMode: 'daily', cronTime: '09:00', cronTimezone: 'America/Sao_Paulo', cronInputText: 'Executar rotina de backoffice', cronRunFrom: 'cronNode' },
    });
    const api = step('api', 1, {
        title: 'Buscar dados operacionais',
        responseName: 'dadosOperacionais',
        api: { responseName: 'dadosOperacionais', requests: [{ method: 'GET', url: 'https://example.com', headers: {}, params: {}, bodyType: 'none' }] },
    });
    const approve = step('component', 2, {
        title: 'Aprovar escrita',
        responseName: 'aprovacaoBackoffice',
        component: {
            type: 'approval',
            responseName: 'aprovacaoBackoffice',
            approvalTitle: 'Aprovar registro operacional',
            approvalDescription: 'Revise os dados da rotina antes de gravar no banco operacional.',
            approvalRisk: 'medium',
            approvalScopes: ['mongo_write', 'backoffice'],
            approvalApproverHint: 'Operador responsavel',
            approvalKeyword: 'aprovar',
            approvalRejectKeyword: 'reprovar',
            approvalApprovedText: 'Aprovado. Vou registrar o resultado.',
            approvalRejectedText: 'Registro bloqueado por aprovacao humana.',
            approvalRequireExplicitInput: true,
        },
    });
    const mongo = step('component', 3, {
        title: 'Registrar resultado',
        responseName: 'registro',
        component: { type: 'mongodb', responseName: 'registro', mongoOperation: 'insertOne', mongoCollectionName: 'agentic_backoffice_runs', mongoDocument: '{\n  "runAt": "{{context.now}}",\n  "agentId": "{{context.agentId}}",\n  "dados": "{{context.slots.dadosOperacionais}}"\n}' },
    });
    const dashboard = step('component', 4, {
        title: 'Resumo operacional',
        component: { type: 'dashboard', responseName: 'dashboard', dashboardSource: 'trace', dashboardMode: 'summary', dashboardTitle: 'Resumo da rotina' },
    });
    const end = step('end', 5, { instruction: 'Rotina executada. Veja o dashboard no trace.' });
    return { ...base('Backoffice agentico com cron, API e Mongo', 'webWidget'), startStepId: cron.id, steps: [cron, api, approve, mongo, dashboard, end], edges: [edge(cron, api), edge(api, approve), edge(approve, mongo), edge(mongo, dashboard), edge(dashboard, end)] };
}
function getCanvasFlowTemplates() {
    return [
        { id: 'support-whatsapp-rag', name: 'Atendimento WhatsApp + RAG', segment: 'Suporte', description: 'Entrada WhatsApp com supervisor de intencao, fallback RAG e resposta final.', channel: 'whatsapp', config: supportWhatsappRag() },
        { id: 'scheduling-whatsapp', name: 'Agendamento inteligente', segment: 'Atendimento', description: 'Coleta CPF, consulta disponibilidade via MCP/API e renderiza opcoes interativas.', channel: 'whatsapp', config: schedulingWhatsapp() },
        { id: 'clinic-triage-approval', name: 'Clinica com aprovacao', segment: 'Saude', description: 'Triagem, agenda via MCP e aprovacao humana para encaixes sensiveis.', channel: 'whatsapp', config: clinicTriageApproval() },
        { id: 'ecommerce-refund-safe', name: 'E-commerce seguro', segment: 'Varejo', description: 'Consulta pedido via MCP e exige aprovacao antes de reembolso ou cupom.', channel: 'whatsapp', config: ecommerceRefundSafe() },
        { id: 'real-estate-lead-crm', name: 'Imobiliaria CRM', segment: 'Vendas', description: 'Qualifica leads, normaliza perfil e busca imoveis por ferramenta MCP/API.', channel: 'webWidget', config: realEstateLeadCrm() },
        { id: 'backoffice-agentops', name: 'Backoffice agentico', segment: 'Operacoes', description: 'Cron, API, MongoDB e dashboard para rotinas internas com rastreabilidade.', channel: 'webWidget', config: backofficeAgentOps() },
    ];
}
//# sourceMappingURL=flow-templates.js.map