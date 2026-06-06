"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpOAuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("../auth/auth-service");
const mcp_oauth_service_1 = require("./mcp-oauth-service");
let McpOAuthController = class McpOAuthController {
    constructor(service, authService) {
        this.service = service;
        this.authService = authService;
    }
    async assertAuth(authorization, headerToken, xApiKey) {
        return await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    }
    requestBaseUrl(req) {
        const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
        const forwardedHost = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
        const proto = forwardedProto || req.protocol || 'http';
        const host = forwardedHost || req.get?.('host') || req.headers?.host || '';
        return host ? `${proto}://${host}` : '';
    }
    html(status, message) {
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
    async start(body, req, authorization, headerToken, xApiKey) {
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
    async status(serverUrl, agentId, connectionScope, authorization, headerToken, xApiKey) {
        const user = await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.getStatus({
            serverUrl,
            agentId,
            organizationId: user?.organizationId,
            connectionScope,
            oauthUserId: user?.id,
        });
    }
    async disconnect(serverUrl, agentId, connectionScope, authorization, headerToken, xApiKey) {
        const user = await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.disconnect({
            serverUrl,
            agentId,
            organizationId: user?.organizationId,
            connectionScope,
            oauthUserId: user?.id,
        });
    }
    async callback(state, code, error, res) {
        try {
            await this.service.finishAuthorization({ state, code, error });
            res.status(200).type('html').send(this.html('ok', 'Autorizacao concluida com sucesso.'));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Falha ao concluir OAuth.';
            res.status(400).type('html').send(this.html('error', message));
        }
    }
};
exports.McpOAuthController = McpOAuthController;
__decorate([
    (0, common_1.Post)('start'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], McpOAuthController.prototype, "start", null);
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Query)('serverUrl')),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Query)('connectionScope')),
    __param(3, (0, common_1.Headers)('authorization')),
    __param(4, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(5, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], McpOAuthController.prototype, "status", null);
__decorate([
    (0, common_1.Delete)(),
    __param(0, (0, common_1.Query)('serverUrl')),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Query)('connectionScope')),
    __param(3, (0, common_1.Headers)('authorization')),
    __param(4, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(5, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], McpOAuthController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Query)('state')),
    __param(1, (0, common_1.Query)('code')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], McpOAuthController.prototype, "callback", null);
exports.McpOAuthController = McpOAuthController = __decorate([
    (0, swagger_1.ApiTags)('mcp-oauth'),
    (0, common_1.Controller)('api/mcp-oauth'),
    __metadata("design:paramtypes", [mcp_oauth_service_1.McpOAuthService,
        auth_service_1.AuthService])
], McpOAuthController);
//# sourceMappingURL=mcp-oauth-controller.js.map