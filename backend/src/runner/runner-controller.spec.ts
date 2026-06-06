import { UnauthorizedException } from '@nestjs/common';
import { RunnerController } from './runner-controller';

const createController = (overrides?: {
  loginRequired?: boolean;
  masterToken?: string;
  tokenValid?: boolean;
  queueEnabled?: boolean;
}) => {
  const service = {
    run: jest.fn().mockResolvedValue({ messages: [{ role: 'assistant', text: 'ok' }] }),
    listExternalMcpTools: jest.fn().mockResolvedValue({ tools: [{ name: 'buscar_cliente' }] }),
  };
  const apiKeyService = {
    getMasterToken: jest.fn(() => overrides?.masterToken ?? 'master-token'),
    extractToken: jest.fn(() => 'received-token'),
    validateRunToken: jest.fn().mockResolvedValue(
      overrides?.tokenValid === false
        ? { valid: false }
        : { valid: true, kind: 'generated', key: { organizationId: 'org-1', createdBy: 'user-1' } },
    ),
  };
  const authService = {
    isLoginRequired: jest.fn(() => overrides?.loginRequired ?? false),
    resolveUserFromHeaders: jest.fn().mockResolvedValue(null),
  };
  const sqsTransitionService = {
    assertRateLimit: jest.fn().mockResolvedValue(undefined),
    getRateLimit: jest.fn(() => 600),
    isEnabled: jest.fn(() => overrides?.queueEnabled ?? false),
    enqueue: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
  };
  const runnerQueueProcessor = {};

  const controller = new RunnerController(
    service as any,
    apiKeyService as any,
    authService as any,
    sqsTransitionService as any,
    runnerQueueProcessor as any,
  );

  return { controller, service, apiKeyService, authService, sqsTransitionService };
};

describe('RunnerController', () => {
  it('validates run tokens, applies rate limits and executes synchronously', async () => {
    const { controller, service, sqsTransitionService } = createController();

    const result = await controller.test(
      { flowId: 'flow-1', agentId: 'agent-1', channel: 'webWidget' },
      'Bearer token',
    );

    expect(result).toEqual({ messages: [{ role: 'assistant', text: 'ok' }] });
    expect(sqsTransitionService.assertRateLimit).toHaveBeenCalledWith({
      scope: 'org-1:agent-1:webWidget',
      limit: 600,
    });
    expect(service.run).toHaveBeenCalledWith(expect.objectContaining({
      flowId: 'flow-1',
      agentId: 'agent-1',
      _organizationId: 'org-1',
      _oauthUserId: 'user-1',
    }));
  });

  it('enqueues async runs when SQS is enabled and requested', async () => {
    const { controller, service, sqsTransitionService } = createController({ queueEnabled: true });

    const result = await controller.test({ flowId: 'flow-1', async: true });

    expect(result).toEqual({ jobId: 'job-1' });
    expect(service.run).not.toHaveBeenCalled();
    expect(sqsTransitionService.enqueue).toHaveBeenCalledWith(
      'canvas-flow.run',
      expect.objectContaining({ flowId: 'flow-1', skipQueue: true, _organizationId: 'org-1', _oauthUserId: 'user-1' }),
      { trackResult: true },
    );
  });

  it('rejects invalid API tokens', async () => {
    const { controller } = createController({ tokenValid: false });

    await expect(controller.test({ flowId: 'flow-1' }, 'Bearer bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lists external MCP tools with the authenticated organization scope', async () => {
    const { controller, service } = createController();

    const result = await controller.listExternalMcpTools({
      agentId: 'agent-1',
      component: { mcpExternalUrl: 'https://mcp.example.com/mcp' },
    });

    expect(result).toEqual({ tools: [{ name: 'buscar_cliente' }] });
    expect(service.listExternalMcpTools).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'agent-1',
      _organizationId: 'org-1',
      _oauthUserId: 'user-1',
    }));
  });
});
