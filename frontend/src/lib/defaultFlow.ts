import type { FlowConfig, FlowStep, StepType, ComponentType, WebWidgetConfig, WhatsappConfig } from '../types/flow';

export const DEFAULT_WEB_WIDGET_CONFIG: WebWidgetConfig = {
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
};

export function createWebWidgetConfig(config?: Partial<WebWidgetConfig>): WebWidgetConfig {
  return {
    ...DEFAULT_WEB_WIDGET_CONFIG,
    ...(config || {}),
  };
}

export const DEFAULT_WHATSAPP_CONFIG: WhatsappConfig = {
  provider: 'meta',
  deliveryMode: 'provider',
  onboardingMode: 'manual',
  verifyToken: 'canvas-flow-token',
  businessAccountId: '',
  phoneNumberId: '',
  accessToken: '',
  graphApiVersion: 'v20.0',
  autoReply: true,
  coexistenceEnabled: false,
  syncMessageEchoes: true,
  syncHistory: false,
  embeddedSignupAppId: '',
  embeddedSignupConfigId: '',
  embeddedSignupAppSecret: '',
  embeddedSignupSolutionId: '',
  embeddedSignupFeatureType: '',
  embeddedSignupSessionInfoVersion: '3',
  embeddedSignupVersion: '',
  blipContractId: '',
  blipAuthorizationKey: '',
  sinchProjectId: '',
  sinchAppId: '',
  sinchRegion: 'us',
  sinchAccessToken: '',
  sinchChannel: 'WHATSAPP',
  sinchApiMode: 'conversation',
  sinchServiceNumber: '',
  sinchServiceUsername: '',
  sinchServiceToken: '',
};

