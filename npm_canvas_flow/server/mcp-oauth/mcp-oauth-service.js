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
exports.McpOAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_js_1 = require("@modelcontextprotocol/sdk/client/auth.js");
const crypto_1 = require("crypto");
const mongoose_1 = require("mongoose");
const mcp_oauth_constants_model_1 = require("./mcp-oauth-constants-model");
class PersistentMcpOAuthProvider {
    constructor(service, key, redirectUrlValue, clientMetadataValue) {
        this.service = service;
        this.key = key;
        this.redirectUrlValue = redirectUrlValue;
        this.clientMetadataValue = clientMetadataValue;
        this.latestAuthorizationUrl = '';
    }
    get redirectUrl() {
        return this.redirectUrlValue;
    }
    get clientMetadata() {
        return this.clientMetadataValue;
    }
    async state() {
        return (await this.service.getConnectionByKey(this.key))?.state || undefined;
    }
    async clientInformation() {
        return await this.service.getEncryptedJson(this.key, 'clientInformation');
    }
    async saveClientInformation(clientInformation) {
        await this.service.saveEncryptedJson(this.key, 'clientInformation', clientInformation);
    }
    async tokens() {
        return await this.service.getEncryptedJson(this.key, 'tokens');
    }
    async saveTokens(tokens) {
        await this.service.saveTokens(this.key, tokens);
    }
    async redirectToAuthorization(authorizationUrl) {
        this.latestAuthorizationUrl = authorizationUrl.toString();
        await this.service.setAuthorizationUrl(this.key, this.latestAuthorizationUrl);
    }
    async saveCodeVerifier(codeVerifier) {
        await this.service.saveEncryptedJson(this.key, 'codeVerifier', { value: codeVerifier });
    }
    async codeVerifier() {
        const stored = await this.service.getEncryptedJson(this.key, 'codeVerifier');
        const value = String(stored?.value || '');
        if (!value)
            throw new Error('OAuth code verifier nao encontrado para este servidor MCP.');
        return value;
    }
    async saveDiscoveryState(state) {
        await this.service.saveEncryptedJson(this.key, 'discoveryState', state);
    }
    async discoveryState() {
        return await this.service.getEncryptedJson(this.key, 'discoveryState');
    }
    async invalidateCredentials(scope) {
        await this.service.invalidateCredentials(this.key, scope);
    }
}
let McpOAuthService = class McpOAuthService {
    constructor(model, configService) {
        this.model = model;
        this.configService = configService;
    }
    normalizeAgentId(agentId) {
        return String(agentId || '').trim() || 'default-agent';
    }
    normalizeOrganizationId(organizationId) {
        return String(organizationId || '').trim();
    }
    normalizeConnectionScope(connectionScope) {
        return connectionScope === 'user' ? 'user' : 'agent';
    }
    normalizeOAuthUserId(scope) {
        const oauthUserId = String(scope.oauthUserId || '').trim();
        if (this.normalizeConnectionScope(scope.connectionScope) === 'user' && !oauthUserId) {
            throw new common_1.BadRequestException('OAuth MCP individual exige um usuario Canvas Flow autenticado. Ative o login ou use a conexao compartilhada no agente.');
        }
        return oauthUserId;
    }
    normalizeServerUrl(value) {
        const raw = String(value || '').trim();
        if (!raw)
            throw new common_1.BadRequestException('Informe a URL do servidor MCP.');
        let url;
        try {
            url = new URL(raw);
        }
        catch {
            throw new common_1.BadRequestException('URL do servidor MCP invalida.');
        }
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new common_1.BadRequestException('OAuth MCP suporta apenas servidores HTTP/HTTPS.');
        }
        url.hash = '';
        if (url.pathname.length > 1)
            url.pathname = url.pathname.replace(/\/+$/, '');
        return url.toString();
    }
    serverUrlHash(serverUrl) {
        return (0, crypto_1.createHash)('sha256').update(serverUrl).digest('hex');
    }
    connectionKey(scope, serverUrl) {
        const organizationId = this.normalizeOrganizationId(scope.organizationId);
        const agentId = this.normalizeAgentId(scope.agentId);
        const connectionScope = this.normalizeConnectionScope(scope.connectionScope);
        const oauthUserId = this.normalizeOAuthUserId(scope);
        const legacyKey = `${organizationId || 'global'}:${agentId}:${this.serverUrlHash(serverUrl)}`;
        return connectionScope === 'user'
            ? `${organizationId || 'global'}:${agentId}:user:${oauthUserId}:${this.serverUrlHash(serverUrl)}`
            : legacyKey;
    }
    secretKey() {
        return (this.configService.get('CANVAS_FLOW_JWT_SECRET') ||
            this.configService.get('CANVAS_FLOW_API_TOKEN') ||
            this.configService.get('MONGO_DB_CONNECTION_STRING') ||
            'canvas-flow-mcp-oauth-dev-secret');
    }
    encryptText(value) {
        const plain = String(value || '');
        if (!plain)
            return '';
        const key = (0, crypto_1.createHash)('sha256').update(this.secretKey()).digest();
        const iv = (0, crypto_1.randomBytes)(12);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `enc:${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`;
    }
    decryptText(value) {
        const raw = String(value || '');
        if (!raw.startsWith('enc:'))
            return raw;
        try {
            const payload = Buffer.from(raw.slice(4), 'base64url');
            const iv = payload.subarray(0, 12);
            const tag = payload.subarray(12, 28);
            const encrypted = payload.subarray(28);
            const key = (0, crypto_1.createHash)('sha256').update(this.secretKey()).digest();
            const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
        }
        catch {
            return '';
        }
    }
    encryptJson(value) {
        if (value === undefined || value === null)
            return '';
        return this.encryptText(JSON.stringify(value));
    }
    decryptJson(value) {
        const text = this.decryptText(value);
        if (!text)
            return undefined;
        try {
            return JSON.parse(text);
        }
        catch {
            return undefined;
        }
    }
    assertDbReady() {
        if (this.model.db.readyState !== 1) {
            throw new common_1.BadRequestException('MongoDB ainda nao esta conectado para salvar OAuth MCP.');
        }
    }
    buildCallbackUrl(baseUrl) {
        const configured = (this.configService.get('CANVAS_FLOW_PUBLIC_URL') ||
            this.configService.get('CANVAS_FLOW_API_PUBLIC_URL') ||
            baseUrl ||
            '').replace(/\/$/, '');
        if (!configured) {
            throw new common_1.BadRequestException('Nao foi possivel montar a URL publica de callback OAuth.');
        }
        return `${configured}/api/mcp-oauth/callback`;
    }
    buildClientMetadata(params) {
        return {
            client_name: String(params.clientName || 'Canvas Flow MCP OAuth').trim() || 'Canvas Flow MCP OAuth',
            redirect_uris: [params.redirectUrl],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            ...(params.scope ? { scope: params.scope } : {}),
        };
    }
    defaultScopeForServer(serverUrl) {
        let hostname = '';
        try {
            hostname = new URL(serverUrl).hostname.toLowerCase();
        }
        catch {
            return '';
        }
        const scopes = {
            'gmailmcp.googleapis.com': [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.compose',
            ],
            'drivemcp.googleapis.com': [
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/drive.file',
            ],
            'calendarmcp.googleapis.com': [
                'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
                'https://www.googleapis.com/auth/calendar.events.freebusy',
                'https://www.googleapis.com/auth/calendar.events.readonly',
            ],
            'chatmcp.googleapis.com': [
                'https://www.googleapis.com/auth/chat.spaces.readonly',
                'https://www.googleapis.com/auth/chat.memberships.readonly',
                'https://www.googleapis.com/auth/chat.messages.readonly',
                'https://www.googleapis.com/auth/chat.messages.create',
                'https://www.googleapis.com/auth/chat.users.readstate.readonly',
            ],
            'people.googleapis.com': [
                'https://www.googleapis.com/auth/directory.readonly',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/contacts.readonly',
            ],
        }[hostname] || [];
        return scopes.join(' ');
    }
    isFigmaServer(serverUrl) {
        try {
            return new URL(serverUrl).hostname.toLowerCase().endsWith('figma.com');
        }
        catch {
            return false;
        }
    }
    isAtlassianServer(serverUrl) {
        try {
            const url = new URL(serverUrl);
            return url.hostname.toLowerCase().endsWith('atlassian.com');
        }
        catch {
            return false;
        }
    }
    getStaticClientInformation(serverUrl) {
        if (this.isAtlassianServer(serverUrl))
            return undefined;
        const figmaPrefix = this.isFigmaServer(serverUrl) ? 'FIGMA_MCP_OAUTH' : '';
        const clientId = String((figmaPrefix ? this.configService.get(`${figmaPrefix}_CLIENT_ID`) : '') ||
            this.configService.get('CANVAS_MCP_OAUTH_CLIENT_ID') ||
            '').trim();
        if (!clientId)
            return undefined;
        const clientSecret = String((figmaPrefix ? this.configService.get(`${figmaPrefix}_CLIENT_SECRET`) : '') ||
            this.configService.get('CANVAS_MCP_OAUTH_CLIENT_SECRET') ||
            '').trim();
        const tokenEndpointAuthMethod = String((figmaPrefix ? this.configService.get(`${figmaPrefix}_TOKEN_AUTH_METHOD`) : '') ||
            this.configService.get('CANVAS_MCP_OAUTH_TOKEN_AUTH_METHOD') ||
            (clientSecret ? 'client_secret_post' : 'none')).trim();
        return {
            client_id: clientId,
            ...(clientSecret ? { client_secret: clientSecret } : {}),
            ...(tokenEndpointAuthMethod ? { token_endpoint_auth_method: tokenEndpointAuthMethod } : {}),
        };
    }
    formatStartError(serverUrl, error) {
        const message = error instanceof Error ? error.message : 'Falha ao iniciar OAuth MCP.';
        if (this.isFigmaServer(serverUrl) && /403|Forbidden/i.test(message)) {
            return [
                'A Figma bloqueou o registro OAuth deste cliente MCP remoto.',
                'O escopo mcp:connect aceita apenas clientes aprovados no Figma MCP Catalog.',
                'Nao coloque credenciais em Headers JSON: use um cliente aprovado pela Figma ou configure FIGMA_MCP_OAUTH_CLIENT_ID/FIGMA_MCP_OAUTH_CLIENT_SECRET se a Figma forneceu essas credenciais.',
            ].join(' ');
        }
        return message;
    }
    inspectStoredTokens(row) {
        const tokens = this.decryptJson(row?.tokens);
        if (!row?.tokens) {
            return { tokens: undefined, usable: false, error: '' };
        }
        if (!tokens || (!String(tokens.access_token || '').trim() && !String(tokens.refresh_token || '').trim())) {
            return {
                tokens: undefined,
                usable: false,
                error: 'O token OAuth salvo nao pode ser lido pelo backend atual. Use Reconectar do zero.',
            };
        }
        const expiresAt = row?.expiresAt ? new Date(row.expiresAt).getTime() : 0;
        if (expiresAt && expiresAt <= Date.now() && !String(tokens.refresh_token || '').trim()) {
            return {
                tokens,
                usable: false,
                error: 'O token OAuth expirou e o servidor nao forneceu refresh token. Use Reconectar do zero.',
            };
        }
        return { tokens, usable: true, error: '' };
    }
    sanitize(row) {
        if (!row)
            return null;
        const storedTokens = this.inspectStoredTokens(row);
        const connected = row.status === 'connected' && storedTokens.usable;
        return {
            connected,
            status: (row.status === 'connected' && !connected ? 'error' : row.status || 'pending'),
            serverUrl: row.serverUrl,
            agentId: row.agentId || '',
            organizationId: row.organizationId || '',
            connectionScope: this.normalizeConnectionScope(row.connectionScope),
            label: row.label || '',
            scope: row.scope || '',
            authorizationUrl: row.status === 'pending' ? row.authorizationUrl || '' : '',
            expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : '',
            authenticatedAt: row.authenticatedAt ? new Date(row.authenticatedAt).toISOString() : '',
            updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : '',
            error: row.error || storedTokens.error || '',
        };
    }
    async getConnectionByKey(key) {
        if (this.model.db.readyState !== 1)
            return null;
        return await this.model.findOne({ key }).lean().exec();
    }
    async getEncryptedJson(key, field) {
        const row = await this.getConnectionByKey(key);
        return this.decryptJson(row?.[field]);
    }
    async saveEncryptedJson(key, field, value) {
        this.assertDbReady();
        await this.model.updateOne({ key }, { $set: { [field]: this.encryptJson(value) } }).exec();
    }
    async saveTokens(key, tokens) {
        this.assertDbReady();
        const expiresIn = Number(tokens?.expires_in || 0);
        const expiresAt = expiresIn > 0 ? new Date(Date.now() + Math.max(expiresIn - 30, 1) * 1000) : undefined;
        await this.model.updateOne({ key }, {
            $set: {
                tokens: this.encryptJson(tokens),
                status: 'connected',
                error: '',
                authorizationUrl: '',
                authenticatedAt: new Date(),
                ...(expiresAt ? { expiresAt } : {}),
            },
            $unset: {
                codeVerifier: '',
                ...(expiresAt ? {} : { expiresAt: '' }),
            },
        }).exec();
    }
    async setAuthorizationUrl(key, authorizationUrl) {
        this.assertDbReady();
        await this.model.updateOne({ key }, {
            $set: { authorizationUrl, status: 'pending', error: '' },
            $unset: { tokens: '', expiresAt: '', authenticatedAt: '' },
        }).exec();
    }
    async invalidateCredentials(key, scope) {
        this.assertDbReady();
        const unset = {};
        if (scope === 'all' || scope === 'client')
            unset.clientInformation = '';
        if (scope === 'all' || scope === 'tokens')
            unset.tokens = '';
        if (scope === 'all' || scope === 'verifier')
            unset.codeVerifier = '';
        if (scope === 'all' || scope === 'discovery')
            unset.discoveryState = '';
        if (scope === 'all' || scope === 'tokens') {
            unset.expiresAt = '';
            unset.authenticatedAt = '';
        }
        await this.model.updateOne({ key }, { $unset: unset, $set: { status: 'pending' } }).exec();
    }
    createProvider(row) {
        return new PersistentMcpOAuthProvider(this, row.key, row.redirectUrl, row.clientMetadata || this.buildClientMetadata({ redirectUrl: row.redirectUrl, scope: row.scope }));
    }
    async startAuthorization(params) {
        this.assertDbReady();
        const serverUrl = this.normalizeServerUrl(params.serverUrl);
        const organizationId = this.normalizeOrganizationId(params.organizationId);
        const agentId = this.normalizeAgentId(params.agentId);
        const connectionScope = this.normalizeConnectionScope(params.connectionScope);
        const oauthUserId = this.normalizeOAuthUserId({ connectionScope, oauthUserId: params.oauthUserId });
        const key = this.connectionKey({ organizationId, agentId, connectionScope, oauthUserId }, serverUrl);
        const redirectUrl = this.buildCallbackUrl(params.baseUrl);
        const scope = String(params.scope || this.defaultScopeForServer(serverUrl)).trim();
        const state = (0, crypto_1.randomBytes)(24).toString('base64url');
        const clientMetadata = this.buildClientMetadata({
            redirectUrl,
            scope,
            clientName: params.clientName,
        });
        const staticClientInformation = this.getStaticClientInformation(serverUrl);
        const update = {
            key,
            organizationId,
            agentId,
            connectionScope,
            ...(oauthUserId ? { oauthUserId } : {}),
            serverUrl,
            serverUrlHash: this.serverUrlHash(serverUrl),
            label: String(params.label || '').trim(),
            scope,
            redirectUrl,
            state,
            status: 'pending',
            error: '',
            clientMetadata,
            updatedBy: params.userId || '',
            ...(params.userId ? { createdBy: params.userId } : {}),
        };
        await this.model.findOneAndUpdate({ key }, {
            $set: {
                ...update,
                ...(staticClientInformation ? { clientInformation: this.encryptJson(staticClientInformation) } : {}),
            },
            $unset: {
                authorizationUrl: '',
                tokens: '',
                expiresAt: '',
                authenticatedAt: '',
                codeVerifier: '',
                discoveryState: '',
                ...(oauthUserId ? {} : { oauthUserId: '' }),
                ...(staticClientInformation ? {} : { clientInformation: '' }),
            },
        }, { upsert: true, new: true }).lean().exec();
        const provider = this.createProvider({ ...update });
        try {
            const result = await (0, auth_js_1.auth)(provider, { serverUrl, scope: scope || undefined });
            if (result === 'AUTHORIZED') {
                const row = await this.getConnectionByKey(key);
                return this.sanitize(row);
            }
            const row = await this.getConnectionByKey(key);
            return this.sanitize(row);
        }
        catch (error) {
            const message = this.formatStartError(serverUrl, error);
            await this.model.updateOne({ key }, { $set: { status: 'error', error: message } }).exec();
            throw new common_1.BadRequestException(message);
        }
    }
    async finishAuthorization(params) {
        this.assertDbReady();
        const state = String(params.state || '').trim();
        if (!state)
            throw new common_1.BadRequestException('Callback OAuth sem state.');
        const row = await this.model.findOne({ state }).lean().exec();
        if (!row)
            throw new common_1.NotFoundException('Conexao OAuth MCP nao encontrada.');
        if (params.error) {
            const message = String(params.error || 'OAuth negado.');
            await this.model.updateOne({ key: row.key }, { $set: { status: 'error', error: message } }).exec();
            throw new common_1.BadRequestException(message);
        }
        const code = String(params.code || '').trim();
        if (!code)
            throw new common_1.BadRequestException('Callback OAuth sem authorization code.');
        const provider = this.createProvider(row);
        try {
            await (0, auth_js_1.auth)(provider, {
                serverUrl: row.serverUrl,
                authorizationCode: code,
                scope: row.scope || undefined,
            });
            const updated = await this.getConnectionByKey(row.key);
            return this.sanitize(updated);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao concluir OAuth MCP.';
            await this.model.updateOne({ key: row.key }, { $set: { status: 'error', error: message } }).exec();
            throw new common_1.BadRequestException(message);
        }
    }
    async getStatus(params) {
        if (this.model.db.readyState !== 1)
            return { connected: false, status: 'error', error: 'MongoDB nao conectado.' };
        const serverUrl = this.normalizeServerUrl(params.serverUrl);
        const key = this.connectionKey(params, serverUrl);
        const row = await this.getConnectionByKey(key);
        return this.sanitize(row) || {
            connected: false,
            status: 'pending',
            serverUrl,
            agentId: this.normalizeAgentId(params.agentId),
            organizationId: this.normalizeOrganizationId(params.organizationId),
            connectionScope: this.normalizeConnectionScope(params.connectionScope),
            error: '',
        };
    }
    async disconnect(params) {
        this.assertDbReady();
        const serverUrl = this.normalizeServerUrl(params.serverUrl);
        const key = this.connectionKey(params, serverUrl);
        await this.model.deleteOne({ key }).exec();
        return {
            connected: false,
            status: 'pending',
            serverUrl,
            agentId: this.normalizeAgentId(params.agentId),
            organizationId: this.normalizeOrganizationId(params.organizationId),
            connectionScope: this.normalizeConnectionScope(params.connectionScope),
            error: '',
        };
    }
    async createRuntimeProvider(params) {
        const serverUrl = this.normalizeServerUrl(params.serverUrl);
        const key = this.connectionKey(params, serverUrl);
        const row = await this.getConnectionByKey(key);
        const storedTokens = this.inspectStoredTokens(row);
        if (!row?.tokens || row.status !== 'connected' || !storedTokens.usable) {
            const agentId = this.normalizeAgentId(params.agentId);
            const reason = storedTokens.error ? ` ${storedTokens.error}` : '';
            const scopeLabel = this.normalizeConnectionScope(params.connectionScope) === 'user'
                ? 'usuario Canvas Flow atual'
                : `agente "${agentId}"`;
            throw new common_1.BadRequestException(`Servidor MCP OAuth nao conectado para ${scopeLabel} e URL "${serverUrl}".${reason} Conecte em Autenticacao OAuth no node MCP antes de executar.`);
        }
        return this.createProvider(row);
    }
};
exports.McpOAuthService = McpOAuthService;
exports.McpOAuthService = McpOAuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(mcp_oauth_constants_model_1.MODEL_NAME)),
    __metadata("design:paramtypes", [mongoose_1.Model,
        config_1.ConfigService])
], McpOAuthService);
//# sourceMappingURL=mcp-oauth-service.js.map