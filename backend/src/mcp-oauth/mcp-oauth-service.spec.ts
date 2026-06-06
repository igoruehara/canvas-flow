import { McpOAuthService } from './mcp-oauth-service';

const createService = (storedRow?: Record<string, any>) => {
  const exec = jest.fn().mockResolvedValue(undefined);
  const model = {
    db: { readyState: 1 },
    updateOne: jest.fn(() => ({ exec })),
    findOne: jest.fn(() => ({
      lean: () => ({
        exec: jest.fn().mockResolvedValue(storedRow || null),
      }),
    })),
  };
  const configService = {
    get: jest.fn((key: string) => key === 'CANVAS_FLOW_JWT_SECRET' ? 'test-secret' : undefined),
  };
  const service = new McpOAuthService(model as any, configService as any);
  return { service, model };
};

describe('McpOAuthService', () => {
  it('does not report an unreadable encrypted token as connected', () => {
    const { service } = createService();

    const status = (service as any).sanitize({
      status: 'connected',
      serverUrl: 'https://mcp.example.com/mcp',
      tokens: 'enc:not-valid-for-this-secret',
    });

    expect(status).toEqual(expect.objectContaining({
      connected: false,
      status: 'error',
      error: expect.stringContaining('Reconectar do zero'),
    }));
  });

  it('keeps a decryptable access token connected', () => {
    const { service } = createService();
    const tokens = (service as any).encryptJson({ access_token: 'oauth-access-token', token_type: 'Bearer' });

    const status = (service as any).sanitize({
      status: 'connected',
      serverUrl: 'https://mcp.example.com/mcp',
      tokens,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(status).toEqual(expect.objectContaining({
      connected: true,
      status: 'connected',
      error: '',
    }));
  });

  it('clears stale token metadata when a new authorization URL is saved', async () => {
    const { service, model } = createService();

    await service.setAuthorizationUrl('connection-key', 'https://auth.example.com/authorize');

    expect(model.updateOne).toHaveBeenCalledWith(
      { key: 'connection-key' },
      {
        $set: {
          authorizationUrl: 'https://auth.example.com/authorize',
          status: 'pending',
          error: '',
        },
        $unset: {
          tokens: '',
          expiresAt: '',
          authenticatedAt: '',
        },
      },
    );
  });

  it('rejects unreadable stored tokens before starting the MCP transport', async () => {
    const row = {
      key: 'connection-key',
      status: 'connected',
      serverUrl: 'https://mcp.example.com/mcp',
      tokens: 'enc:not-valid-for-this-secret',
    };
    const { service } = createService(row);

    await expect(service.createRuntimeProvider({
      serverUrl: 'https://mcp.example.com/mcp',
      agentId: 'agent-1',
    })).rejects.toThrow('Reconectar do zero');
  });

  it('keeps the legacy shared key and isolates user-scoped OAuth keys', () => {
    const { service } = createService();
    const serverUrl = 'https://mcp.example.com/mcp';
    const shared = (service as any).connectionKey({ organizationId: 'org-1', agentId: 'agent-1' }, serverUrl);
    const userOne = (service as any).connectionKey({
      organizationId: 'org-1',
      agentId: 'agent-1',
      connectionScope: 'user',
      oauthUserId: 'user-1',
    }, serverUrl);
    const userTwo = (service as any).connectionKey({
      organizationId: 'org-1',
      agentId: 'agent-1',
      connectionScope: 'user',
      oauthUserId: 'user-2',
    }, serverUrl);

    expect(shared).not.toContain(':user:');
    expect(userOne).toContain(':user:user-1:');
    expect(userTwo).toContain(':user:user-2:');
    expect(new Set([shared, userOne, userTwo])).toHaveProperty('size', 3);
  });

  it('requires an authenticated Canvas Flow user for individual OAuth', async () => {
    const { service } = createService();

    await expect(service.createRuntimeProvider({
      serverUrl: 'https://mcp.example.com/mcp',
      agentId: 'agent-1',
      connectionScope: 'user',
    })).rejects.toThrow('usuario Canvas Flow autenticado');
  });

  it('uses the official Gmail scopes when the client does not send explicit OAuth scopes', () => {
    const { service } = createService();

    expect((service as any).defaultScopeForServer('https://gmailmcp.googleapis.com/mcp/v1')).toBe([
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
    ].join(' '));
  });
});
