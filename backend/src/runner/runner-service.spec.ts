import { RunnerService } from './runner-service';

const createService = () => {
  const canvasFlowService = {
    findOne: jest.fn(),
    resolveAgentRelease: jest.fn().mockResolvedValue({ versions: {}, source: 'none' }),
    resolveFlowVersion: jest.fn((flow) => ({
      config: flow.config,
      source: 'draft',
      latestVersion: Number(flow.latestVersion || 0),
    })),
    resolveFlowVersionAsync: jest.fn(async (flow) => ({
      config: flow.config,
      source: 'draft',
      latestVersion: Number(flow.latestVersion || 0),
    })),
  };
  const httpBatchService = {
    execute: jest.fn().mockResolvedValue({ ok: true }),
  };
  const memoryService = {
    addTurn: jest.fn().mockResolvedValue({}),
    addHistoryTurn: jest.fn().mockResolvedValue({}),
    addTraceTurn: jest.fn().mockResolvedValue({}),
    findRecent: jest.fn().mockResolvedValue([]),
    clearConversation: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
  };
  const ragService = {
    chatLlmRag: jest.fn().mockResolvedValue({ text: 'resposta rag' }),
  };
  const configService = {
    get: jest.fn(() => undefined),
  };
  const providerConfigService = {
    getEffectiveSettings: jest.fn().mockResolvedValue({}),
    toOpenAIRuntimeConfig: jest.fn(() => ({})),
  };
  const flowTagService = {
    record: jest.fn().mockResolvedValue({ tag: 'ok' }),
  };
  const sqsTransitionService = {
    isEnabled: jest.fn(() => false),
    enqueue: jest.fn(),
  };
  const mcpOAuthService = {
    createRuntimeProvider: jest.fn().mockResolvedValue({}),
  };

  const service = new RunnerService(
    canvasFlowService as any,
    httpBatchService as any,
    memoryService as any,
    ragService as any,
    configService as any,
    providerConfigService as any,
    flowTagService as any,
    sqsTransitionService as any,
    mcpOAuthService as any,
  );

  return {
    service,
    canvasFlowService,
    httpBatchService,
    memoryService,
    ragService,
    configService,
    flowTagService,
    sqsTransitionService,
    mcpOAuthService,
  };
};

