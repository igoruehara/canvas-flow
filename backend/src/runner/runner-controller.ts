import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { ApiKeyService } from '../api-key/api-key-service';
import { AuthService } from '../auth/auth-service';
import { SqsTransitionService } from '../queue/sqs-transition-service';
import { getCanvasFlowTemplates } from './flow-templates';
import { RunnerQueueProcessor } from './runner-queue-processor';
import { RunnerService } from './runner-service';

@ApiTags('runner')
@Controller('api/canvas-flow')
export class RunnerController {
  constructor(
    private readonly service: RunnerService,
    private readonly apiKeyService: ApiKeyService,
    private readonly authService: AuthService,
    private readonly sqsTransitionService: SqsTransitionService,
    private readonly runnerQueueProcessor: RunnerQueueProcessor,
  ) {}

  private async assertApiToken(body: any, authorization?: string, headerToken?: string, xApiKey?: string) {
    if (this.authService.isLoginRequired()) {
      const user = await this.authService.resolveUserFromHeaders(authorization, headerToken, xApiKey);
      if (user) return { organizationId: user.organizationId, userId: user.id };
    }

    const expected = this.apiKeyService.getMasterToken();
    if (!expected && !authorization && !headerToken && !xApiKey) return;

    const received = this.apiKeyService.extractToken(authorization, headerToken, xApiKey);
    const validation = await this.apiKeyService.validateRunToken(received, {
      flowId: body?.flowId,
      agentId: body?.agentId,
    });

    if (!validation.valid) {
      throw new UnauthorizedException('Invalid Canvas Flow API token');
    }
    return {
      organizationId: validation.kind === 'generated' ? validation.key?.organizationId : undefined,
      userId: validation.kind === 'generated' ? validation.key?.createdBy : undefined,
    };
  }

  @Post('test')
  async test(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    const runBody = {
      ...body,
      _organizationId: auth?.organizationId,
      _oauthUserId: auth?.userId,
      _conversationOwnerId: auth?.userId || '',
      _langGraphRunId: randomUUID(),
    };
    const channel = runBody.channel || runBody.config?.channel || 'webWidget';
    await this.sqsTransitionService.assertRateLimit({
      scope: [
        auth?.organizationId || 'global',
        runBody.agentId || 'default-agent',
        channel || 'api',
      ].join(':'),
      limit: this.sqsTransitionService.getRateLimit(channel === 'webWidget' ? 'webwidget' : 'api'),
    });
    if (this.sqsTransitionService.isEnabled() && (body?.queue === true || body?.async === true)) {
      return await this.sqsTransitionService.enqueue('canvas-flow.run', { ...runBody, skipQueue: true }, { trackResult: true });
    }
    return await this.service.run(runBody);
  }

  @Get('templates')
  async templates(
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    await this.assertApiToken({}, authorization, headerToken, xApiKey);
    return { templates: getCanvasFlowTemplates() };
  }

  @Post('agentops/dashboard')
  async agentOpsDashboard(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.getAgentOpsDashboard({ ...body, _organizationId: auth?.organizationId });
  }

