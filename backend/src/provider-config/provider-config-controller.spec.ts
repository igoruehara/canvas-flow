import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ProviderConfigController } from './provider-config-controller';

const createController = () => {
  const safeResponse = {
    settings: { openai: { apiKey: '', chatModel: 'gpt-4o' } },
    secretStatus: { 'openai.apiKey': true },
    providerStatus: { openai: { configured: true, source: 'global', scopeConfigured: true, inherited: false } },
  };
  const service = {
    getSafeSettings: jest.fn().mockResolvedValue(safeResponse),
    updateSettings: jest.fn().mockResolvedValue(safeResponse),
    clearSection: jest.fn().mockResolvedValue(safeResponse),
    completeWhatsappEmbeddedSignup: jest.fn().mockResolvedValue({
      ...safeResponse,
      onboarding: { ok: true, phoneNumberId: 'phone-1' },
    }),
  };
  const authService = {
    assertUiAuth: jest.fn().mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
    }),
  };

  const controller = new ProviderConfigController(service as any, authService as any);
  return { controller, service, authService, safeResponse };
};

describe('ProviderConfigController', () => {
  it('authenticates GET and returns safe service response for the requested agent', async () => {
    const { controller, service, authService, safeResponse } = createController();

    const result = await controller.getConfig('agent-query', 'Bearer jwt', 'ui-token', 'api-key');

    expect(result).toBe(safeResponse);
    expect(authService.assertUiAuth).toHaveBeenCalledWith('Bearer jwt', 'ui-token', 'api-key');
    expect(service.getSafeSettings).toHaveBeenCalledWith('agent-query');
  });

  it('authenticates PUT and delegates settings with body agentId taking precedence', async () => {
    const { controller, service, authService, safeResponse } = createController();
    const settings = { openai: { chatModel: 'gpt-4.1' } };

    const result = await controller.updateConfig(
      { agentId: 'agent-body', settings },
      'agent-query',
      'Bearer jwt',
      'ui-token',
      'api-key',
    );

    expect(result).toBe(safeResponse);
    expect(authService.assertUiAuth).toHaveBeenCalledWith('Bearer jwt', 'ui-token', 'api-key');
    expect(service.updateSettings).toHaveBeenCalledWith(settings, 'user-1', 'agent-body');
  });

  it('authenticates embedded signup and delegates body payload with scoped agentId', async () => {
    const { controller, service, authService } = createController();
    const body = {
      agentId: 'agent-body',
      appId: 'app-1',
      configId: 'config-1',
      code: 'oauth-code',
    };

    const result = await controller.completeWhatsappEmbeddedSignup(
      body,
      'agent-query',
      'Bearer jwt',
      'ui-token',
      'api-key',
    );

    expect(result).toEqual(expect.objectContaining({ onboarding: { ok: true, phoneNumberId: 'phone-1' } }));
    expect(authService.assertUiAuth).toHaveBeenCalledWith('Bearer jwt', 'ui-token', 'api-key');
    expect(service.completeWhatsappEmbeddedSignup).toHaveBeenCalledWith(body, 'user-1', 'agent-body');
  });

  it('authenticates DELETE and delegates scoped section deletion', async () => {
    const { controller, service, authService, safeResponse } = createController();

    const result = await controller.clearConfigSection('openai', 'agent-query', 'Bearer jwt', 'ui-token', 'api-key');

    expect(result).toBe(safeResponse);
    expect(authService.assertUiAuth).toHaveBeenCalledWith('Bearer jwt', 'ui-token', 'api-key');
    expect(service.clearSection).toHaveBeenCalledWith('openai', 'user-1', 'agent-query');
  });

  it('rejects unauthenticated requests before calling the service', async () => {
    const { controller, service, authService } = createController();
    authService.assertUiAuth.mockRejectedValue(new UnauthorizedException('Unauthorized'));

    await expect(controller.getConfig(undefined, undefined, undefined, undefined))
      .rejects
      .toBeInstanceOf(UnauthorizedException);
    expect(service.getSafeSettings).not.toHaveBeenCalled();
    expect(service.updateSettings).not.toHaveBeenCalled();
    expect(service.clearSection).not.toHaveBeenCalled();
    expect(service.completeWhatsappEmbeddedSignup).not.toHaveBeenCalled();
  });

  it('propagates service validation errors without post-processing', async () => {
    const { controller, service } = createController();
    const error = new BadRequestException('Provider invalido.');
    service.clearSection.mockRejectedValue(error);

    await expect(controller.clearConfigSection('unknown', undefined, 'Bearer jwt'))
      .rejects
      .toBe(error);
  });
});
