import { Body, Controller, Delete, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth-service';
import { McpOAuthService } from './mcp-oauth-service';

@ApiTags('mcp-oauth')
@Controller('api/mcp-oauth')
export class McpOAuthController {
  constructor(
    private readonly service: McpOAuthService,
    private readonly authService: AuthService,
  ) {}

  private async assertAuth(authorization?: string, headerToken?: string, xApiKey?: string) {
    return await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
  }

  private requestBaseUrl(req: any) {
    const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
    const forwardedHost = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
    const proto = forwardedProto || req.protocol || 'http';
    const host = forwardedHost || req.get?.('host') || req.headers?.host || '';
    return host ? `${proto}://${host}` : '';
  }

  private html(status: 'ok' | 'error', message: string) {
    const safeMessage = String(message || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const title = status === 'ok' ? 'OAuth MCP conectado' : 'Falha no OAuth MCP';
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
      main { max-width: 560px; margin: 0 auto; border: 1px solid #dbeafe; border-radius: 8px; padding: 20px; }
      h1 { font-size: 20px; margin: 0 0 10px; }
      p { color: #475569; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${safeMessage}</p>
      <p>Voce ja pode voltar ao Canvas Flow.</p>
    </main>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: "canvas-flow-mcp-oauth", status: "${status}" }, "*");
        setTimeout(function () { window.close(); }, 900);
      }
    </script>
  </body>
</html>`;
  }

  @Post('start')
  async start(
    @Body() body: any,
    @Req() req: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.startAuthorization({
      serverUrl: body?.serverUrl,
      agentId: body?.agentId,
      organizationId: user?.organizationId || body?.organizationId,
      userId: user?.id,
      connectionScope: body?.connectionScope,
      oauthUserId: user?.id,
      label: body?.label,
      scope: body?.scope,
      clientName: body?.clientName,
      baseUrl: this.requestBaseUrl(req),
    });
  }

  @Get('status')
  async status(
    @Query('serverUrl') serverUrl: string,
    @Query('agentId') agentId?: string,
    @Query('connectionScope') connectionScope?: 'agent' | 'user',
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.getStatus({
      serverUrl,
      agentId,
      organizationId: user?.organizationId,
      connectionScope,
      oauthUserId: user?.id,
    });
  }

  @Delete()
  async disconnect(
    @Query('serverUrl') serverUrl: string,
    @Query('agentId') agentId?: string,
    @Query('connectionScope') connectionScope?: 'agent' | 'user',
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.disconnect({
      serverUrl,
      agentId,
      organizationId: user?.organizationId,
      connectionScope,
      oauthUserId: user?.id,
    });
  }

  @Get('callback')
  async callback(
    @Query('state') state: string,
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: any,
  ) {
    try {
      await this.service.finishAuthorization({ state, code, error });
      res.status(200).type('html').send(this.html('ok', 'Autorizacao concluida com sucesso.'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao concluir OAuth.';
      res.status(400).type('html').send(this.html('error', message));
    }
  }
}