  @Get('mcp/:agentId')
  @ApiOperation({
    summary: 'Descreve o MCP server HTTP de um agente',
    description: [
      'Retorna metadados para um MCP client consumir os flows salvos do agente.',
      'O transporte exposto e JSON-RPC 2.0 sobre HTTP POST no mesmo endpoint.',
      'Cada flow salvo com steps vira uma tool MCP retornada em tools/list.',
    ].join(' '),
  })
  @ApiParam({ name: 'agentId', description: 'Agente cujos flows serao expostos como tools MCP.' })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description: 'Bearer <CANVAS_FLOW_API_KEY>. Alternativas aceitas: x-api-key ou x-canvas-flow-token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Metadados do MCP server e catalogo inicial de tools.',
    schema: {
      example: {
        name: 'canvas-flow-default-agent',
        protocol: 'mcp-json-rpc',
        transport: 'http-json-rpc-post',
        endpoint: '/api/canvas-flow/mcp/default-agent',
        authentication: {
          headers: {
            Authorization: 'Bearer <CANVAS_FLOW_API_KEY>',
            'x-api-key': '<CANVAS_FLOW_API_KEY>',
          },
        },
        consumption: {
          sequence: ['initialize', 'tools/list', 'tools/call'],
          toolNameSource: 'Use result.tools[].name retornado por tools/list.',
          callArguments: {
            text: 'Mensagem ou tarefa para executar o flow.',
            conversationId: 'Opcional, preserva memoria entre chamadas.',
            slots: 'Opcional, contexto inicial em context.slots.',
          },
        },
        tools: [
          {
            name: 'atendimento_inicial',
            title: 'Atendimento inicial',
            description: 'Executa o fluxo "Atendimento inicial".',
            inputSchema: { type: 'object', required: ['text'] },
          },
        ],
      },
    },
  })
  async mcpTools(
    @Param('agentId') agentId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken({ agentId }, authorization, headerToken, xApiKey);
    const tools = await this.service.listMcpTools(agentId, auth?.organizationId);
    return {
      name: `canvas-flow-${agentId || 'default-agent'}`,
      protocol: 'mcp-json-rpc',
      transport: 'http-json-rpc-post',
      endpoint: `/api/canvas-flow/mcp/${encodeURIComponent(agentId || 'default-agent')}`,
      authentication: {
        headers: {
          Authorization: 'Bearer <CANVAS_FLOW_API_KEY>',
          'x-api-key': '<CANVAS_FLOW_API_KEY>',
        },
        note: 'Use uma API Key gerada no Canvas Flow. O token master deve ficar reservado para administracao.',
      },
      consumption: {
        description: 'Este endpoint e um MCP server HTTP: envie JSON-RPC 2.0 por POST para initialize, tools/list e tools/call.',
        sequence: ['initialize', 'tools/list', 'tools/call'],
        toolNameSource: 'Sempre chame tools/list primeiro e use o campo result.tools[].name no tools/call.',
        callArguments: {
          text: 'Mensagem ou tarefa de entrada para executar o flow.',
          conversationId: 'Opcional. Reutilize para preservar memoria entre chamadas.',
          slots: 'Opcional. Objeto usado como context.slots inicial.',
          flowVersion: 'Opcional. Versao especifica do flow.',
          agentRelease: 'Opcional. Release especifico do agente.',
          approvals: 'Opcional. Decisoes humanas pre-aprovadas por stepId ou responseName.',
        },
      },
      clientExample: {
        initialize: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'meu-mcp-client', version: '1.0.0' } },
        },
        listTools: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        callTool: {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: tools?.[0]?.name || '<NOME_RETORNADO_EM_TOOLS_LIST>',
            arguments: { text: 'Preciso de ajuda', conversationId: 'mcp-cliente-123', slots: {} },
          },
        },
      },
      tools,
    };
  }

  @Post('mcp/:agentId')
  @ApiOperation({
    summary: 'Executa chamadas MCP JSON-RPC para o agente',
    description: [
      'Endpoint de consumo para MCP clients.',
      'Aceita JSON-RPC 2.0 simples ou batch por HTTP POST.',
      'Metodos suportados: initialize, ping, notifications/initialized, tools/list e tools/call.',
    ].join(' '),
  })
  @ApiParam({ name: 'agentId', description: 'Agente cujos flows serao expostos como tools MCP.' })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description: 'Bearer <CANVAS_FLOW_API_KEY>. Alternativas aceitas: x-api-key ou x-canvas-flow-token.',
  })
  @ApiBody({
    description: 'Requisicao MCP JSON-RPC 2.0. Para tools/call, use params.name vindo de tools/list.',
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            jsonrpc: { type: 'string', example: '2.0' },
            id: { oneOf: [{ type: 'string' }, { type: 'number' }], example: 2 },
            method: { type: 'string', example: 'tools/call' },
            params: {
              type: 'object',
              example: {
                name: 'atendimento_inicial',
                arguments: {
                  text: 'Preciso de ajuda',
                  conversationId: 'mcp-cliente-123',
                  slots: {},
                },
              },
            },
          },
          required: ['jsonrpc', 'method'],
        },
        { type: 'array', items: { type: 'object' } },
      ],
    },
    examples: {
      initialize: {
        summary: 'Inicializar cliente MCP',
        value: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'meu-mcp-client', version: '1.0.0' } } },
      },
      listTools: {
        summary: 'Listar tools expostas pelos flows',
        value: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      },
      callTool: {
        summary: 'Chamar uma tool retornada por tools/list',
        value: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'atendimento_inicial', arguments: { text: 'Preciso de ajuda', conversationId: 'mcp-cliente-123', slots: {} } } },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Resposta MCP JSON-RPC.',
    schema: {
      example: {
        jsonrpc: '2.0',
        id: 3,
        result: {
          content: [{ type: 'text', text: 'assistant: Ola, como posso ajudar?' }],
          structuredContent: {
            messages: [{ role: 'assistant', text: 'Ola, como posso ajudar?' }],
            slots: {},
            ended: false,
            conversationId: 'mcp-cliente-123',
            flowId: '665f...',
            flowName: 'Atendimento inicial',
          },
        },
      },
    },
  })
  async mcpJsonRpc(
    @Param('agentId') agentId: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken({ agentId }, authorization, headerToken, xApiKey);
    return await this.service.handleMcpJsonRpc(agentId, body, auth?.organizationId, auth?.userId);
  }

  @Post('mcp-external/tools')
  async listExternalMcpTools(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.listExternalMcpTools({ ...body, _organizationId: auth?.organizationId, _oauthUserId: auth?.userId });
  }

  @Post('simulations/replay')
  async replaySimulation(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.replaySimulation({ ...body, _organizationId: auth?.organizationId, _oauthUserId: auth?.userId });
  }

  @Post('test/stream')
  async testStream(
    @Body() body: any,
    @Res() res: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    const write = (event: string, payload: Record<string, any>) => {
      res.write(`${JSON.stringify({ event, ...payload })}\n`);
      if (typeof res.flush === 'function') res.flush();
    };

    try {
      const result = await this.service.run({
        ...body,
        _organizationId: auth?.organizationId,
        _oauthUserId: auth?.userId,
        _conversationOwnerId: auth?.userId || '',
        _langGraphRunId: randomUUID(),
        _onMessage: (message: any) => write('message', { message }),
      });
      write('result', { result: { ...result, messages: [] } });
      res.end();
    } catch (error: any) {
      write('error', { message: error?.message || String(error) });
      res.end();
    }
  }

  @Post('context/script/generate')
  async generateContextScript(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.generateContextScriptWithLlm({ ...body, _organizationId: auth?.organizationId });
  }

  @Post('mongodb/config/generate')
  async generateMongoConfig(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.generateMongoConfigWithLlm({ ...body, _organizationId: auth?.organizationId });
  }

  @Post('assistant/generate-flow')
  async generateFlowWithAssistant(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ): Promise<any> {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.generateFlowConfigWithLlm({ ...body, _organizationId: auth?.organizationId });
  }

  @Post('prompt-field/generate')
  async generatePromptField(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.generatePromptFieldWithLlm({ ...body, _organizationId: auth?.organizationId });
  }

  @Post('whatsapp-flows')
  async createWhatsappFlow(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.createWhatsappFlow({ ...body, _organizationId: auth?.organizationId });
  }

  @Post('whatsapp-flows/list')
  async listWhatsappFlows(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.listWhatsappFlows({ ...body, _organizationId: auth?.organizationId });
  }

  @Delete('whatsapp-flows/:flowId')
  async deleteWhatsappFlow(
    @Param('flowId') flowId: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken({ ...body, flowId }, authorization, headerToken, xApiKey);
    return await this.service.deleteWhatsappFlow({ ...body, flowId, _organizationId: auth?.organizationId });
  }

  @Post('whatsapp-flows/:flowId/assets')
  async uploadWhatsappFlowJson(
    @Param('flowId') flowId: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken({ ...body, flowId }, authorization, headerToken, xApiKey);
    return await this.service.uploadWhatsappFlowJson({ ...body, flowId, _organizationId: auth?.organizationId });
  }

  @Post('whatsapp-flows/:flowId/publish')
  async publishWhatsappFlow(
    @Param('flowId') flowId: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken({ ...body, flowId }, authorization, headerToken, xApiKey);
    return await this.service.publishWhatsappFlow({ ...body, flowId, _organizationId: auth?.organizationId });
  }

  @Post('tags/dashboard')
  async tagDashboard(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.getTagDashboard({ ...body, _organizationId: auth?.organizationId });
  }

  @Post('cron/run-due')
  async runDueCron(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    await this.assertApiToken(body, authorization, headerToken, xApiKey);
    return await this.service.runDueCronFlows({
      agentId: body?.agentId,
      dryRun: body?.dryRun === true,
    });
  }

  @Post('sqs/consume')
  async consumeSqsMessages(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    await this.assertApiToken(body, authorization, headerToken, xApiKey);
    const records = Array.isArray(body?.Records) ? body.Records : [body];
    return await this.runnerQueueProcessor.processRecords(records);
  }

  @Get('sqs/jobs/:jobId')
  async getSqsJob(
    @Param('jobId') jobId: string,
    @Query('agentId') agentId?: string,
    @Query('flowId') flowId?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken({ agentId, flowId }, authorization, headerToken, xApiKey);
    return await this.sqsTransitionService.getJob(jobId, auth?.organizationId);
  }

  @Post('sqs/jobs/:jobId/retry')
  async retrySqsJob(
    @Param('jobId') jobId: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const auth = await this.assertApiToken(body || {}, authorization, headerToken, xApiKey);
    return await this.sqsTransitionService.retryJob(jobId, auth?.organizationId);
  }

  @Get('sqs/health')
  async getSqsHealth(
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    await this.assertApiToken({}, authorization, headerToken, xApiKey);
    return await this.sqsTransitionService.getQueueHealth();
  }

  @Get('reports/:fileName')
  async getReport(@Param('fileName') fileName: string, @Res() res: any) {
    const filePath = this.service.getReportFilePath(fileName);
    return res.download(filePath, fileName);
  }

  @Get('whatsapp-media/:flowId/:mediaId')
  async getWhatsappMedia(
    @Param('flowId') flowId: string,
    @Param('mediaId') mediaId: string,
    @Query('exp') expiresAt: string,
    @Query('sig') signature: string,
    @Res() res: any,
  ) {
    const media = await this.service.downloadWhatsappMedia(flowId, mediaId, expiresAt, signature);
    res.setHeader('Content-Type', media.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${media.fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(media.buffer);
  }

  @Get('webhook/custom/:flowId/:webhookId')
  async receiveCustomWebhookGet(
    @Param('flowId') flowId: string,
    @Param('webhookId') webhookId: string,
    @Query() query: any,
    @Headers() headers: Record<string, any>,
  ) {
    await this.sqsTransitionService.assertRateLimit({
      scope: ['custom-webhook', flowId, webhookId].join(':'),
      limit: this.sqsTransitionService.getRateLimit('api'),
    });
    return await this.service.runCustomWebhook(flowId, webhookId, {
      method: 'GET',
      query,
      headers,
    });
  }

  @Post('webhook/custom/:flowId/:webhookId')
  async receiveCustomWebhookPost(
    @Param('flowId') flowId: string,
    @Param('webhookId') webhookId: string,
    @Body() body: any,
    @Query() query: any,
    @Headers() headers: Record<string, any>,
  ) {
    await this.sqsTransitionService.assertRateLimit({
      scope: ['custom-webhook', flowId, webhookId].join(':'),
      limit: this.sqsTransitionService.getRateLimit('api'),
    });
    return await this.service.runCustomWebhook(flowId, webhookId, {
      method: 'POST',
      body,
      query,
      headers,
    });
  }

  @Get('webhook/whatsapp/:flowId')
  async verifyWhatsappWebhook(
    @Param('flowId') flowId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: any,
  ) {
    const verifiedChallenge = await this.service.verifyWhatsappWebhook(flowId, mode, verifyToken, challenge);
    return res.status(200).send(verifiedChallenge);
  }

  @Get('webhook/whatsapp-main/:agentId')
  async verifyWhatsappMainWebhook(
    @Param('agentId') agentId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: any,
  ) {
    const verifiedChallenge = await this.service.verifyWhatsappMainWebhook(agentId, mode, verifyToken, challenge);
    return res.status(200).send(verifiedChallenge);
  }

  @Post('webhook/whatsapp/:flowId')
  async receiveWhatsappWebhook(@Param('flowId') flowId: string, @Body() body: any) {
    await this.sqsTransitionService.assertRateLimit({
      scope: ['whatsapp', flowId].join(':'),
      limit: this.sqsTransitionService.getRateLimit('whatsapp'),
    });
    if (this.sqsTransitionService.isEnabled() && body?.skipQueue !== true) {
      return await this.sqsTransitionService.enqueue('canvas-flow.whatsapp', { flowId, body, skipQueue: true }, { trackResult: true });
    }
    return await this.service.runWhatsappWebhook(flowId, body);
  }

  @Post('webhook/whatsapp-main/:agentId')
  async receiveWhatsappMainWebhook(@Param('agentId') agentId: string, @Body() body: any) {
    await this.sqsTransitionService.assertRateLimit({
      scope: ['whatsapp-main', agentId].join(':'),
      limit: this.sqsTransitionService.getRateLimit('whatsapp'),
    });
    if (this.sqsTransitionService.isEnabled() && body?.skipQueue !== true) {
      return await this.sqsTransitionService.enqueue('canvas-flow.whatsapp-main', { agentId, body, skipQueue: true }, { trackResult: true });
    }
    return await this.service.runWhatsappMainWebhook(agentId, body);
  }
}