describe('RunnerService', () => {
  it('runs a simple message flow and waits on input', async () => {
    const { service } = createService();
    const config = {
      title: 'Atendimento',
      steps: [
        { id: 'welcome', type: 'message', title: 'Boas-vindas', instruction: 'Ola {{context.slots.name}}' },
        { id: 'email', type: 'input', title: 'E-mail', instruction: 'Qual e seu e-mail?', responseName: 'email' },
      ],
      edges: [{ id: 'e1', source: 'welcome', target: 'email' }],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-1',
      slots: { name: 'Ana' },
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('email');
    expect(result.ended).toBe(false);
    expect(result.messages.map((message: any) => message.text)).toEqual([
      'Ola Ana',
      'Qual e seu e-mail?',
    ]);
  });

  it('validates input, stores the slot and reaches the end node', async () => {
    const { service, memoryService } = createService();
    const config = {
      title: 'Coleta',
      steps: [
        {
          id: 'email',
          type: 'input',
          title: 'E-mail',
          instruction: 'Qual e seu e-mail?',
          responseName: 'email',
          inputValidationMode: 'type',
          inputValidationType: 'email',
        },
        { id: 'end', type: 'end', title: 'Fim', instruction: 'Recebido: {{context.slots.email}}' },
      ],
      edges: [{ id: 'e1', source: 'email', target: 'end' }],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-2',
      currentStepId: 'email',
      text: 'ana@example.com',
      skipHistory: true,
    });

    expect(result.ended).toBe(true);
    expect(result.slots.email).toBe('ana@example.com');
    expect(result.messages.at(-1)?.text).toBe('Recebido: ana@example.com');
    expect(memoryService.clearConversation).toHaveBeenCalledWith('agent-1', 'conv-2', {
      organizationId: '',
      conversationOwnerId: '',
    });
  });

  it('exposes Contexto fields directly under its response slot', async () => {
    const { service } = createService();
    const config = {
      title: 'Contexto agrupado',
      steps: [
        {
          id: 'context-email',
          type: 'component',
          title: 'Preparar email',
          component: {
            type: 'context',
            responseName: 'email',
            contextMode: 'json',
            contextJson: JSON.stringify({
              subject: 'teste',
              to: 'cliente@example.com',
            }),
          },
        },
        { id: 'end', type: 'end', title: 'Fim', instruction: 'Destino: {{context.slots.email.to}}' },
      ],
      edges: [{ id: 'e1', source: 'context-email', target: 'end' }],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-context-email',
      skipHistory: true,
    });

    expect(result.slots.to).toBe('cliente@example.com');
    expect(result.slots.email.to).toBe('cliente@example.com');
    expect(result.slots.email.payload.to).toBe('cliente@example.com');
    expect(result.messages.at(-1)?.text).toBe('Destino: cliente@example.com');
  });

  it('restores the saved waiting step when currentStepId is omitted', async () => {
    const { service, memoryService } = createService();
    memoryService.findRecent.mockResolvedValueOnce([
      {
        metadata: {
          canvasFlowState: {
            entryFlowId: 'flow-1',
            activeFlowId: 'flow-1',
            currentStepId: 'email',
            slots: { name: 'Ana' },
          },
        },
      },
    ]);
    const config = {
      title: 'Coleta com estado',
      steps: [
        { id: 'welcome', type: 'message', title: 'Boas-vindas', instruction: 'Ola {{context.slots.name}}' },
        {
          id: 'email',
          type: 'input',
          title: 'E-mail',
          instruction: 'Qual e seu e-mail?',
          responseName: 'email',
          inputValidationMode: 'type',
          inputValidationType: 'email',
        },
        { id: 'end', type: 'end', title: 'Fim', instruction: 'Recebido: {{context.slots.email}} de {{context.slots.name}}' },
      ],
      edges: [
        { id: 'e1', source: 'welcome', target: 'email' },
        { id: 'e2', source: 'email', target: 'end' },
      ],
    };

    const result = await service.run({
      config,
      flowId: 'flow-1',
      agentId: 'agent-1',
      conversationId: 'conv-saved-state',
      text: 'ana@example.com',
    });

    expect(result.ended).toBe(true);
    expect(result.slots.name).toBe('Ana');
    expect(result.slots.email).toBe('ana@example.com');
    expect(result.messages.map((message: any) => message.text)).toEqual(['Recebido: ana@example.com de Ana']);
  });

  it('waits instead of looping when a flow jumps back to an already consumed input', async () => {
    const { service } = createService();
    const config = {
      title: 'Loop controlado',
      steps: [
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Digite sua pergunta.', responseName: 'question' },
        { id: 'answer', type: 'message', title: 'Mensagem', instruction: 'Recebi: {{context.slots.question}}' },
      ],
      edges: [
        { id: 'e1', source: 'question', target: 'answer' },
        { id: 'e2', source: 'answer', target: 'question' },
      ],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-loop-input',
      currentStepId: 'question',
      text: 'ola',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('question');
    expect(result.messages.map((message: any) => message.text)).toEqual(['Recebi: ola', 'Digite sua pergunta.']);
    expect(result.trace.some((entry: any) => entry.type === 'interactionWaitPrompt' && entry.stepId === 'question')).toBe(true);
    expect(result.trace.some((entry: any) => entry.type === 'interactionWaitReentry' && entry.targetStepId === 'question')).toBe(true);
  });

  it('ignores a default message jump after a consumed user input', async () => {
    const { service } = createService();
    const config = {
      title: 'Mensagem padrao depois do input',
      steps: [
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Digite sua pergunta.', responseName: 'question' },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Ola. Como posso ajudar?' },
      ],
      edges: [
        { id: 'e1', source: 'question', target: 'message' },
        { id: 'e2', source: 'message', target: 'question' },
      ],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-default-message-after-input',
      currentStepId: 'question',
      text: '05917916179',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('question');
    expect(result.messages.map((message: any) => message.text)).toEqual(['Digite sua pergunta.']);
    expect(result.trace.some((entry: any) => entry.type === 'messagePassthroughSuppressed' && entry.stepId === 'message')).toBe(true);
    expect(result.trace.some((entry: any) => entry.type === 'interactionWaitPrompt' && entry.stepId === 'question')).toBe(true);
  });

  it('keeps waiting on the consumed input when an agent asks a follow-up without an outgoing edge', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'runLlmGenComponent').mockResolvedValue({ text: 'Boa tarde! Por favor, informe seu CPF.' });
    const config = {
      title: 'Agente pergunta proximo dado',
      steps: [
        { id: 'start', type: 'message', title: 'Inicio', instruction: 'Ola. Como posso ajudar?' },
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Aguarde um instante...', responseName: 'pergunta' },
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen' } },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'question' },
        { id: 'e2', source: 'question', target: 'agent' },
      ],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-agent-follow-up-wait',
      currentStepId: 'question',
      text: 'boa tarde',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('question');
    expect(result.messages.map((message: any) => message.text)).toEqual(['Boa tarde! Por favor, informe seu CPF.']);
    expect(result.trace.some((entry: any) => entry.type === 'implicitInteractionWait' && entry.stepId === 'question')).toBe(true);
  });

  it('walks normal jumps until a user input wait node is reached', async () => {
    const { service } = createService();
    const config = {
      title: 'Jump ate input',
      steps: [
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Digite sua pergunta.', responseName: 'question' },
        { id: 'message1', type: 'message', title: 'Mensagem 1', instruction: 'Primeira resposta' },
        { id: 'message2', type: 'message', title: 'Mensagem 2', instruction: 'Ultima mensagem' },
      ],
      edges: [
        { id: 'e1', source: 'question', target: 'message1' },
        { id: 'e2', source: 'message1', target: 'message2' },
        { id: 'e3', source: 'message2', target: 'question' },
      ],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-jump-chain',
      currentStepId: 'question',
      text: 'ola',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('question');
    expect(result.messages.map((message: any) => message.text)).toEqual([
      'Primeira resposta',
      'Ultima mensagem',
      'Digite sua pergunta.',
    ]);
  });

  it('uses the last agent text when a default message node follows the agent', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'runLlmGenComponent').mockResolvedValue({ text: 'Obrigado. Agora informe a data de nascimento.' });
    const config = {
      title: 'Agent message passthrough',
      steps: [
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Digite sua pergunta.', responseName: 'pergunta' },
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen' } },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Ola. Como posso ajudar?' },
      ],
      edges: [
        { id: 'e1', source: 'question', target: 'agent' },
        { id: 'e2', source: 'agent', target: 'message' },
        { id: 'e3', source: 'message', target: 'question' },
      ],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-agent-message',
      currentStepId: 'question',
      text: '05917916179',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('question');
    expect(result.messages.map((message: any) => message.text)).toEqual([
      'Obrigado. Agora informe a data de nascimento.',
    ]);
    expect(result.slots.pergunta).toBe('05917916179');
    expect(result.slots.inputHistory.at(-1).value).toBe('05917916179');
    expect(result.trace.some((entry: any) => entry.type === 'interactionWaitPromptSuppressed' && entry.stepId === 'question')).toBe(true);
  });

  it('defers a default message branch until agent work from the same input finishes', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'runLlmGenComponent').mockResolvedValue({ text: 'Agora, por favor, informe sua data de nascimento.' });
    const config = {
      title: 'Input com ramo de mensagem',
      steps: [
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Aguarde um instante, estou buscando suas informacoes...', responseName: 'pergunta' },
        { id: 'plan', type: 'component', title: 'Agent Plan', component: { type: 'agentPlan' } },
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen', agentExecutionMode: 'hybrid' } },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Ola. Como posso ajudar?' },
      ],
      edges: [
        { id: 'e1', source: 'question', target: 'plan' },
        { id: 'e2', source: 'plan', target: 'agent' },
        { id: 'e3', source: 'question', target: 'message' },
        { id: 'e4', source: 'message', target: 'question' },
      ],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-defer-message',
      currentStepId: 'question',
      text: '05917916179',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('question');
    expect(result.messages.map((message: any) => message.text)).toEqual([
      'Agora, por favor, informe sua data de nascimento.',
    ]);
    expect(result.trace.some((entry: any) => entry.type === 'messagePassthroughSuppressed' && entry.stepId === 'message')).toBe(true);
    expect(result.trace.some((entry: any) => entry.type === 'interactionWaitPromptSuppressed' && entry.stepId === 'question')).toBe(true);
  });

  it('runs a terminal default message in parallel with a debug branch after user input', async () => {
    const { service } = createService();
    const config = {
      title: 'Mensagem e debug em paralelo',
      steps: [
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Aguarde um instante...', responseName: 'question' },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Ola. Como posso ajudar?' },
        { id: 'debug', type: 'component', title: 'Debug', component: { type: 'debug', responseName: 'debug' } },
      ],
      edges: [
        { id: 'e1', source: 'question', target: 'message' },
        { id: 'e2', source: 'question', target: 'debug' },
      ],
    };
    const stepById = new Map(config.steps.map((step) => [step.id, step]));

    expect((service as any).splitDeferredPassthroughMessages(['message', 'debug'], stepById)).toEqual({
      executable: ['message', 'debug'],
      deferred: [],
    });

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-parallel-message-debug',
      currentStepId: 'question',
      text: 'oi',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('question');
    expect(result.messages.map((message: any) => message.text)).toEqual([
      'Ola. Como posso ajudar?',
      'Debug',
    ]);
    expect((result.messages.at(-1) as any)?.kind).toBe('debug');
    expect(result.trace.some((entry: any) => entry.type === 'debug' && entry.stepId === 'debug')).toBe(true);
    expect(result.trace.some((entry: any) => entry.type === 'messagePassthroughSuppressed' && entry.stepId === 'message')).toBe(false);
  });

  it('generates a downloadable document artifact from a files component', async () => {
    const { service, ragService } = createService();
    const createArtifact = jest.fn().mockResolvedValue({
      documentId: 'artifact-1',
      filename: 'resumo.csv',
      downloadPath: '/api/documents/artifact-1/download',
      downloadUrl: 'http://localhost:3333/api/documents/artifact-1/download',
    });
    (service as any).documentsService = { createArtifact };
    ragService.chatLlmRag.mockResolvedValueOnce({ text: 'nome,valor\nContrato,10' });
    const config = {
      title: 'Gerar arquivo',
      steps: [
        {
          id: 'files',
          type: 'component',
          title: 'Documentos',
          component: {
            type: 'files',
            responseName: 'documentos',
            filesOperation: 'generate',
            filesOutputFormat: 'csv',
            filesOutputFilenameTemplate: 'resumo.csv',
            filesUploaded: [{ documentId: 'document-1', filename: 'contrato.txt', text: 'Contrato original' }],
          },
        },
      ],
      edges: [],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-generate-files-artifact',
      skipHistory: true,
    });

    expect(createArtifact).toHaveBeenCalledWith(expect.objectContaining({
      format: 'csv',
      filename: 'resumo.csv',
      content: 'nome,valor\nContrato,10',
    }));
    expect(result.slots.documentos.artifact.documentId).toBe('artifact-1');
    expect(result.messages.at(-1)?.text).toContain('/api/documents/artifact-1/download');
  });

  it('preserves an XLSX template and passes spreadsheet edits instead of publishing an empty CSV', async () => {
    const { service, ragService } = createService();
    const createArtifact = jest.fn().mockResolvedValue({
      documentId: 'artifact-xlsx-1',
      filename: 'artefato.xlsx',
      downloadPath: '/api/documents/artifact-xlsx-1/download',
      downloadUrl: 'http://localhost:3333/api/documents/artifact-xlsx-1/download',
    });
    (service as any).documentsService = { createArtifact };
    ragService.chatLlmRag.mockResolvedValueOnce({
      text: JSON.stringify({
        content: '',
        xlsxEdits: [{
          type: 'append_column',
          sheet: 'Total acumulado',
          header: 'Janeiro',
          keyColumn: 'NOME',
          valuesByKey: { Ana: '10:30' },
          valueType: 'duration',
        }],
      }),
    });
    const config = {
      title: 'Editar XLSX',
      steps: [
        {
          id: 'files',
          type: 'component',
          title: 'Planilha',
          component: {
            type: 'files',
            responseName: 'planilha',
            filesOperation: 'edit',
            filesOutputFormat: 'csv',
            filesOutputFilenameTemplate: 'artefato.csv',
            filesGenerationPrompt: 'Preencha os totais por integrante.',
            filesUploaded: [{
              documentId: 'template-xlsx-1',
              filename: 'horas.xlsx',
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              text: '--- Aba: Total acumulado ---\nNOME,TOTAL (H)\nAna,',
              structure: {
                type: 'xlsx',
                sheets: [{ name: 'Total acumulado', rows: [{ rowNumber: 1, values: ['NOME', 'TOTAL (H)'] }, { rowNumber: 2, values: ['Ana', ''] }] }],
              },
            }],
          },
        },
      ],
      edges: [],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-edit-xlsx-template',
      skipHistory: true,
    });

    expect(createArtifact).toHaveBeenCalledWith(expect.objectContaining({
      format: 'xlsx',
      filename: 'artefato.xlsx',
      templateDocumentId: 'template-xlsx-1',
      parentDocumentId: 'template-xlsx-1',
      xlsxEdits: [{
        type: 'append_column',
        sheet: 'Total acumulado',
        sheetIndex: 0,
        header: 'Janeiro',
        headerRow: 1,
        startRow: 2,
        values: undefined,
        valuesByKey: { Ana: '10:30' },
        keyColumn: 'NOME',
        numberFormat: '',
        valueType: 'duration',
      }],
    }));
    const llmOptions = ragService.chatLlmRag.mock.calls[0][2];
    expect(llmOptions.prompt).toContain('Docs Skill');
    expect(llmOptions.prompt).toContain('Ao editar XLSX');
    expect(llmOptions.contextText).toContain('Inventario para Docs Skill');
    expect(llmOptions.contextText).toContain('Aba 1: Total acumulado');
    expect(llmOptions.contextText).toContain('Linha 2: ["Ana",""]');
    expect(result.slots.planilha.artifact.filename).toBe('artefato.xlsx');
  });

  it('requires an explicit template selection when editing with multiple uploaded files', async () => {
    const { service, ragService } = createService();
    const createArtifact = jest.fn();
    (service as any).documentsService = { createArtifact };
    const config = {
      title: 'Editar com referencias',
      steps: [
        {
          id: 'files',
          type: 'component',
          title: 'Documentos',
          component: {
            type: 'files',
            responseName: 'documentos',
            filesOperation: 'edit',
            filesOutputFormat: 'docx',
            filesUploaded: [
              { documentId: 'template-docx', filename: 'contrato.docx', text: 'Contrato original' },
              { documentId: 'reference-pdf', filename: 'arquitetura.pdf', text: 'Itens de arquitetura' },
            ],
          },
        },
      ],
      edges: [],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-edit-multiple-files-without-template',
      skipHistory: true,
    });

    expect(createArtifact).not.toHaveBeenCalled();
    expect(ragService.chatLlmRag).not.toHaveBeenCalled();
    expect(result.messages.at(-1)?.text).toContain('Marque explicitamente qual documento deve ser usado como template');
    expect(result.messages.at(-1)?.text).toContain('Gerar novo arquivo');
  });

  it('consolidates multiple uploaded files into a generated PDF', async () => {
    const { service, ragService } = createService();
    const createArtifact = jest.fn().mockResolvedValue({
      documentId: 'artifact-pdf-1',
      filename: 'arquitetura-consolidada.pdf',
      downloadPath: '/api/documents/artifact-pdf-1/download',
      downloadUrl: 'http://localhost:3333/api/documents/artifact-pdf-1/download',
    });
    (service as any).documentsService = { createArtifact };
    ragService.chatLlmRag.mockResolvedValueOnce({
      text: JSON.stringify({
        skill: 'documents',
        plan: {
          goal: 'Consolidar arquitetura',
          operation: 'generate',
          format: 'pdf',
          documentType: 'Relatorio tecnico',
          sections: [{ title: 'Resumo executivo', purpose: 'Contextualizar a entrega' }],
          tables: [{ title: 'Responsabilidades', columns: ['Frente', 'Responsavel'] }],
          qualityChecklist: ['Documento possui titulo, secoes e tabela de responsabilidades'],
        },
        content: [
          '# Arquitetura consolidada',
          '',
          '## Responsabilidades',
          '',
          '| Frente | Responsavel |',
          '| --- | --- |',
          '| DOCX | Time tecnico |',
          '| PDF | Arquitetura |',
        ].join('\n'),
      }),
    });
    const config = {
      title: 'Consolidar documentos',
      steps: [
        {
          id: 'files',
          type: 'component',
          title: 'Documentos',
          component: {
            type: 'files',
            responseName: 'documentos',
            filesOperation: 'generate',
            filesOutputFormat: 'pdf',
            filesOutputFilenameTemplate: 'arquitetura-consolidada.pdf',
            filesUploaded: [
              { documentId: 'source-docx', filename: 'alinhamento.docx', text: 'Itens do DOCX' },
              { documentId: 'source-pdf', filename: 'arquitetura.pdf', text: 'Itens do PDF' },
            ],
          },
        },
      ],
      edges: [],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-consolidate-docx-pdf',
      skipHistory: true,
    });

    expect(createArtifact).toHaveBeenCalledWith(expect.objectContaining({
      format: 'pdf',
      filename: 'arquitetura-consolidada.pdf',
      content: expect.stringContaining('| Frente | Responsavel |'),
    }));
    const llmOptions = ragService.chatLlmRag.mock.calls[0][2];
    expect(llmOptions.prompt).toContain('Docs Skill');
    expect(llmOptions.contextText).toContain('Inventario para Docs Skill');
    expect(llmOptions.docs.map((document: any) => document.text)).toEqual(['Itens do DOCX', 'Itens do PDF']);
    expect(result.slots.documentos.documentSkill.plan.goal).toBe('Consolidar arquitetura');
    expect(result.slots.documentos.documentSkill.quality.score).toBeGreaterThanOrEqual(80);
    expect(result.slots.documentos.artifact.documentId).toBe('artifact-pdf-1');
  });

  it('recovers Docs Skill content when the LLM returns malformed JSON instead of publishing the wrapper', async () => {
    const { service, ragService } = createService();
    const createArtifact = jest.fn().mockResolvedValue({
      documentId: 'artifact-pdf-raw-json',
      filename: 'artefato.pdf',
      downloadPath: '/api/documents/artifact-pdf-raw-json/download',
      downloadUrl: 'http://localhost:3333/api/documents/artifact-pdf-raw-json/download',
    });
    (service as any).documentsService = { createArtifact };
    ragService.chatLlmRag.mockResolvedValueOnce({
      text: [
        '{"skill":"documents","plan":{"goal":"Consolidar arquitetura","format":"pdf","tables":[{"title":"Itens"}]},"content":"# Arquitetura consolidada',
        '',
        '## Itens',
        '',
        '| Item | Status |',
        '| --- | --- |',
        '| Webhook | Incluido |","replacements":{}}',
      ].join('\n'),
    });
    const config = {
      title: 'Consolidar documentos com JSON ruim',
      steps: [
        {
          id: 'files',
          type: 'component',
          title: 'Documentos',
          component: {
            type: 'files',
            responseName: 'documentos',
            filesOperation: 'generate',
            filesOutputFormat: 'pdf',
            filesOutputFilenameTemplate: 'artefato.pdf',
            filesUploaded: [
              { documentId: 'source-docx', filename: 'alinhamento.docx', text: 'Itens do DOCX' },
            ],
          },
        },
      ],
      edges: [],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-docs-skill-malformed-json',
      skipHistory: true,
    });

    expect(createArtifact).toHaveBeenCalledWith(expect.objectContaining({
      format: 'pdf',
      content: expect.stringContaining('# Arquitetura consolidada'),
    }));
    expect(createArtifact.mock.calls[0][0].content).not.toContain('"skill"');
    expect(result.slots.documentos.documentSkill.skill).toBe('documents');
    expect(result.slots.documentos.documentSkill.plan.goal).toBe('Consolidar arquitetura');
    expect(result.slots.documentos.documentSkill.quality.checks.hasTablesWhenPlanned).toBe(true);
  });

  it('creates one versioned artifact for each selected files template', async () => {
    const { service } = createService();
    const createArtifact = jest.fn()
      .mockImplementation(async ({ filename, parentDocumentId }) => ({
        documentId: `artifact-${parentDocumentId}`,
        filename,
        downloadPath: `/api/documents/artifact-${parentDocumentId}/download`,
        downloadUrl: `http://localhost:3333/api/documents/artifact-${parentDocumentId}/download`,
      }));
    (service as any).documentsService = { createArtifact };
    const config = {
      title: 'Editar templates',
      steps: [
        {
          id: 'files',
          type: 'component',
          title: 'Documentos',
          component: {
            type: 'files',
            responseName: 'documentos',
            filesOperation: 'edit',
            filesOutputFormat: 'docx',
            filesOutputFilenameTemplate: 'contrato-atualizado.docx',
            filesContentTemplate: 'conteudo pronto',
            filesGenerationPrompt: 'inclua mais uma coluna no final chamada teste com valor teste',
            filesTemplateDocumentIds: ['template-1', 'template-2'],
            filesTemplateValuesJson: '{"cliente.nome":"Ana"}',
            filesUploaded: [
              { documentId: 'template-1', filename: 'contrato-a.docx', text: 'Contrato A' },
              { documentId: 'template-2', filename: 'contrato-b.docx', text: 'Contrato B' },
            ],
          },
        },
      ],
      edges: [],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-edit-multiple-files-templates',
      skipHistory: true,
    });

    expect(createArtifact).toHaveBeenCalledTimes(2);
    expect(createArtifact).toHaveBeenNthCalledWith(1, expect.objectContaining({
      filename: 'contrato-atualizado-1.docx',
      templateDocumentId: 'template-1',
      parentDocumentId: 'template-1',
      docxEdits: [{ type: 'append_table_column', tableIndex: 0, allTables: false, header: 'teste', value: 'teste' }],
    }));
    expect(createArtifact).toHaveBeenNthCalledWith(2, expect.objectContaining({
      filename: 'contrato-atualizado-2.docx',
      templateDocumentId: 'template-2',
      parentDocumentId: 'template-2',
      docxEdits: [{ type: 'append_table_column', tableIndex: 0, allTables: false, header: 'teste', value: 'teste' }],
    }));
    expect(result.slots.documentos.artifacts).toHaveLength(2);
    expect(result.slots.documentos.artifact.documentId).toBe('artifact-template-1');
    expect(result.messages.at(-1)?.text).toContain('contrato-atualizado-2.docx');
  });

  it('rejects an ambiguous DOCX table edit when the template has multiple tables', async () => {
    const { service, ragService } = createService();
    const createArtifact = jest.fn();
    (service as any).documentsService = { createArtifact };
    const config = {
      title: 'Editar tabela sem escolher alvo',
      steps: [
        {
          id: 'files',
          type: 'component',
          title: 'Documentos',
          component: {
            type: 'files',
            responseName: 'documentos',
            filesOperation: 'edit',
            filesOutputFormat: 'docx',
            filesContentTemplate: 'inclua mais uma coluna no final chamada teste com valor teste',
            filesGenerationPrompt: 'inclua mais uma coluna no final chamada teste com valor teste',
            filesUploaded: [{
              documentId: 'template-1',
              filename: 'contrato.docx',
              text: 'Contrato',
              structure: { tables: ['metadados', 'contrato'] },
            }],
          },
        },
      ],
      edges: [],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-edit-ambiguous-docx-table',
      skipHistory: true,
    });

    expect(createArtifact).not.toHaveBeenCalled();
    expect(ragService.chatLlmRag).not.toHaveBeenCalled();
    expect(result.messages.at(-1)?.text).toContain('O DOCX possui 2 tabelas');
    expect(result.messages.at(-1)?.text).toContain('na tabela 3');
  });

  it('passes directly connected files payload and documents to the agent automatically', async () => {
    const { service, ragService } = createService();
    ragService.chatLlmRag.mockResolvedValueOnce({ text: 'Li o contrato conectado.' });
    const config = {
      title: 'Arquivos ligados ao agente',
      steps: [
        {
          id: 'files',
          type: 'component',
          title: 'Documentos',
          component: {
            type: 'files',
            responseName: 'documentos',
            filesUploaded: [{ documentId: 'document-1', filename: 'contrato.txt', text: 'Contrato conectado' }],
          },
        },
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen' } },
      ],
      edges: [{ id: 'e1', source: 'files', target: 'agent' }],
    };

    await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-connected-files-agent',
      slots: {
        outrosDocumentos: {
          mode: 'context',
          documents: [{ text: 'Documento fora da ligacao', title: 'Nao usar' }],
        },
      },
      skipHistory: true,
    });

    expect(ragService.chatLlmRag).toHaveBeenCalledTimes(1);
    const llmOptions = ragService.chatLlmRag.mock.calls[0][2];
    expect(llmOptions.docs.map((document: any) => document.text)).toEqual(['Contrato conectado']);
    expect(llmOptions.contextText).toContain('# Entradas recebidas dos nos conectados');
    expect(llmOptions.contextText).toContain('Contrato conectado');
    expect(llmOptions.contextText).not.toContain('Documento fora da ligacao');
  });

  it('allows an explicit docs path to override documents received from a connected node', async () => {
    const { service, ragService } = createService();
    ragService.chatLlmRag.mockResolvedValueOnce({ text: 'Usei os documentos escolhidos.' });
    const config = {
      title: 'Sobrescrever arquivos ligados',
      steps: [
        {
          id: 'files',
          type: 'component',
          title: 'Documentos',
          component: {
            type: 'files',
            responseName: 'documentos',
            filesUploaded: [{ documentId: 'document-1', filename: 'contrato.txt', text: 'Contrato conectado' }],
          },
        },
        {
          id: 'agent',
          type: 'component',
          title: 'Agente',
          component: { type: 'openaiGen', ragDocsPath: 'context.slots.documentosManuais.documents' },
        },
      ],
      edges: [{ id: 'e1', source: 'files', target: 'agent' }],
    };

    await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-explicit-files-agent',
      slots: {
        documentosManuais: {
          documents: [{ text: 'Documento escolhido explicitamente', title: 'Manual' }],
        },
      },
      skipHistory: true,
    });

    const llmOptions = ragService.chatLlmRag.mock.calls[0][2];
    expect(llmOptions.docs.map((document: any) => document.text)).toEqual(['Documento escolhido explicitamente']);
  });

  it('passes configured conversation turns to the agent tool planner in chronological order', async () => {
    const { service, memoryService, ragService } = createService();
    memoryService.findRecent.mockResolvedValueOnce([
      { role: 'user', content: 'bom dia', metadata: { kind: 'message' } },
      { role: 'assistant', content: 'Por favor, informe seu CPF.', metadata: { kind: 'message' } },
      { role: 'user', content: '05917916179', metadata: { kind: 'message' } },
      { role: 'system', content: 'canvas_flow_state', metadata: { kind: 'canvas_flow_state' } },
      { role: 'assistant', content: 'Agora informe a data de nascimento.', metadata: { kind: 'message' } },
      { role: 'user', content: '19/03/1995', metadata: { kind: 'message' } },
    ]);
    const planSpy = jest.spyOn(service as any, 'planAgentAutoTools').mockResolvedValue({
      plan: [{ action: 'final', reason: 'Ainda coletando dados.' }],
      raw: {},
      reason: 'Ainda coletando dados.',
    });
    const config = {
      title: 'Memoria no planner',
      turnHistoricMessages: 60,
      agentSpec: {
        mcpServers: [{ id: 'mcp-login', name: 'MCP_LOGIN', targetStepId: 'mcp-login' }],
      },
      steps: [
        {
          id: 'agent',
          type: 'component',
          title: 'Agente',
          component: { type: 'openaiGen', agentExecutionMode: 'auto_tools', agentMaxToolCalls: 1 },
        },
        { id: 'mcp-login', type: 'component', title: 'MCP_LOGIN', component: { type: 'mcp' } },
      ],
      edges: [],
    };

    await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-memory-turns',
      currentStepId: 'agent',
      text: '19/03/1995',
      skipHistory: true,
    });

    expect(memoryService.findRecent).toHaveBeenCalledWith('agent-1', 'conv-memory-turns', 60, {
      organizationId: '',
      conversationOwnerId: '',
    });
    const plannerPayload = planSpy.mock.calls[0][0] as any;
    expect(plannerPayload.conversationTurns).toEqual([
      { role: 'user', content: 'bom dia' },
      { role: 'assistant', content: 'Por favor, informe seu CPF.' },
      { role: 'user', content: '05917916179' },
      { role: 'assistant', content: 'Agora informe a data de nascimento.' },
      { role: 'user', content: '19/03/1995' },
    ]);
    expect(ragService.chatLlmRag.mock.calls[0][2].turnHistoricMessages).toBe(60);
  });

  it('inherits MCP input schemas from canvas target steps before executing agent tools', () => {
    const { service } = createService();
    const config = {
      title: 'Contrato MCP via canvas',
      agentSpec: {
        mcpServers: [
          {
            id: 'canvas-mcp:login',
            name: 'MCP_LOGIN',
            targetStepId: 'mcp-login',
          },
        ],
      },
      steps: [
        {
          id: 'mcp-login',
          type: 'component',
          title: 'MCP_LOGIN',
          component: {
            type: 'mcp',
            mcpInputSchema: JSON.stringify({
              type: 'object',
              properties: {
                cpf: { type: 'string' },
                data_nascimento: { type: 'string' },
              },
              required: ['cpf', 'data_nascimento'],
            }),
            mcpOutputSchema: JSON.stringify({
              type: 'object',
              properties: { user: { type: 'object' } },
              required: ['user'],
            }),
          },
        },
      ],
      edges: [],
    };

    const tools = (service as any).buildAgentAutoToolCatalog(config);
    const validation = (service as any).validateAgentToolArguments(tools[0], { cpf: '05917916179' });

    expect(tools[0].inputSchema.required).toEqual(['cpf', 'data_nascimento']);
    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain('arguments.data_nascimento e obrigatorio');
  });

  it('validates MCP auto tool contracts against the normalized payload inside the execution envelope', () => {
    const { service } = createService();
    const validation = (service as any).validateAgentToolOutput(
      {
        outputSchema: {
          type: 'object',
          properties: { agendamentos: { type: 'array' } },
          required: ['agendamentos'],
        },
      },
      {
        mode: 'api',
        output: {
          agendamentos: [
            { agendamentoId: '5678990', data: '27/05' },
            { agendamentoId: '776545', data: '28/05' },
          ],
        },
        latest: { data: { agendamentos: [] } },
      },
    );

    expect(validation.ok).toBe(true);
    expect(validation.outputPath).toBe('output.output');
  });

  it('uses compact tool manifests for planning and reads the full contract only to prepare selected tool arguments', async () => {
    const { service } = createService();
    const tool = {
      id: 'canvas-mcp:login',
      name: 'MCP_LOGIN',
      description: 'Autentica o cliente quando CPF e data de nascimento estiverem disponiveis.',
      executable: true,
      executableType: 'canvas_step',
      sourceType: 'mcp',
      targetStepId: 'mcp-login',
      inputSchema: {
        type: 'object',
        properties: {
          cpf: { type: 'string', description: 'CPF do cliente' },
          data_nascimento: { type: 'string', description: 'Data de nascimento do cliente' },
        },
        required: ['cpf', 'data_nascimento'],
      },
      outputSchema: {
        type: 'object',
        properties: { user: { type: 'object' } },
        required: ['user'],
      },
    };
    const compact = (service as any).agentToolCompactManifestForLlm(tool);

    expect(compact.inputSchema).toBeUndefined();
    expect(compact.outputSchema).toBeUndefined();
    expect(compact.requiredInputKeys).toEqual(['cpf', 'data_nascimento']);

    const createMock = jest.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            arguments: { cpf: '05917916179', data_nascimento: '19/03/1995' },
            reason: 'Campos encontrados no contexto.',
          }),
        },
      }],
    });
    jest.spyOn(service as any, 'getOpenAIClientForProvider').mockResolvedValue({
      chat: { completions: { create: createMock } },
    });
    jest.spyOn(service as any, 'getChatModelForProvider').mockResolvedValue('gpt-test');

    const prepared = await (service as any).prepareAgentToolArgumentsWithContract({
      step: { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen' } },
      config: { title: 'Fluxo', model: 'gpt-test', steps: [], edges: [] },
      context: { slots: { cpf: '05917916179', data_nascimento: '19/03/1995' } },
      query: '19/03/1995',
      prompt: 'Use MCP_LOGIN quando tiver CPF e data de nascimento.',
      provider: 'openai',
      model: 'gpt-test',
      tool,
      choice: { toolId: tool.id, arguments: {} },
      rawArgs: {},
      observations: [],
      conversationTurns: [],
    });

    expect(prepared.generated).toBe(true);
    expect(prepared.validation.ok).toBe(true);
    expect(prepared.arguments).toEqual({ cpf: '05917916179', data_nascimento: '19/03/1995' });
    const userPayload = JSON.parse(createMock.mock.calls[0][0].messages.at(-1).content);
    expect(userPayload.selectedTool.inputSchema.required).toEqual(['cpf', 'data_nascimento']);
   });

  it('does not repair direct MCP triggers when the generic input cannot satisfy required arguments', () => {
    const { service } = createService();
    const tools = [
      {
        id: 'canvas-mcp:detalhes',
        name: 'MCP_API_CONSULTA_AGENDAMENTO',
        description: 'Consulta detalhes de um agendamento especifico usando agendamentoId.',
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'mcp',
        targetStepId: 'detalhes',
        inputSchema: {
          type: 'object',
          properties: { agendamentoId: { type: 'string' } },
          required: ['agendamentoId'],
        },
      },
    ];

    const repaired = (service as any).repairAgentPlanCoverage(
      'consultar meus agendamentos',
      [],
      tools,
      3,
    );

    expect(repaired.plan).toEqual([]);
  });

  it('does not block generic appointment list requests as ungrounded detail answers', () => {
    const { service } = createService();
    const config = {
      title: 'Consulta de agendamentos',
      agentSpec: {
        mcpServers: [{ id: 'canvas-mcp:detalhes', name: 'MCP_API_CONSULTA_AGENDAMENTO', targetStepId: 'detalhes' }],
      },
      steps: [
        {
          id: 'detalhes',
          type: 'component',
          title: 'MCP_API_CONSULTA_AGENDAMENTO',
          instruction: 'Retorna detalhes de um agendamento especifico com o agendamentoId.',
          component: {
            type: 'mcp',
            mcpInputSchema: JSON.stringify({
              type: 'object',
              properties: { agendamentoId: { type: 'string' } },
              required: ['agendamentoId'],
            }),
          },
        },
      ],
      edges: [],
    };

    expect((service as any).shouldBlockUngroundedAppointmentFinal('consultar meus agendamentos', config, { slots: {} })).toBe(false);
    expect((service as any).shouldBlockUngroundedAppointmentFinal('quero detalhes do agendamento', config, { slots: {} })).toBe(true);
  });

  it('repairs a final planner decision into an appointment detail tool call for numeric selections', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'planAgentAutoTools').mockResolvedValue({
      plan: [{ action: 'final', reason: 'Responder com base no historico.' }],
      raw: {},
      reason: 'Responder com base no historico.',
    });
    const executeSpy = jest.spyOn(service as any, 'executeAgentAutoTool').mockResolvedValue({
      toolId: 'canvas-mcp:detalhes',
      toolName: 'MCP_API_CONSULTA_AGENDAMENTO',
      sourceType: 'mcp',
      executableType: 'canvas_step',
      targetStepId: 'detalhes',
      status: 'completed',
      output: { detalhesAgendamento: { agendamentoId: '5678990' } },
    });
    const config = {
      title: 'Selecao de agendamento',
      agentSpec: {
        mcpServers: [{ id: 'canvas-mcp:detalhes', name: 'MCP_API_CONSULTA_AGENDAMENTO', targetStepId: 'detalhes' }],
      },
      steps: [
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen', agentExecutionMode: 'auto_tools', queryTemplate: '{{context.slots.pergunta}}' } },
        {
          id: 'detalhes',
          type: 'component',
          title: 'MCP_API_CONSULTA_AGENDAMENTO',
          instruction: 'Retorna detalhes de um agendamento especifico com o agendamentoId.',
          component: {
            type: 'mcp',
            responseName: 'mcp_detalhes_agendamento',
            mcpInputSchema: JSON.stringify({
              type: 'object',
              properties: { agendamentoId: { type: 'string' } },
              required: ['agendamentoId'],
            }),
          },
        },
      ],
      edges: [],
    };
    const context: any = {
      agentId: 'agent-1',
      conversationId: 'conv-appointment-selection',
      slots: {
        mcp_agendamentos: {
          output: {
            agendamentos: [
              { agendamentoId: '5678990', unidade: 'Unidade A' },
              { agendamentoId: '776545', unidade: 'Unidade B' },
            ],
          },
        },
      },
    };

    const result = await (service as any).runAgentAutoToolsIfEnabled(config.steps[0], config, context, {
      query: '1',
      prompt: 'Consulte detalhes quando o usuario escolher um agendamento.',
      provider: 'openai',
      model: 'gpt-4o',
      conversationTurns: [],
    });

    expect(executeSpy).toHaveBeenCalled();
    expect(executeSpy.mock.calls[0][1]).toEqual({ agendamentoId: '5678990' });
    expect(result.observations[0].toolId).toBe('canvas-mcp:detalhes');
    expect(result.tracePrefix.some((entry: any) => entry.type === 'agentPlan' && entry.contextualRepair?.repairedFromSelection)).toBe(true);
  });

  it('repairs numeric selections into generic entity detail tool calls', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'planAgentAutoTools').mockResolvedValue({
      plan: [{ action: 'final', reason: 'Responder com base no historico.' }],
      raw: {},
      reason: 'Responder com base no historico.',
    });
    const executeSpy = jest.spyOn(service as any, 'executeAgentAutoTool').mockResolvedValue({
      toolId: 'canvas-mcp:pedido-detalhe',
      toolName: 'MCP_DETALHE_PEDIDO',
      sourceType: 'mcp',
      executableType: 'canvas_step',
      targetStepId: 'pedido-detalhe',
      status: 'completed',
      output: { detalhesPedido: { pedidoId: 'PED-2' } },
    });
    const config = {
      title: 'Selecao generica',
      agentSpec: {
        mcpServers: [{ id: 'canvas-mcp:pedido-detalhe', name: 'MCP_DETALHE_PEDIDO', targetStepId: 'pedido-detalhe' }],
      },
      steps: [
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen', agentExecutionMode: 'auto_tools', queryTemplate: '{{context.slots.pergunta}}' } },
        {
          id: 'pedido-detalhe',
          type: 'component',
          title: 'MCP_DETALHE_PEDIDO',
          instruction: 'Retorna detalhes de um pedido especifico com o pedidoId.',
          component: {
            type: 'mcp',
            responseName: 'mcp_detalhes_pedido',
            mcpInputSchema: JSON.stringify({
              type: 'object',
              properties: { pedidoId: { type: 'string' } },
              required: ['pedidoId'],
            }),
          },
        },
      ],
      edges: [],
    };
    const context: any = {
      agentId: 'agent-1',
      conversationId: 'conv-generic-selection',
      slots: {
        pedidos: [
          { pedidoId: 'PED-1', nome: 'Pedido A' },
          { pedidoId: 'PED-2', nome: 'Pedido B' },
        ],
      },
    };

    const result = await (service as any).runAgentAutoToolsIfEnabled(config.steps[0], config, context, {
      query: '2',
      prompt: 'Consulte detalhes quando o usuario escolher um item.',
      provider: 'openai',
      model: 'gpt-4o',
      conversationTurns: [],
    });

    expect(executeSpy).toHaveBeenCalled();
    expect(executeSpy.mock.calls[0][1]).toEqual({ pedidoId: 'PED-2' });
    expect(result.observations[0].toolId).toBe('canvas-mcp:pedido-detalhe');
  });

  it('blocks ungrounded appointment final answers when no detail tool ran successfully', async () => {
    const { service, ragService } = createService();
    jest.spyOn(service as any, 'runAgentAutoToolsIfEnabled').mockResolvedValue({
      observations: [],
      tracePrefix: [{ type: 'agentAutoTools', choice: { action: 'final' } }],
      messages: [],
      state: { status: 'final' },
    });
    const config = {
      title: 'Bloqueio de detalhe inventado',
      agentSpec: {
        mcpServers: [{ id: 'canvas-mcp:detalhes', name: 'MCP_API_CONSULTA_AGENDAMENTO', targetStepId: 'detalhes' }],
      },
      steps: [
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen', agentExecutionMode: 'auto_tools', queryTemplate: '{{context.slots.pergunta}}' } },
        {
          id: 'detalhes',
          type: 'component',
          title: 'MCP_API_CONSULTA_AGENDAMENTO',
          instruction: 'Retorna detalhes de um agendamento especifico com o agendamentoId.',
          component: {
            type: 'mcp',
            responseName: 'mcp_detalhes_agendamento',
            mcpInputSchema: JSON.stringify({
              type: 'object',
              properties: { agendamentoId: { type: 'string' } },
              required: ['agendamentoId'],
            }),
          },
        },
      ],
      edges: [],
    };
    const context: any = {
      agentId: 'agent-1',
      conversationId: 'conv-block-hallucination',
      slots: {
        pergunta: '1',
        mcp_agendamentos: {
          output: {
            agendamentos: [{ agendamentoId: '5678990', unidade: 'Unidade A' }],
          },
        },
      },
    };

    const result = await (service as any).runLlmGenComponent(config.steps[0], config, context);

    expect(result.text).toContain('Nao consegui obter os detalhes');
    expect(result.trace.some((entry: any) => entry.type === 'agentFinalGroundingBlocked')).toBe(true);
    expect(ragService.chatLlmRag).not.toHaveBeenCalled();
  });

  it('runs ready parallel nodes then stops when a branch reaches user input', async () => {
    const { service } = createService();
    const config = {
      title: 'Paralelo com espera',
      steps: [
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Digite sua pergunta.', responseName: 'question' },
        { id: 'branchA', type: 'message', title: 'Ramo A', instruction: 'Ramo A' },
        { id: 'branchB', type: 'message', title: 'Ramo B', instruction: 'Ramo B' },
        { id: 'afterB', type: 'message', title: 'Depois B', instruction: 'Nao deve rodar depois da espera' },
      ],
      edges: [
        { id: 'e1', source: 'question', target: 'branchA' },
        { id: 'e2', source: 'question', target: 'branchB' },
        { id: 'e3', source: 'branchA', target: 'question' },
        { id: 'e4', source: 'branchB', target: 'afterB' },
      ],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-parallel-wait',
      currentStepId: 'question',
      text: 'ola',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('question');
    expect(result.messages.map((message: any) => message.text)).toEqual([
      'Ramo A',
      'Ramo B',
      'Digite sua pergunta.',
    ]);
  });

  it('still prompts the next input when collecting multiple fields in sequence', async () => {
    const { service } = createService();
    const config = {
      title: 'Coleta sequencial',
      steps: [
        { id: 'name', type: 'input', title: 'Nome', instruction: 'Qual e seu nome?', responseName: 'name' },
        { id: 'email', type: 'input', title: 'E-mail', instruction: 'Qual e seu e-mail?', responseName: 'email' },
      ],
      edges: [{ id: 'e1', source: 'name', target: 'email' }],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-sequential-inputs',
      currentStepId: 'name',
      text: 'Ana',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('email');
    expect(result.slots.name).toBe('Ana');
    expect(result.messages.map((message: any) => message.text)).toEqual(['Qual e seu e-mail?']);
  });

  it('stops the run as soon as any branch waits for user interaction', async () => {
    const { service } = createService();
    const config = {
      title: 'Pausa em ramo',
      steps: [
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Digite sua pergunta.', responseName: 'question' },
        { id: 'answer', type: 'message', title: 'Resposta', instruction: 'Respondido' },
        { id: 'after', type: 'message', title: 'Depois', instruction: 'Nao deveria rodar agora' },
      ],
      edges: [
        { id: 'e1', source: 'question', target: 'answer' },
        { id: 'e2', source: 'answer', target: 'question' },
        { id: 'e3', source: 'answer', target: 'after' },
      ],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-branch-wait',
      currentStepId: 'question',
      text: 'ola',
      skipHistory: true,
    });

    expect(result.currentStepId).toBe('question');
    expect(result.messages.map((message: any) => message.text)).toEqual(['Respondido', 'Digite sua pergunta.']);
  });

  it('blocks accidental message self-loops unless a loop component controls them', async () => {
    const { service } = createService();
    const config = {
      title: 'Mensagem em ciclo',
      steps: [
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Uma vez' },
      ],
      edges: [
        { id: 'e1', source: 'message', target: 'message' },
      ],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-message-loop',
      skipHistory: true,
    });

    expect(result.messages.map((message: any) => message.text)).toEqual(['Uma vez']);
    expect(result.trace.some((entry: any) => entry.type === 'stepRevisitBlocked' && entry.targetStepId === 'message')).toBe(true);
  });

  it('runs MCP canvas auto tools without following canvas edges', async () => {
    const { service, httpBatchService } = createService();
    const config = {
      title: 'MCP tool only',
      steps: [
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen' } },
        {
          id: 'mcp',
          type: 'component',
          title: 'MCP_API_TESTE',
          component: {
            type: 'mcp',
            responseName: 'mcp',
            mcpMode: 'api',
            mcpApiCallMode: 'multi',
            mcpApiExecute: false,
            mcpApiRequestsJson: JSON.stringify([
              { id: 'req1', method: 'GET', url: 'https://example.test/{{context.input}}' },
            ]),
          },
        },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Nao deveria rodar como parte da tool' },
      ],
      edges: [{ id: 'e1', source: 'mcp', target: 'message' }],
    };
    const context: any = {
      agentId: 'agent-1',
      channel: 'webWidget',
      conversationId: 'conv-mcp-tool',
      flowId: 'flow-1',
      flowName: 'Fluxo',
      entryFlowId: 'flow-1',
      now: '2026-05-24T00:00:00.000Z',
      slots: {},
      approvals: {},
    };

    const result = await (service as any).executeAgentAutoTool(
      {
        id: 'canvas-mcp:mcp',
        name: 'MCP_API_TESTE',
        sourceType: 'mcp',
        executableType: 'canvas_step',
        targetStepId: 'mcp',
      },
      { input: 'teste' },
      config.steps[0],
      config,
      context,
      'teste',
    );

    expect(result.canvasFollowMode).toBe('tool_only');
    expect(result.trace.map((entry: any) => entry.stepId)).toEqual(['mcp']);
    expect(result.output.apiResult.pending).toBe(true);
    expect(result.output.requests[0].url).toBe('https://example.test/teste');
    expect(context.slots.mcp).toBeDefined();
    expect(httpBatchService.execute).not.toHaveBeenCalled();
  });

  it('runs agent canvas auto tools without following canvas edges', async () => {
    const { service, ragService } = createService();
    ragService.chatLlmRag.mockResolvedValueOnce({ text: 'Resumo feito' });
    const config = {
      title: 'Agent tool only',
      steps: [
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen' } },
        {
          id: 'skill',
          type: 'component',
          title: 'skill_resume_texto',
          component: {
            type: 'openaiGen',
            responseName: 'skill_resume_texto',
            agentExecutionMode: 'auto_tools',
          },
        },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Nao deveria rodar como parte da tool' },
      ],
      edges: [{ id: 'e1', source: 'skill', target: 'message' }],
    };
    const context: any = {
      agentId: 'agent-1',
      channel: 'webWidget',
      conversationId: 'conv-agent-tool',
      flowId: 'flow-1',
      flowName: 'Fluxo',
      entryFlowId: 'flow-1',
      now: '2026-05-24T00:00:00.000Z',
      slots: { userInput: 'input original do orquestrador' },
      approvals: {},
    };

    const result = await (service as any).executeAgentAutoTool(
      {
        id: 'canvas:skill',
        name: 'skill_resume_texto',
        sourceType: 'subagent',
        executableType: 'canvas_step',
        targetStepId: 'skill',
      },
      { input: 'resuma teste' },
      config.steps[0],
      config,
      context,
      'resuma teste',
    );

    expect(result.canvasFollowMode).toBe('tool_only');
    expect(result.output.text).toBe('Resumo feito');
    expect(result.trace.map((entry: any) => entry.stepId)).toEqual(['skill']);
    expect(ragService.chatLlmRag.mock.calls[0][0]).toBe('resuma teste');
    expect(context.slots.userInput).toBe('input original do orquestrador');
    expect(context.slots.skill_resume_texto.text).toBe('Resumo feito');
  });

  it('allows a subagent tool to call its selected MCP tools', async () => {
    const { service, ragService } = createService();
    jest.spyOn(service as any, 'planAgentAutoTools').mockResolvedValue({
      plan: [{
        action: 'tool',
        toolId: 'canvas-mcp:mcp',
        arguments: { input: 'consulta interna' },
        reason: 'Subagent precisa consultar o MCP selecionado.',
        validTool: true,
      }],
      raw: {},
      reason: 'Usar MCP interno.',
    });
    ragService.chatLlmRag.mockResolvedValueOnce({ text: 'Subagent respondeu com dados' });
    const config = {
      title: 'Subagent nested tools',
      agentSpec: {
        mcpServers: [{ id: 'canvas-mcp:mcp', name: 'MCP_INTERNO', targetStepId: 'mcp' }],
      },
      steps: [
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen' } },
        {
          id: 'subagent',
          type: 'component',
          title: 'Subagent',
          component: {
            type: 'openaiGen',
            responseName: 'subagent',
            agentRole: 'subagent',
            agentExecutionMode: 'auto_tools',
            agentUseWorkspaceCatalog: true,
            agentManifest: { mcpServers: [{ id: 'canvas-mcp:mcp' }] },
          },
        },
        {
          id: 'mcp',
          type: 'component',
          title: 'MCP_INTERNO',
          component: {
            type: 'mcp',
            responseName: 'mcp',
            mcpMode: 'api',
            mcpApiCallMode: 'multi',
            mcpApiExecute: false,
            mcpApiRequestsJson: JSON.stringify([
              { id: 'req1', method: 'GET', url: 'https://example.test/{{context.input}}' },
            ]),
          },
        },
      ],
      edges: [],
    };
    const context: any = {
      agentId: 'agent-1',
      channel: 'webWidget',
      conversationId: 'conv-subagent-nested',
      flowId: 'flow-1',
      flowName: 'Fluxo',
      entryFlowId: 'flow-1',
      now: '2026-05-24T00:00:00.000Z',
      slots: { userInput: 'pedido original' },
      approvals: {},
    };

    const result = await (service as any).executeAgentAutoTool(
      {
        id: 'canvas:subagent',
        name: 'Subagent',
        sourceType: 'subagent',
        executableType: 'canvas_step',
        targetStepId: 'subagent',
      },
      { input: 'delegar ao subagent' },
      config.steps[0],
      config,
      context,
      'delegar ao subagent',
    );

    expect(result.output.text).toBe('Subagent respondeu com dados');
    expect(result.output.autoTools[0].targetStepId).toBe('mcp');
    expect(result.output.autoTools[0].output.requests[0].url).toBe('https://example.test/consulta interna');
    expect(context.slots.mcp).toBeDefined();
    expect(context.slots.agentAutoTools).toBeUndefined();
  });

  it('blocks cyclic subagent auto-tool calls', async () => {
    const { service } = createService();
    const config = {
      title: 'Cycle',
      steps: [
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen' } },
        { id: 'subagent', type: 'component', title: 'Subagent', component: { type: 'openaiGen', agentRole: 'subagent', agentExecutionMode: 'auto_tools' } },
      ],
      edges: [],
    };
    const context: any = {
      agentId: 'agent-1',
      conversationId: 'conv-cycle',
      agentToolPath: ['agent', 'subagent'],
      slots: {},
    };

    await expect((service as any).executeAgentAutoTool(
      {
        id: 'canvas:subagent',
        name: 'Subagent',
        sourceType: 'subagent',
        executableType: 'canvas_step',
        targetStepId: 'subagent',
      },
      { input: 'loop' },
      config.steps[0],
      config,
      context,
      'loop',
    )).rejects.toThrow('ciclo agentico');
  });

  it('stores agent tool outputs under stable aliases for downstream messages', async () => {
    const { service, ragService } = createService();
    ragService.chatLlmRag.mockResolvedValueOnce({ text: 'Hi' });
    const config = {
      title: 'Agent tool alias',
      steps: [
        { id: 'agent', type: 'component', title: 'Agente', component: { type: 'openaiGen' } },
        {
          id: 'translator',
          type: 'component',
          title: 'skill_tradutor',
          component: {
            type: 'openaiGen',
            responseName: 'agente',
          },
        },
      ],
      edges: [],
    };
    const context: any = {
      agentId: 'agent-1',
      channel: 'webWidget',
      conversationId: 'conv-agent-tool-alias',
      flowId: 'flow-1',
      flowName: 'Fluxo',
      entryFlowId: 'flow-1',
      now: '2026-05-24T00:00:00.000Z',
      slots: { userInput: 'traduza oi' },
      approvals: {},
    };

    await (service as any).executeAgentAutoTool(
      {
        id: 'canvas:translator',
        name: 'skill_tradutor',
        sourceType: 'subagent',
        executableType: 'canvas_step',
        targetStepId: 'translator',
      },
      { text: 'oi' },
      config.steps[0],
      config,
      context,
      'teste, traduza oi para ingles',
    );

    expect(ragService.chatLlmRag.mock.calls[0][0]).toBe('oi');
    expect(context.slots.userInput).toBe('traduza oi');
    expect(context.slots.skill_tradutor.text).toBe('Hi');
    expect(context.slots.agentToolResults.skill_tradutor.text).toBe('Hi');
    const debugClone = (service as any).cloneJsonSafe(context.slots);
    expect(debugClone.skill_tradutor).not.toBe('[Circular]');
    expect(debugClone.agentToolResults.skill_tradutor).not.toBe('[Circular]');
  });

  it('resumes after called tools when the agent runs in auto_tools mode', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'runLlmGenComponent').mockResolvedValue({ text: 'waiting=true' });
    const config = {
      title: 'Auto tools resume',
      steps: [
        {
          id: 'agent',
          type: 'component',
          title: 'Agente',
          component: { type: 'openaiGen', agentExecutionMode: 'auto_tools' },
        },
        { id: 'mcp', type: 'component', title: 'MCP', component: { type: 'mcp' } },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Final' },
      ],
      edges: [{ id: 'e1', source: 'mcp', target: 'message' }],
    };
    const context: any = {
      slots: {
        agentAutoTools: [
          { toolId: 'canvas-mcp:mcp', targetStepId: 'mcp', status: 'completed' },
        ],
      },
    };
    const messages: any[] = [];
    const trace: any[] = [];

    const result = await (service as any).runStep(config.steps[0], config, context, messages, trace);

    expect(result.outgoing).toEqual(['message']);
    expect(messages).toEqual([]);
    expect(trace.some((entry) => entry.type === 'agentToolDownstreamResume' && entry.resumedTargets.includes('message'))).toBe(true);
  });

  it('resumes all called tool branches once when multiple tools are selected', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'runLlmGenComponent').mockResolvedValue({
      text: 'ok',
      autoTools: [
        { toolId: 'canvas:skill1', targetStepId: 'skill1', status: 'completed' },
        { toolId: 'canvas:skill2', targetStepId: 'skill2', status: 'completed' },
        { toolId: 'canvas-mcp:mcp', targetStepId: 'mcp', status: 'completed' },
      ],
    });
    const config = {
      title: 'Multi tools',
      steps: [
        {
          id: 'agent',
          type: 'component',
          title: 'Agente',
          component: { type: 'openaiGen', agentExecutionMode: 'auto_tools' },
        },
        { id: 'skill1', type: 'component', title: 'skill_resume_texto', component: { type: 'openaiGen' } },
        { id: 'skill2', type: 'component', title: 'skill_tradutor', component: { type: 'openaiGen' } },
        { id: 'mcp', type: 'component', title: 'MCP_API_TESTE', component: { type: 'mcp' } },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Mensagem final' },
        { id: 'messageCopy', type: 'message', title: 'Mensagem copia', instruction: 'Mensagem copia final' },
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Digite sua pergunta.', responseName: 'question' },
      ],
      edges: [
        { id: 'e0', source: 'question', target: 'agent' },
        { id: 'e1', source: 'skill1', target: 'message' },
        { id: 'e2', source: 'skill2', target: 'message' },
        { id: 'e3', source: 'mcp', target: 'messageCopy' },
        { id: 'e4', source: 'message', target: 'question' },
        { id: 'e5', source: 'messageCopy', target: 'question' },
      ],
    };
    const context: any = { slots: {} };
    const messages: any[] = [];
    const trace: any[] = [];

    const agentResult = await (service as any).runStep(config.steps[0], config, context, messages, trace);
    expect(agentResult.outgoing.sort()).toEqual(['message', 'messageCopy'].sort());

    const runResult = await service.run({
      config,
      conversationId: 'conv-multi-tools',
      currentStepId: 'question',
      text: 'resuma teste e traduza',
      skipHistory: true,
    });

    expect(runResult.currentStepId).toBe('question');
    expect(runResult.messages.map((message: any) => message.text).sort()).toEqual([
      'Digite sua pergunta.',
      'Mensagem copia final',
      'Mensagem final',
    ].sort());
  });

  it('repairs a composite agent plan to include matching skill and mcp tools', () => {
    const { service } = createService();
    const tools = [
      {
        id: 'canvas:skill-resume',
        name: 'skill_resume_texto',
        description: 'Agente especializado em resumir textos.',
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'subagent',
        targetStepId: 'skill-resume',
      },
      {
        id: 'canvas:skill-tradutor',
        name: 'skill_tradutor',
        description: 'Agente especializado em traduzir textos para ingles.',
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'subagent',
        targetStepId: 'skill-tradutor',
      },
      {
        id: 'canvas-mcp:mcp-teste',
        name: 'MCP_API_TESTE',
        description: "Caso o input do cliente seja 'teste' chame esse MCP.",
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'mcp',
        targetStepId: 'mcp-teste',
      },
    ];

    const repaired = (service as any).repairAgentPlanCoverage(
      'teste, traduza oi para ingles e resuma esse input',
      [
        {
          action: 'tool',
          toolId: 'canvas-mcp:mcp-teste',
          arguments: { input: 'teste' },
          reason: 'O input contem teste.',
          validTool: true,
        },
      ],
      tools,
    );

    expect(repaired.repaired).toBe(true);
    expect(repaired.validation.ok).toBe(true);
    expect(repaired.plan.map((item: any) => item.toolId).sort()).toEqual([
      'canvas-mcp:mcp-teste',
      'canvas:skill-resume',
      'canvas:skill-tradutor',
    ].sort());
    const translatorPlan = repaired.plan.find((item: any) => item.toolId === 'canvas:skill-tradutor');
    expect(translatorPlan.arguments.task).toBe('Traduzir o texto conforme solicitado.');
    expect(translatorPlan.arguments.text).toBe('oi');
  });

  it('adds task and scopes translation text when the planner sends only the full input', () => {
    const { service } = createService();
    const tools = [
      {
        id: 'canvas:skill-tradutor',
        name: 'skill_tradutor',
        description: 'Agente especializado em traduzir textos para ingles.',
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'subagent',
        targetStepId: 'skill-tradutor',
      },
    ];

    const sanitized = (service as any).sanitizeAgentPlan(
      [
        {
          action: 'tool',
          toolId: 'canvas:skill-tradutor',
          arguments: { text: 'teste, traduza oi para ingles e resuma esse input' },
          reason: 'O pedido inclui traducao.',
          validTool: true,
        },
      ],
      tools,
      'teste, traduza oi para ingles e resuma esse input',
    );

    expect(sanitized[0].arguments.task).toBe('Traduzir o texto conforme solicitado.');
    expect(sanitized[0].arguments.text).toBe('oi');
  });

  it('repairs a composite agent plan to include an mcp trigger omitted by the planner', () => {
    const { service } = createService();
    const tools = [
      {
        id: 'canvas:skill-resume',
        name: 'skill_resume_texto',
        description: 'Agente especializado em resumir textos.',
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'subagent',
        targetStepId: 'skill-resume',
      },
      {
        id: 'canvas:skill-tradutor',
        name: 'skill_tradutor',
        description: 'Agente especializado em traduzir textos para ingles.',
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'subagent',
        targetStepId: 'skill-tradutor',
      },
      {
        id: 'canvas-mcp:mcp-teste',
        name: 'MCP_API_TESTE',
        description: "Caso o input do cliente seja 'teste' chame esse MCP.",
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'mcp',
        targetStepId: 'mcp-teste',
      },
    ];

    const repaired = (service as any).repairAgentPlanCoverage(
      'teste, traduza oi para ingles e resuma esse input',
      [
        {
          action: 'tool',
          toolId: 'canvas:skill-tradutor',
          arguments: { task: 'Traduzir o texto conforme solicitado.', text: 'oi' },
          reason: 'Traduzir.',
          validTool: true,
        },
        {
          action: 'tool',
          toolId: 'canvas:skill-resume',
          arguments: { task: 'Resumir o texto conforme solicitado.', text: 'teste, traduza oi para ingles e resuma esse input' },
          reason: 'Resumir.',
          validTool: true,
        },
      ],
      tools,
    );

    expect(repaired.repaired).toBe(true);
    expect(repaired.plan.map((item: any) => item.toolId).sort()).toEqual([
      'canvas-mcp:mcp-teste',
      'canvas:skill-resume',
      'canvas:skill-tradutor',
    ].sort());
  });

  it('uses canvas target node metadata to recognize generic tool names', () => {
    const { service } = createService();
    const config = {
      title: 'Generic manifest names',
      agentSpec: {
        skills: [
          { id: 'canvas:resume-generic', name: 'Agente copia', targetStepId: 'skill-resume' },
          { id: 'canvas:translator-generic', name: 'Agente tradutor', targetStepId: 'skill-translator' },
        ],
        mcpServers: [
          {
            id: 'canvas-mcp:mcp-teste',
            name: 'MCP_API_TESTE',
            description: "Caso o input do cliente seja 'teste' chame esse MCP.",
            targetStepId: 'mcp-teste',
          },
        ],
      },
      steps: [
        {
          id: 'skill-resume',
          type: 'component',
          title: 'skill_resume_texto',
          component: { type: 'openaiGen', prompt: 'Resuma textos de forma objetiva.' },
        },
        {
          id: 'skill-translator',
          type: 'component',
          title: 'skill_tradutor',
          component: { type: 'openaiGen', prompt: 'Traduza textos para ingles.' },
        },
        {
          id: 'mcp-teste',
          type: 'component',
          title: 'MCP_API_TESTE',
          component: { type: 'mcp' },
        },
      ],
      edges: [],
    };
    const tools = (service as any).buildAgentAutoToolCatalog(config);
    const repaired = (service as any).repairAgentPlanCoverage(
      'teste, traduza oi para ingles e resuma esse input',
      [
        {
          action: 'tool',
          toolId: 'canvas-mcp:mcp-teste',
          arguments: { input: 'teste' },
          reason: 'MCP.',
          validTool: true,
        },
      ],
      tools,
    );

    expect(tools.find((tool: any) => tool.id === 'canvas:resume-generic').targetStepTitle).toBe('skill_resume_texto');
    expect(repaired.repaired).toBe(true);
    expect(repaired.validation.ok).toBe(true);
    expect(repaired.plan.map((item: any) => item.toolId).sort()).toEqual([
      'canvas-mcp:mcp-teste',
      'canvas:resume-generic',
      'canvas:translator-generic',
    ].sort());
  });

  it('can repair with multiple candidates for the same intent up to the call limit', () => {
    const { service } = createService();
    const config = {
      title: 'Multiple candidates',
      agentSpec: {
        skills: [
          { id: 'canvas:resume-short', name: 'Resumo curto', targetStepId: 'resume-short' },
          { id: 'canvas:resume-risk', name: 'Resumo riscos', targetStepId: 'resume-risk' },
        ],
        mcpServers: [
          {
            id: 'canvas-mcp:mcp-teste',
            name: 'MCP_API_TESTE',
            description: "Caso o input do cliente seja 'teste' chame esse MCP.",
            targetStepId: 'mcp-teste',
          },
        ],
      },
      steps: [
        {
          id: 'resume-short',
          type: 'component',
          title: 'skill_resumo_curto',
          component: { type: 'openaiGen', prompt: 'Resuma o texto em uma frase.' },
        },
        {
          id: 'resume-risk',
          type: 'component',
          title: 'skill_resumo_riscos',
          component: { type: 'openaiGen', prompt: 'Resuma riscos e pontos de atencao.' },
        },
        { id: 'mcp-teste', type: 'component', title: 'MCP_API_TESTE', component: { type: 'mcp' } },
      ],
      edges: [],
    };
    const tools = (service as any).buildAgentAutoToolCatalog(config);
    const repaired = (service as any).repairAgentPlanCoverage(
      'teste, resuma esse input',
      [
        {
          action: 'tool',
          toolId: 'canvas-mcp:mcp-teste',
          arguments: { input: 'teste' },
          reason: 'MCP.',
          validTool: true,
        },
      ],
      tools,
      3,
    );

    expect(repaired.validation.ok).toBe(true);
    expect(repaired.plan.map((item: any) => item.toolId).sort()).toEqual([
      'canvas-mcp:mcp-teste',
      'canvas:resume-risk',
      'canvas:resume-short',
    ].sort());
  });

  it('does not add text skills when the input only matches an mcp trigger', () => {
    const { service } = createService();
    const tools = [
      {
        id: 'canvas:skill-resume',
        name: 'skill_resume_texto',
        description: 'Agente especializado em resumir textos.',
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'subagent',
        targetStepId: 'skill-resume',
      },
      {
        id: 'canvas:skill-tradutor',
        name: 'skill_tradutor',
        description: 'Agente especializado em traduzir textos para ingles.',
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'subagent',
        targetStepId: 'skill-tradutor',
      },
      {
        id: 'canvas-mcp:mcp-teste',
        name: 'MCP_API_TESTE',
        description: "Caso o input do cliente seja 'teste' chame esse MCP.",
        executable: true,
        executableType: 'canvas_step',
        sourceType: 'mcp',
        targetStepId: 'mcp-teste',
      },
    ];

    const repaired = (service as any).repairAgentPlanCoverage(
      'teste',
      [
        {
          action: 'tool',
          toolId: 'canvas-mcp:mcp-teste',
          arguments: { input: 'teste' },
          reason: 'O input contem teste.',
          validTool: true,
        },
      ],
      tools,
    );

    expect(repaired.repaired).toBe(false);
    expect(repaired.validation.ok).toBe(true);
    expect(repaired.plan.map((item: any) => item.toolId)).toEqual(['canvas-mcp:mcp-teste']);
  });

  it('keeps agent runtime slots out of persisted conversation slots', async () => {
    const { service } = createService();
    const config = {
      title: 'Runtime slots',
      steps: [
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'ok' },
      ],
      edges: [],
    };

    const result = await service.run({
      config,
      conversationId: 'conv-runtime-slots',
      skipHistory: true,
      slots: {
        keep: 'yes',
        agentAutoTools: [{ toolId: 'old-tool' }],
        agentTaskState: { status: 'old' },
        agente: {
          text: 'old',
          autoTools: [{ toolId: 'nested-tool' }],
          autoToolMessages: [{ text: 'nested-debug' }],
        },
      },
    });

    expect(result.slots.keep).toBe('yes');
    expect(result.slots.agentAutoTools).toBeUndefined();
    expect(result.slots.agentTaskState).toBeUndefined();
    expect(result.slots.agente.autoTools).toBeUndefined();
    expect(result.slots.agente.autoToolMessages).toBeUndefined();
  });

  it('can run the same input-agent-tool-message loop in repeated turns', async () => {
    const { service } = createService();
    const llmSpy = jest.spyOn(service as any, 'runLlmGenComponent').mockImplementation(async (_step: any, _config: any, context: any) => {
      context.slots.agentAutoTools = [
        { toolId: 'canvas-mcp:mcp', targetStepId: 'mcp', status: 'completed' },
      ];
      return {
        text: 'waiting=true',
        autoTools: [
          { toolId: 'canvas-mcp:mcp', targetStepId: 'mcp', status: 'completed' },
        ],
      };
    });
    const config = {
      title: 'Two turns',
      steps: [
        { id: 'question', type: 'input', title: 'Pergunta', instruction: 'Digite sua pergunta.', responseName: 'question' },
        {
          id: 'agent',
          type: 'component',
          title: 'Agente',
          component: { type: 'openaiGen', agentExecutionMode: 'auto_tools' },
        },
        { id: 'mcp', type: 'component', title: 'MCP', component: { type: 'mcp' } },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'Final {{context.slots.question}}' },
      ],
      edges: [
        { id: 'e1', source: 'question', target: 'agent' },
        { id: 'e2', source: 'mcp', target: 'message' },
        { id: 'e3', source: 'message', target: 'question' },
      ],
    };

    const first = await service.run({
      config,
      conversationId: 'conv-two-turns',
      currentStepId: 'question',
      text: 'teste',
      skipHistory: true,
    });
    const second = await service.run({
      config,
      conversationId: 'conv-two-turns',
      currentStepId: first.currentStepId,
      text: 'teste',
      slots: first.slots,
      skipHistory: true,
    });
    const third = await service.run({
      config,
      conversationId: 'conv-two-turns',
      currentStepId: second.currentStepId,
      text: 'teste',
      slots: {
        ...second.slots,
        agentAutoTools: [{ toolId: 'stale-runtime' }],
        agentTaskState: { status: 'stale' },
        agente: {
          text: 'waiting=true',
          autoTools: [{ toolId: 'stale-nested' }],
        },
      },
      skipHistory: true,
    });

    expect(first.currentStepId).toBe('question');
    expect(first.messages.map((message: any) => message.text)).toEqual(['Final teste', 'Digite sua pergunta.']);
    expect(second.currentStepId).toBe('question');
    expect(second.messages.map((message: any) => message.text)).toEqual(['Final teste', 'Digite sua pergunta.']);
    expect(third.currentStepId).toBe('question');
    expect(third.messages.map((message: any) => message.text)).toEqual(['Final teste', 'Digite sua pergunta.']);
    expect(llmSpy).toHaveBeenCalledTimes(3);
    expect(third.slots.agente?.text).toBe('waiting=true');
  });

  it('resumes after called manifest tools in hybrid mode', async () => {
    const { service } = createService();
    const trace: any[] = [];
    const config = {
      title: 'Hybrid agent',
      agentSpec: {
        skills: [{ id: 'skill-resumo', name: 'Resumo', targetStepId: 'skill' }],
        mcpServers: [{ id: 'mcp-teste', name: 'MCP', targetStepId: 'mcp' }],
      },
      steps: [
        { id: 'skill', type: 'component', title: 'Resumo', component: { type: 'openaiGen' } },
        { id: 'mcp', type: 'component', title: 'MCP', component: { type: 'mcp' } },
        { id: 'skillDone', type: 'message', title: 'Skill done', instruction: 'ok' },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'ok' },
      ],
      edges: [
        { id: 'e1', source: 'skill', target: 'skillDone' },
        { id: 'e2', source: 'mcp', target: 'message' },
      ],
    };
    const step = {
      id: 'agent',
      type: 'component',
      title: 'Agente',
      component: {
        type: 'openaiGen',
        agentRole: 'orchestrator',
        agentManifest: {
          skills: [{ id: 'skill-resumo' }],
          mcpServers: [{ id: 'mcp-teste' }],
        },
      },
    };
    const context = {
      slots: {
        agentAutoTools: [
          { toolId: 'mcp-teste', targetStepId: 'mcp', status: 'completed' },
        ],
      },
    };

    const outgoing = await (service as any).filterHybridAgentOutgoingTargets(
      step,
      config,
      context,
      ['skill', 'message', 'mcp'],
      trace,
    );

    expect(outgoing).toEqual(['message']);
    expect(trace.some((entry) => entry.type === 'agentToolDownstreamResume' && entry.resumedTargets.includes('message'))).toBe(true);
    expect(trace.some((entry) => entry.type === 'agentHybridToolEdgesSkipped'
      && entry.skipped.includes('skill')
      && entry.skipped.includes('mcp')
      && entry.resumedTargets.includes('message'))).toBe(true);
  });

  it('does not follow uncalled manifest tool branches in hybrid mode', async () => {
    const { service } = createService();
    const trace: any[] = [];
    const config = {
      title: 'Hybrid agent',
      agentSpec: {
        skills: [{ id: 'skill-resumo', name: 'Resumo', targetStepId: 'skill' }],
        mcpServers: [{ id: 'mcp-teste', name: 'MCP', targetStepId: 'mcp' }],
      },
      steps: [
        { id: 'skill', type: 'component', title: 'Resumo', component: { type: 'openaiGen' } },
        { id: 'mcp', type: 'component', title: 'MCP', component: { type: 'mcp' } },
        { id: 'skillDone', type: 'message', title: 'Skill done', instruction: 'ok' },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'ok' },
      ],
      edges: [
        { id: 'e1', source: 'skill', target: 'skillDone' },
        { id: 'e2', source: 'mcp', target: 'message' },
      ],
    };
    const step = {
      id: 'agent',
      type: 'component',
      title: 'Agente',
      component: {
        type: 'openaiGen',
        agentRole: 'orchestrator',
        agentManifest: {
          skills: [{ id: 'skill-resumo' }],
          mcpServers: [{ id: 'mcp-teste' }],
        },
      },
    };
    const context = {
      slots: {
        agentAutoTools: [
          { toolId: 'mcp-teste', targetStepId: 'mcp', status: 'completed' },
        ],
      },
    };

    const outgoing = await (service as any).filterHybridAgentOutgoingTargets(
      step,
      config,
      context,
      ['skill', 'mcp'],
      trace,
    );

    expect(outgoing).toEqual(['message']);
    expect(trace.some((entry) => entry.type === 'agentHybridToolEdgesSkipped'
      && entry.skipped.includes('skill')
      && entry.skipped.includes('mcp')
      && entry.resumedTargets.includes('message'))).toBe(true);
    expect(outgoing).not.toContain('skillDone');
  });

  it('does not follow hybrid agent edges that target manifest tools when none were called', async () => {
    const { service } = createService();
    const trace: any[] = [];
    const config = {
      title: 'Hybrid agent',
      agentSpec: {
        skills: [{ id: 'skill-resumo', name: 'Resumo', targetStepId: 'skill' }],
        mcpServers: [{ id: 'mcp-teste', name: 'MCP', targetStepId: 'mcp' }],
      },
      steps: [
        { id: 'skill', type: 'component', title: 'Resumo', component: { type: 'openaiGen' } },
        { id: 'mcp', type: 'component', title: 'MCP', component: { type: 'mcp' } },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'ok' },
      ],
      edges: [
        { id: 'e1', source: 'skill', target: 'message' },
        { id: 'e2', source: 'mcp', target: 'message' },
      ],
    };
    const step = {
      id: 'agent',
      type: 'component',
      title: 'Agente',
      component: {
        type: 'openaiGen',
        agentRole: 'orchestrator',
        agentManifest: {
          skills: [{ id: 'skill-resumo' }],
          mcpServers: [{ id: 'mcp-teste' }],
        },
      },
    };

    const outgoing = await (service as any).filterHybridAgentOutgoingTargets(
      step,
      config,
      { slots: { agentAutoTools: [] } },
      ['skill', 'message', 'mcp'],
      trace,
    );

    expect(outgoing).toEqual(['message']);
    expect(trace.find((entry) => entry.type === 'agentHybridToolEdgesSkipped')).toEqual(expect.objectContaining({
      type: 'agentHybridToolEdgesSkipped',
      skipped: ['skill', 'mcp'],
    }));
  });

  it('ignores manifest visual edges as normal runner jumps', async () => {
    const { service } = createService();
    const trace: any[] = [];
    const config = {
      title: 'Manifest visual edges',
      steps: [
        {
          id: 'agent',
          type: 'component',
          title: 'Agente',
          component: {
            type: 'openaiGen',
            agentRole: 'orchestrator',
            agentExecutionMode: 'hybrid',
            agentManifest: {
              subagents: [{ id: 'canvas:skill', targetStepId: 'skill' }],
            },
          },
        },
        {
          id: 'skill',
          type: 'component',
          title: 'Skill',
          component: { type: 'openaiGen', agentRole: 'subagent' },
        },
        { id: 'message', type: 'message', title: 'Mensagem', instruction: 'ok' },
      ],
      edges: [
        { id: 'visual', source: 'agent', target: 'skill', edgeRole: 'manifest' },
        { id: 'flow', source: 'agent', target: 'message' },
      ],
    };

    const outgoing = await (service as any).outgoingTargets(config.steps[0], config, { slots: {} }, trace);

    expect(outgoing).toEqual(['message']);
  });

  it('runs API nodes through the HTTP batch service and stores the response', async () => {
    const { service, httpBatchService } = createService();
    httpBatchService.execute.mockResolvedValueOnce({ status: 200, data: { score: 42 } });
    const config = {
      title: 'API',
      steps: [
        {
          id: 'api',
          type: 'api',
          title: 'Score',
          api: {
            responseName: 'scoreApi',
            requests: [{ method: 'GET', url: 'https://example.test/score' }],
          },
        },
        { id: 'end', type: 'end', title: 'Fim', instruction: 'ok' },
      ],
      edges: [{ id: 'e1', source: 'api', target: 'end' }],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-3',
      skipHistory: true,
    });

    expect(httpBatchService.execute).toHaveBeenCalledWith(
      [{ method: 'GET', url: 'https://example.test/score' }],
      expect.objectContaining({ agentId: 'agent-1', conversationId: 'conv-3' }),
    );
    expect(result.slots.scoreApi).toEqual({ status: 200, data: { score: 42 } });
    expect(result.ended).toBe(true);
  });

  it('evaluates JS conditions before following outgoing edges', async () => {
    const { service } = createService();
    const config = {
      title: 'Condicao',
      steps: [
        {
          id: 'condition',
          type: 'condition',
          title: 'Maioridade',
          responseName: 'isAdult',
          condition: 'Number(context.slots.age) >= 18',
        },
        { id: 'end', type: 'end', title: 'Fim', instruction: 'aprovado' },
      ],
      edges: [{ id: 'e1', source: 'condition', target: 'end' }],
    };

    const result = await service.run({
      config,
      agentId: 'agent-1',
      conversationId: 'conv-4',
      slots: { age: 21 },
      skipHistory: true,
    });

    expect(result.slots.isAdult).toBe(true);
    expect(result.ended).toBe(true);
    expect(result.messages.at(-1)?.text).toBe('aprovado');
  });

  it('completes the agentic architecture for preconfigured Gmail MCP assistant requests', async () => {
    const { service } = createService();
    const chatCreate = jest.fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ flowSpec: { goal: 'Ler emails do Gmail' } }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              config: {
                title: 'Leitura de emails',
                startStepId: 'welcome',
                steps: [
                  { id: 'welcome', type: 'message', title: 'Inicio', instruction: 'Vou consultar seus emails.' },
                  { id: 'end', type: 'end', title: 'Fim', instruction: 'Consulta concluida.' },
                ],
                edges: [{ id: 'e1', source: 'welcome', target: 'end' }],
              },
            }),
          },
        }],
      });
    jest.spyOn(service as any, 'getOpenAIClientForProvider').mockResolvedValue({
      chat: { completions: { create: chatCreate } },
    });
    jest.spyOn(service as any, 'getChatModelForProvider').mockResolvedValue('gpt-test');

    const result = await service.generateFlowConfigWithLlm({
      instruction: 'Crie um fluxo que leia emails do Gmail quando o usuario solicitar.',
      currentConfig: {
        title: 'Atual',
        model: 'gpt-test',
        llmProvider: 'openai',
        steps: [],
        edges: [],
      },
    });

    const plan = result.config.steps.find((step: any) => step.component?.type === 'agentPlan');
    const orchestrator = result.config.steps.find((step: any) => step.component?.type === 'openaiGen' && step.component?.agentRole === 'orchestrator');
    const skill = result.config.steps.find((step: any) => step.component?.type === 'openaiGen' && step.component?.agentRole === 'subagent');
    const mcp = result.config.steps.find((step: any) => step.component?.type === 'mcp');

    expect(plan).toBeDefined();
    expect(orchestrator).toBeDefined();
    expect(skill).toEqual(expect.objectContaining({ title: expect.stringContaining('Gmail') }));
    expect(mcp?.component).toEqual(expect.objectContaining({
      mcpMode: 'external',
      mcpExternalUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
      mcpExternalAuthMode: 'oauth',
      mcpExternalOperation: 'listTools',
    }));
    expect(result.config.startStepId).toBe(plan.id);
    expect(result.config.agentSpec.skills).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'skill:gmail', targetStepId: skill.id }),
    ]));
    expect(result.config.agentSpec.mcpServers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'mcp:gmail', targetStepId: mcp.id }),
    ]));
    expect(orchestrator.component.agentManifest.skills).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'skill:gmail', targetStepId: skill.id }),
    ]));
    expect(skill.component.agentManifest.mcpServers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'mcp:gmail', targetStepId: mcp.id }),
    ]));
    expect(result.config.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: plan.id, target: orchestrator.id }),
      expect.objectContaining({ source: orchestrator.id, target: skill.id, edgeRole: 'manifest' }),
      expect.objectContaining({ source: skill.id, target: mcp.id, edgeRole: 'manifest' }),
    ]));
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('listTools'),
      expect.stringContaining('OAuth'),
    ]));

    const plannerPayload = JSON.parse(chatCreate.mock.calls[0][0].messages.at(-1).content);
    expect(plannerPayload.requestedPreconfiguredMcpServers).toEqual([
      expect.objectContaining({ id: 'gmail', serverUrl: 'https://gmailmcp.googleapis.com/mcp/v1' }),
    ]);
    expect(plannerPayload.mandatoryMcpArchitecture).toEqual(expect.arrayContaining([
      expect.stringContaining('agentPlan'),
      expect.stringContaining('skill especialista'),
    ]));
  });

  it('does not add global MCP architecture while editing selected nodes', () => {
    const { service } = createService();
    const config = {
      title: 'Edicao parcial',
      startStepId: 'message',
      steps: [{ id: 'message', type: 'message', title: 'Mensagem', instruction: 'ok' }],
      edges: [],
    };

    const result = (service as any).ensureAssistantMcpArchitecture(
      config,
      'Ajuste o node para ler emails do Gmail.',
      'selectedNodes',
    );

    expect(result.config).toBe(config);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['Gmail', 'leia emails do Gmail', 'https://gmailmcp.googleapis.com/mcp/v1', 'oauth'],
    ['Google Drive', 'pesquise arquivos no Google Drive', 'https://drivemcp.googleapis.com/mcp/v1', 'oauth'],
    ['Microsoft OneDrive Work IQ', 'consulte documentos no OneDrive', 'https://agent365.svc.cloud.microsoft/agents/tenants/SEU_TENANT_ID/servers/mcp_OneDriveRemoteServer', 'oauth'],
    ['Notion', 'leia paginas do Notion', 'https://mcp.notion.com/mcp', 'oauth'],
    ['GitHub', 'consulte issues no GitHub', 'https://api.githubcopilot.com/mcp/', 'bearer'],
    ['GitLab Orbit', 'consulte o GitLab', 'https://gitlab.com/api/v4/orbit/mcp', 'oauth'],
    ['AWS Knowledge', 'consulte documentacao da AWS', 'https://knowledge-mcp.global.api.aws', 'none'],
    ['AWS MCP Server', 'acesse a infra AWS', 'https://aws-mcp.us-east-1.api.aws/mcp', 'aws_sigv4'],
  ])('maps %s assistant requests to the matching MCP preset', (_label, instruction, serverUrl, authMode) => {
    const { service } = createService();
    const result = (service as any).ensureAssistantMcpArchitecture({
      title: 'Preset MCP',
      steps: [],
      edges: [],
    }, instruction, 'fullFlow');
    const mcp = result.config.steps.find((step: any) => step.component?.type === 'mcp');

    expect(mcp?.component).toEqual(expect.objectContaining({
      mcpExternalUrl: serverUrl,
      mcpExternalAuthMode: authMode,
      mcpExternalOperation: 'listTools',
    }));
    if (authMode === 'oauth') {
      expect(mcp?.component.mcpExternalOAuthConnectionScope).toBe('user');
    }
  });

  it('signs AWS MCP requests with SigV4 and injects the target region metadata', async () => {
    const previousAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const previousSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const previousSessionToken = process.env.AWS_SESSION_TOKEN;
    const previousFetch = global.fetch;
    process.env.AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-example';
    delete process.env.AWS_SESSION_TOKEN;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as any;

    try {
      const { service } = createService();
      const signedFetch = (service as any).createAwsSigV4Fetch(new URL('https://aws-mcp.us-east-1.api.aws/mcp'), {});
      await signedFetch('https://aws-mcp.us-east-1.api.aws/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });

      const request = fetchMock.mock.calls[0][1];
      const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value]));
      expect(headers.authorization).toContain('Credential=AKIDEXAMPLE/');
      expect(headers.authorization).toContain('/us-east-1/aws-mcp/aws4_request');
      expect(JSON.parse(request.body).params._meta).toEqual({ AWS_REGION: 'us-east-1' });
    } finally {
      if (previousAccessKey === undefined) delete process.env.AWS_ACCESS_KEY_ID;
      else process.env.AWS_ACCESS_KEY_ID = previousAccessKey;
      if (previousSecret === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
      else process.env.AWS_SECRET_ACCESS_KEY = previousSecret;
      if (previousSessionToken === undefined) delete process.env.AWS_SESSION_TOKEN;
      else process.env.AWS_SESSION_TOKEN = previousSessionToken;
      global.fetch = previousFetch;
    }
  });

  it('lets the OAuth provider own the authorization header for external MCP transports', async () => {
    const { service, mcpOAuthService } = createService();

    const connection = await (service as any).createMcpExternalTransport({
      type: 'mcp',
      mcpMode: 'external',
      mcpExternalTransport: 'streamable_http',
      mcpExternalUrl: 'https://mcp.example.com/mcp',
      mcpExternalHeadersJson: '{"Authorization":"Bearer stale-token","x-tenant":"tenant-1"}',
      mcpExternalAuthMode: 'oauth',
      mcpExternalOAuthConnectionScope: 'user',
    }, {
      agentId: 'agent-1',
      organizationId: 'org-1',
      oauthUserId: 'user-1',
      slots: {},
    });

    expect(connection.headers).toEqual({ 'x-tenant': 'tenant-1' });
    expect(mcpOAuthService.createRuntimeProvider).toHaveBeenCalledWith({
      serverUrl: 'https://mcp.example.com/mcp',
      agentId: 'agent-1',
      organizationId: 'org-1',
      connectionScope: 'user',
      oauthUserId: 'user-1',
    });
  });

  it('returns an actionable message when an OAuth MCP rejects authorization', () => {
    const { service } = createService();

    const error = (service as any).normalizeMcpExternalError(
      new Error('Unauthorized'),
      { mcpExternalAuthMode: 'oauth' },
    );

    expect(error.message).toContain('Conclua Abrir autorizacao ou use Reconectar do zero');
  });

  it('omits optional empty MCP arguments while preserving required and meaningful values', () => {
    const { service } = createService();

    const result = (service as any).normalizeMcpArgumentsForSchema({
      to: 'cliente@example.com',
      subject: '',
      body: '',
      cc: [],
      htmlBody: '',
      flag: false,
      retries: 0,
      reply: {
        optionalId: '',
        requiredId: '',
      },
    }, {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        cc: { type: 'array', items: { type: 'string' } },
        htmlBody: { type: 'string' },
        flag: { type: 'boolean' },
        retries: { type: 'number' },
        reply: {
          type: 'object',
          properties: {
            optionalId: { type: 'string' },
            requiredId: { type: 'string' },
          },
          required: ['requiredId'],
        },
      },
      required: ['to', 'body'],
    });

    expect(result).toEqual({
      to: 'cliente@example.com',
      body: '',
      flag: false,
      retries: 0,
      reply: {
        requiredId: '',
      },
    });
  });

  it('coerces scalar MCP values into arrays when required by the official tool schema', () => {
    const { service } = createService();

    const result = (service as any).normalizeMcpArgumentsForSchema({
      attachments: '',
      bcc: '',
      body: 'Ola meu amigo',
      cc: '',
      htmlBody: '',
      subject: 'teste',
      to: 'cliente@example.com',
    }, {
      type: 'object',
      properties: {
        attachments: { type: 'array', items: { type: 'object' } },
        bcc: { type: 'array', items: { type: 'string' } },
        body: { type: 'string' },
        cc: { type: 'array', items: { type: 'string' } },
        htmlBody: { type: 'string' },
        subject: { type: 'string' },
        to: { type: 'array', items: { type: 'string' } },
      },
    });

    expect(result).toEqual({
      body: 'Ola meu amigo',
      subject: 'teste',
      to: ['cliente@example.com'],
    });
  });

  it('accepts a JSON array string from a templated MCP slot', () => {
    const { service } = createService();

    const result = (service as any).normalizeMcpArgumentsForSchema({
      to: '["um@example.com","dois@example.com"]',
    }, {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' } },
      },
    });

    expect(result).toEqual({
      to: ['um@example.com', 'dois@example.com'],
    });
  });

  it('coerces typed MCP slot values from the generated array template', () => {
    const { service } = createService();

    const result = (service as any).normalizeMcpArgumentsForSchema({
      enabled: 'true',
      pageSize: '20',
      ratio: '1.5',
      recipients: ['["um@example.com","dois@example.com"]'],
      settings: '{"notify":false}',
    }, {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        pageSize: { type: 'integer' },
        ratio: { type: 'number' },
        recipients: { type: 'array', items: { type: 'string' } },
        settings: {
          type: 'object',
          properties: {
            notify: { type: 'boolean' },
          },
        },
      },
    });

    expect(result).toEqual({
      enabled: true,
      pageSize: 20,
      ratio: 1.5,
      recipients: ['um@example.com', 'dois@example.com'],
      settings: {
        notify: false,
      },
    });
  });

  it('explains how to enable a disabled Google Workspace MCP API', () => {
    const { service } = createService();
    const enableUrl = 'https://console.developers.google.com/apis/api/gmailmcp.googleapis.com/overview?project=1087363817285';

    const error = (service as any).normalizeMcpExternalError(
      new Error(`Gmail MCP API has not been used in project 1087363817285 before or it is disabled. Enable it by visiting ${enableUrl} then retry.`),
      { mcpExternalAuthMode: 'oauth' },
    );

    expect(error.message).toContain('API Google Workspace MCP desabilitada no projeto Google Cloud 1087363817285');
    expect(error.message).toContain('gmailmcp.googleapis.com');
    expect(error.message).toContain('gmail.googleapis.com');
    expect(error.message).toContain(enableUrl);
  });

  it('explains the Gmail MCP recipient array format', () => {
    const { service } = createService();

    const error = (service as any).normalizeMcpExternalError(
      new Error('At least one recipient (To, Cc, or Bcc) must be specified.'),
      {
        mcpExternalUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
        mcpExternalAuthMode: 'oauth',
      },
    );

    expect(error.message).toContain('{"to":["cliente@example.com"]}');
    expect(error.message).toContain('Remova cc, bcc e attachments');
  });

  it('explains how to reconnect Gmail MCP when the Google account lacks permission', () => {
    const { service } = createService();

    const error = (service as any).normalizeMcpExternalError(
      new Error('The caller does not have permission'),
      {
        mcpExternalUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
        mcpExternalAuthMode: 'oauth',
      },
    );

    expect(error.message).toContain('gmail.readonly');
    expect(error.message).toContain('gmail.compose');
    expect(error.message).toContain('Test users');
    expect(error.message).toContain('Reconectar do zero');
  });

  it('skips background cron scans when MongoDB is unavailable and suppression is enabled', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'waitForMongoConnection').mockRejectedValue(new Error('connection <monitor> to 89.194.62.252:27017 timed out'));

    const result = await service.runDueCronFlows({ suppressConnectionErrors: true } as any);

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      skipped: true,
      reason: 'mongo_unavailable',
    }));
  });
});