export function createWhatsappConfig(config?: Partial<WhatsappConfig>): WhatsappConfig {
  const legacyConfig = (config || {}) as any;
  return {
    ...DEFAULT_WHATSAPP_CONFIG,
    ...(config || {}),
    sinchApiMode: legacyConfig.sinchApiMode === 'broker' ? 'relay' : legacyConfig.sinchApiMode || DEFAULT_WHATSAPP_CONFIG.sinchApiMode,
    sinchServiceNumber: legacyConfig.sinchServiceNumber || legacyConfig.sinchBrokerNumber || '',
    sinchServiceUsername: legacyConfig.sinchServiceUsername || legacyConfig.sinchBrokerUsername || legacyConfig.sinchBrokerNumber || '',
    sinchServiceToken: legacyConfig.sinchServiceToken || legacyConfig.sinchBrokerToken || '',
  };
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

export function createStep(type: StepType, index: number, componentType?: ComponentType): FlowStep {
  const base = {
    id: createId(type),
    type,
    title: '',
    instruction: '',
    position: { x: 120 + index * 230, y: 180 + (index % 2) * 160 },
    tags: [],
  };

  if (type === 'message') {
    return {
      ...base,
      title: 'Mensagem',
      instruction: 'Escreva a mensagem para o usuário.',
      messageUseLlm: false,
      messageLlmModel: '',
      messageLlmTemperature: 0.4,
    };
  }
  if (type === 'richMessage') {
    return {
      ...base,
      title: 'Mensagem rica',
      instruction: 'Mensagem interativa por canal.',
        richMessage: {
          type: 'buttons',
          text: 'Escolha uma opcao:',
          footer: '',
          media: {
            url: '',
            fileName: '',
            mimeType: '',
          },
          buttons: [
          { id: 'sim', label: 'Sim', value: 'sim' },
          { id: 'nao', label: 'Não', value: 'nao' },
        ],
        quickReplies: [
          { id: 'ajuda', label: 'Ajuda', value: 'ajuda' },
          { id: 'falar_atendente', label: 'Atendente', value: 'atendente' },
        ],
        list: {
          buttonText: 'Ver opções',
          sections: [
            {
              title: 'Opções',
              items: [
                { id: 'produto', title: 'Produto', description: 'Ver produtos', value: 'produto' },
                { id: 'suporte', title: 'Suporte', description: 'Falar com suporte', value: 'suporte' },
              ],
            },
          ],
        },
        carousel: {
          cards: [
            {
              id: 'card-1',
              title: 'Produto exemplo',
              subtitle: 'Descricao curta do produto.',
              imageUrl: '',
              buttons: [{ id: 'ver_produto', label: 'Ver produto', value: 'ver_produto' }],
            },
          ],
        },
        appointmentFlow: {
          mode: 'auto',
          flowId: '',
          flowToken: '{{context.conversationId}}',
          flowCta: 'Agendar',
          flowScreen: 'START',
          headerText: 'Agendamento',
          buttonText: 'Ver opções',
          stage: 'actions',
          stageTemplate: '{{context.slots.appointmentStage}}',
          actionsTemplate: '',
          appointmentsTemplate: '{{context.slots.appointments}}',
          providersTemplate: '{{context.slots.providers}}',
          servicesTemplate: '{{context.slots.services}}',
          datesTemplate: '{{context.slots.dates}}',
          timesTemplate: '{{context.slots.times}}',
          itemsTemplate: '{{context.slots.items}}',
          itemsFilterTemplate: '',
          itemsMaxSelected: 20,
          examsTemplate: '{{context.slots.exams}}',
          payloadTemplate: '{}',
          stepOrder: ['providers', 'services', 'items', 'dates', 'times'],
          stepLabels: {
            actions: 'Ações iniciais',
            appointments: 'Meus agendamentos',
            providers: 'Prestadores',
            services: 'Serviços',
            dates: 'Datas',
            times: 'Horários',
            items: 'Itens selecionáveis',
          },
          attachmentSteps: [],
          llmEnabled: false,
          llmSourceTemplate: '{{context.slots.schedules}}',
          llmInstruction: 'Receba os agendamentos/horários brutos e retorne providers, services, items, dates, times e appointments no formato do WhatsApp Flow.',
          llmModel: '',
          llmTemperature: 0.1,
        },
        generation: {
          enabled: false,
          prompt: 'Gere opções objetivas em pt-BR com base no contexto da conversa e no texto principal.',
          model: '',
          maxItems: 3,
        },
      },
    };
  }
  if (type === 'input') {
    return {
      ...base,
      title: 'Coletar dado',
      instruction: 'Informe o dado para continuar.',
      responseName: 'input',
      inputValidationMode: 'none',
      inputValidationType: 'text',
      inputValidationRegex: '',
      inputValidationErrorMessage: 'Valor inválido. Informe novamente.',
      inputValidationLlmInstruction: 'Valide se a entrada do usuário atende ao dado solicitado.',
      inputValidationLlmModel: '',
      inputValidationLlmTemperature: 0,
    };
  }
  if (type === 'api') {
    return {
      ...base,
      title: 'API httpBatch',
      instruction: 'Execute uma ou mais chamadas HTTP.',
      responseName: 'api',
      api: {
        responseName: 'api',
        requests: [{ method: 'GET', url: 'https://example.com', headers: {}, params: {}, bodyType: 'none' }],
        generation: {
          enabled: false,
          prompt: 'Monte uma ou mais chamadas HTTP usando o contexto do fluxo.',
          model: '',
          temperature: 0.2,
          fallbackToManual: true,
        },
      },
    };
  }
  if (type === 'condition') {
    return {
      ...base,
      title: 'Condição',
      instruction: 'context.slots.input === "ok"',
      responseName: 'condition',
      condition: 'context.slots.input === "ok"',
      conditionMode: 'js',
    };
  }
  if (type === 'end') {
    return { ...base, title: 'Responder', instruction: 'Fluxo finalizado.' };
  }
  if (type === 'group') {
    return {
      ...base,
      title: 'Encapsulador',
      instruction: 'Arraste ou selecione nós para colocar aqui.',
      group: { width: 520, height: 340 },
    };
  }

  if (componentType === 'debug') {
    return {
      ...base,
      type: 'component',
      title: 'Debug',
      instruction: 'Registra um snapshot do contexto.',
      responseName: 'debug',
      component: { type: 'debug', responseName: 'debug' },
    };
  }

  if (componentType === 'mongodb') {
    return {
      ...base,
      type: 'component',
      title: 'MongoDB',
      instruction: 'Conecta em uma collection para CRUD ou registro analítico.',
      responseName: 'mongo',
      component: {
        type: 'mongodb',
        responseName: 'mongo',
        mongoOperation: 'insertOne',
        mongoCollectionName: 'flow_events',
        mongoFilter: '{}',
        mongoDocument: '{}',
        mongoUpdate: '{}',
        mongoPipeline: '[]',
        mongoProjection: '{}',
        mongoSort: '{"createdAt": -1}',
        mongoLimit: 50,
        mongoPage: 1,
        mongoSkip: 0,
        mongoPaginationMode: 'single',
        mongoMaxPages: 5,
        mongoDateField: 'createdAt',
        mongoDateStart: '',
        mongoDateEnd: '',
        mongoDateTimezone: 'America/Sao_Paulo',
        mongoUseLlmFilter: false,
        mongoLlmMode: 'filter',
        mongoLlmInstruction: '',
        mongoLlmModel: '',
      },
    };
  }

  if (componentType === 'openaiGen' || componentType === 'azureOpenAI') {
    const isAzure = componentType === 'azureOpenAI';
    return {
      ...base,
      type: 'component',
      title: isAzure ? 'Azure OpenAI' : 'Agente',
      instruction: isAzure ? 'Gera resposta usando Azure OpenAI.' : 'Agente LLM que usa o Agent Workspace para rules, skills, subagents, MCP e guardrails.',
      responseName: isAzure ? 'azureOpenAI' : 'agente',
      component: {
        type: componentType,
        responseName: isAzure ? 'azureOpenAI' : 'agente',
        ragLlmProvider: isAzure ? 'azure_openai' : 'auto',
        ragLlmModel: '',
        agentRole: isAzure ? undefined : 'simple',
        agentUseWorkspaceCatalog: true,
        agentExecutionMode: isAzure ? 'flow' : 'hybrid',
        agentMaxToolCalls: 1,
        queryTemplate: '{{context.slots.userInput}}',
        llmContextTemplate: '',
        ragDocsPath: '',
        prompt: 'Responda em pt-BR de forma objetiva usando os documentos conectados quando existirem.',
        turnHistoricMessages: 20,
        agentSpec: isAzure ? undefined : {
          agentsMd: '',
          guardrails: '',
          blockedTerms: [],
        },
      },
    };
  }

  if (componentType === 'agentPlan') {
    return {
      ...base,
      type: 'component',
      title: 'Agent Plan',
      instruction: 'Define como o agente deve planejar antes de chamar skills, subagents e MCP.',
      responseName: 'agentPlan',
      component: {
        type: 'agentPlan',
        responseName: 'agentPlan',
        agentPlanMode: 'advisory',
        agentPlanInstructions: [
          'Quebre pedidos com multiplas intencoes em uma etapa por ferramenta.',
          'Use somente ferramentas que estejam no manifesto visivel do agente.',
          'Nao use tradutor para resumir, nem resumidor para traduzir.',
        ].join('\n'),
        agentPlanJson: '{\n  "plan": []\n}',
        agentPlanMaxToolCalls: 3,
        agentPlanClearAfterUse: true,
      },
    };
  }

  if (componentType === 'mcp') {
    return {
      ...base,
      type: 'component',
      title: 'MCP',
      instruction: 'Executa uma ferramenta MCP-style com contrato, LLM e schema.',
      responseName: 'mcp',
      component: {
        type: 'mcp',
        responseName: 'mcp',
        mcpMode: 'fields',
        mcpToolName: 'montar_campos',
        mcpToolDescription: 'Monta campos estruturados para o fluxo com base no contexto.',
        mcpInstruction: 'Use o contexto do fluxo e retorne somente os campos solicitados no schema de saída.',
        mcpInputSchema: '{\n  "type": "object",\n  "properties": {\n    "input": { "type": "string", "description": "Entrada do usuário" }\n  }\n}',
        mcpOutputSchema: '{\n  "type": "object",\n  "properties": {\n    "status": { "type": "string" },\n    "campos": { "type": "object" }\n  }\n}',
        mcpLlmProvider: 'auto',
        mcpModel: '',
        mcpTemperature: 0.1,
        mcpApiMethod: 'POST',
        mcpApiBaseUrl: '',
        mcpApiHeadersJson: '{}',
        mcpApiQueryJson: '{}',
        mcpApiBodyJson: '{}',
        mcpApiAuthMode: 'none',
        mcpApiAuthHeaderName: 'Authorization',
        mcpApiAuthQueryParam: 'api_key',
        mcpApiAllowLlmRequest: true,
        mcpApiMapResultWithLlm: true,
        mcpApiExecute: true,
        mcpApiCallMode: 'single',
        mcpApiExecutionMode: 'sequential',
        mcpApiRequestsJson: '[]',
        mcpMergeOutputToSlots: false,
        mcpExternalTransport: 'streamable_http',
        mcpExternalUrl: '',
        mcpExternalHeadersJson: '{}',
        mcpExternalAuthMode: 'none',
        mcpExternalOAuthConnectionScope: 'agent',
        mcpExternalAuthHeaderName: 'Authorization',
        mcpExternalAuthQueryParam: 'api_key',
        mcpExternalOperation: 'callTool',
        mcpExternalToolName: '',
        mcpExternalArgumentsJson: '{}',
        mcpExternalResourceUri: '',
        mcpExternalPromptName: '',
        mcpExternalPromptArgumentsJson: '{}',
        mcpExternalUseLlmArguments: true,
        mcpExternalMapResultWithLlm: true,
        mcpExternalTimeoutMs: 30000,
      },
    };
  }

  if (componentType === 'files') {
    return {
      ...base,
      type: 'component',
      title: 'Arquivos',
      instruction: 'Leia arquivos enviados ou uma URL e salve o texto no contexto.',
      responseName: 'arquivos',
      component: {
        type: 'files',
        responseName: 'arquivos',
        filesSourceMode: 'upload',
        filesResultMode: 'context',
        filesUploaded: [],
        filesUrlTemplate: '',
        filesPreferOcr: false,
        filesMaxTextChars: 60000,
        filesLlmProvider: 'auto',
        filesLlmModel: '',
        filesLlmPrompt: 'Leia os arquivos conectados e responda ao usuario em pt-BR de forma objetiva.',
        filesQuestionTemplate: '{{context.slots.userInput}}',
        filesLlmTemperature: 0.2,
        filesOperation: 'read',
        filesOutputFormat: 'docx',
        filesOutputFilenameTemplate: 'artefato.docx',
        filesContentTemplate: '',
        filesTemplateDocumentId: '',
        filesTemplateDocumentIds: [],
        filesTemplateValuesJson: '{}',
        filesGenerationPrompt: '',
        filesUseDocumentSkill: true,
        filesDocumentSkillPrompt: '',
        ragDocsPath: '',
      },
    };
  }

  if (componentType === 'approval') {
    return {
      ...base,
      type: 'component',
      title: 'Aprovação humana',
      instruction: 'Revise e aprove antes de executar a próxima ação sensível.',
      responseName: 'aprovacao',
      component: {
        type: 'approval',
        responseName: 'aprovacao',
        approvalTitle: 'Aprovar ação sensível',
        approvalDescription: 'Um operador precisa revisar esta etapa antes de continuar.',
        approvalRisk: 'high',
        approvalScopes: ['write', 'external_api'],
        approvalApproverHint: 'Operador humano',
        approvalKeyword: 'aprovar',
        approvalRejectKeyword: 'reprovar',
        approvalApprovedText: 'Aprovado. Vou continuar.',
        approvalRejectedText: 'Reprovado. A ação foi bloqueada.',
        approvalRequireExplicitInput: true,
      },
    };
  }

  if (componentType === 'milvus') {
    return {
      ...base,
      type: 'component',
      title: 'Milvus',
      instruction: 'Busca documentos vetoriais no Milvus.',
      responseName: 'milvus',
      component: {
        type: 'milvus',
        responseName: 'milvus',
        ragOperation: 'search',
        collectionName: '',
        ragEmbeddingProvider: 'openai',
        ragEmbeddingModel: '',
        ragUseAgentFilter: true,
        ragAgentIdTemplate: '',
        ragDocumentsPath: '',
        queryTemplate: '{{context.slots.userInput}}',
        ragTextTemplate: '',
        ragTextPath: '',
        ragEmbeddingNameTemplate: 'Documento',
        ragEmbeddingIdTemplate: '',
        ragExtraFieldsJson: '{\n  "source": "canvas-flow"\n}',
        ragChunkSize: 512,
        ragChunkOverlap: 70,
        k: 8,
        useHybrid: true,
        filterExpr: '',
        extraFieldsFilter: {},
        order: 'desc',
      },
    };
  }

  if (componentType === 'azureSearch') {
    return {
      ...base,
      type: 'component',
      title: 'Azure AI Search',
      instruction: 'Busca documentos no indice Azure AI Search.',
      responseName: 'azureSearch',
      component: {
        type: 'azureSearch',
        responseName: 'azureSearch',
        ragOperation: 'search',
        collectionName: '',
        ragEmbeddingProvider: 'openai',
        ragEmbeddingModel: '',
        ragUseAgentFilter: true,
        ragAgentIdTemplate: '',
        ragDocumentsPath: '',
        queryTemplate: '{{context.slots.userInput}}',
        ragTextTemplate: '',
        ragTextPath: '',
        ragEmbeddingNameTemplate: 'Documento',
        ragEmbeddingIdTemplate: '',
        ragExtraFieldsJson: '{\n  "source": "canvas-flow"\n}',
        ragChunkSize: 512,
        ragChunkOverlap: 70,
        k: 8,
        extraFieldsFilter: {},
        order: 'desc',
      },
    };
  }

  if (componentType === 'azureBlob') {
    return {
      ...base,
      type: 'component',
      title: 'Azure Blob Storage',
      instruction: 'Grava um payload no Azure Blob Storage.',
      responseName: 'azureBlob',
      component: {
        type: 'azureBlob',
        responseName: 'azureBlob',
        azureBlobOperation: 'upload',
        azureBlobNameTemplate: 'canvas-flow/{{context.conversationId}}/{{context.now}}.json',
        azureBlobContentTemplate: '{{context.slots}}',
        azureBlobContentPath: '',
        azureBlobContentType: 'application/json',
        collectionName: '',
        ragEmbeddingProvider: 'openai',
        ragEmbeddingModel: '',
        ragUseAgentFilter: true,
        ragAgentIdTemplate: '',
        ragDocumentsPath: '',
        ragTextTemplate: '',
        ragTextPath: '',
        ragEmbeddingNameTemplate: 'Documento',
        ragEmbeddingIdTemplate: '',
        ragExtraFieldsJson: '{\n  "source": "canvas-flow-blob"\n}',
        ragChunkSize: 512,
        ragChunkOverlap: 70,
      },
    };
  }

  if (componentType === 'dashboard') {
    return {
      ...base,
      type: 'component',
      title: 'Dashboard',
      instruction: 'Monta dados analíticos usando trace, MongoDB, API externa ou Milvus.',
      responseName: 'dashboard',
      component: {
        type: 'dashboard',
        responseName: 'dashboard',
        dashboardTitle: 'Analítico do fluxo',
        dashboardSource: 'trace',
        dashboardMode: 'summary',
        dashboardCollectionName: 'flow_events',
        dashboardPipeline: '[]',
        dashboardApiRequests: '[]',
        dashboardQueryTemplate: '{{context.slots.userInput}}',
        dashboardK: 10,
        dashboardFilterExpr: '',
        dashboardIncludeTrace: true,
        dashboardShowTable: false,
        dashboardUseLlm: true,
        dashboardLlmPrompt: 'Monte um gráfico objetivo em pt-BR com labels curtos e valores numéricos a partir dos dados analíticos.',
        dashboardModel: '',
      },
    };
  }

  if (componentType === 'cron') {
    return {
      ...base,
      type: 'component',
      title: 'CRON',
      instruction: 'Executa o fluxo automaticamente conforme o agendamento.',
      responseName: 'cron',
      component: {
        type: 'cron',
        responseName: 'cron',
        cronEnabled: false,
        cronMode: 'interval',
        cronIntervalValue: 15,
        cronIntervalUnit: 'minutes',
        cronTime: '09:00',
        cronWeekday: 1,
        cronMonthDay: 1,
        cronTimezone: 'America/Sao_Paulo',
        cronRunFrom: 'cronNode',
        cronInputText: '',
        cronSlotsJson: '{}',
        cronExecutionLog: [],
      },
    };
  }

  if (componentType === 'loop') {
    return {
      ...base,
      type: 'component',
      title: 'Loop',
      instruction: 'Repete a saída enquanto não atingir o limite ou até a condição JS parar.',
      responseName: 'loop',
      component: {
        type: 'loop',
        responseName: 'loop',
        loopResponseName: 'loop',
        loopIndexResponseName: 'loopIndex',
        loopMaxIterations: 3,
        loopDelaySeconds: 0,
        loopStopCondition: '',
      },
    };
  }

  if (componentType === 'context') {
    return {
      ...base,
      type: 'component',
      title: 'Contexto',
      instruction: 'Cria ou atualiza variaveis em context.slots por JSON, JS ou LLM.',
      responseName: 'context',
      component: {
        type: 'context',
        responseName: 'context',
        contextMode: 'json',
        contextJson: '{\n  "novoPayload": {\n    "input": "{{context.slots.input}}"\n  }\n}',
        contextScript: 'const itens = Array.isArray(context.slots.itens) ? context.slots.itens : [];\nreturn {\n  totalItens: itens.length,\n  itensNormalizados: itens.map((item) => String(item).trim()).filter(Boolean)\n};',
        contextLlmPrompt: 'Gere um JSON com os novos campos de contexto a partir da conversa atual.',
        contextLlmModel: '',
        contextLlmTemperature: 0.2,
      },
    };
  }

  if (componentType === 'flowRouter') {
    return {
      ...base,
      type: 'component',
      title: 'Supervisor multi-agente',
      instruction: 'Escolhe outro fluxo/agente para continuar a conversa ou mantem no fluxo atual.',
      responseName: 'flowRouter',
      component: {
        type: 'flowRouter',
        responseName: 'flowRouter',
        flowRouterRules: [],
        flowRouterFallbackAgentId: '',
        flowRouterFallbackFlowId: '',
        flowRouterReasonResponseName: 'flowRouter',
      },
    };
  }

  if (componentType === 'webhook') {
    const webhookId = `webhook_${Math.random().toString(36).slice(2, 8)}`;
    return {
      ...base,
      type: 'component',
      title: 'Webhook',
      instruction: 'Recebe ou envia dados via webhook.',
      responseName: 'webhook',
      api: {
        responseName: 'webhook',
        requests: [
          {
            method: 'POST',
            url: 'https://api.exemplo.com/webhook',
            headers: { 'Content-Type': 'application/json' },
            params: {},
            bodyType: 'jsonFields',
            body: {
              event: '{{context.slots.webhookEvent}}',
              conversationId: '{{context.conversationId}}',
              text: '{{context.input}}',
              slots: '{{context.slots}}',
            },
          },
        ],
      },
      component: {
        type: 'webhook',
        responseName: 'webhook',
        webhookMode: 'inbound',
        webhookId,
        webhookAuthMode: 'none',
        webhookSecret: '',
        webhookHeaderName: 'x-canvas-flow-webhook-secret',
        webhookQueryParam: 'secret',
        webhookStartMode: 'node',
        webhookResponseMode: 'sync',
        webhookCallbackUrl: '',
        webhookCallbackAuthMode: 'none',
        webhookCallbackSecret: '',
        webhookCallbackHeaderName: 'x-canvas-flow-callback-secret',
        webhookListenerFireAndForget: true,
      },
    };
  }

  return {
    ...base,
    type: 'component',
    title: 'RAG IA Gen',
    instruction: 'Use o RAG para responder com base no contexto recuperado.',
    responseName: 'rag',
    component: {
      type: 'rag',
      responseName: 'rag',
      collectionName: '',
      k: 8,
      turnHistoricMessages: 20,
      prompt: 'Você é uma IA RAG. Responda em pt-BR com base no contexto.',
      queryTemplate: '{{context.slots.userInput}}',
      ragLlmProvider: 'auto',
      ragEmbeddingProvider: 'auto',
      ragSearchProvider: 'auto',
      ragStorageProvider: 'none',
      ragUseAgentFilter: true,
      ragAgentIdTemplate: '',
      ragDocsPath: '',
      extraFieldsFilter: {},
      extraFieldsFilterPerRound: [],
      extraFieldsFilterPerRoundLimits: [],
      roundStopFind: true,
      roundMixHalf: false,
      extraFieldsFilterOrderBy: [],
      order: 'desc',
    },
  };
}

export function createDefaultFlow(): FlowConfig {
  const start = createStep('message', 0);
  start.title = 'Início';
  start.instruction = 'Ola. Como posso ajudar?';

  const input = createStep('input', 1);
  input.title = 'Pergunta';
  input.responseName = 'pergunta';
  input.instruction = 'Digite sua pergunta.';

  const gen = createStep('component', 2, 'openaiGen');
  gen.position = { x: 580, y: 180 };

  const end = createStep('end', 3);
  end.position = { x: 820, y: 180 };
  end.instruction = '{{context.slots.agente.text}}';

  return {
    title: 'Fluxo conversacional IA Gen',
    responseName: 'conversationFlow',
    execute: 'firstQuestion',
    model: 'gpt-4o',
    llmProvider: 'openai',
    channel: 'webWidget',
    isMainFlow: true,
    webWidget: createWebWidgetConfig(),
    whatsapp: createWhatsappConfig(),
    turnHistoricMessages: 20,
    startStepId: start.id,
    steps: [start, input, gen, end],
    edges: [
      { id: createId('edge'), source: start.id, target: input.id },
      { id: createId('edge'), source: input.id, target: gen.id },
      { id: createId('edge'), source: gen.id, target: end.id },
    ],
  };
}
