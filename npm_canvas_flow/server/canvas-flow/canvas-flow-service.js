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
exports.CanvasFlowService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("mongoose");
const canvas_flow_constants_model_1 = require("./canvas-flow-constants-model");
let CanvasFlowService = class CanvasFlowService {
    constructor(model, agentModel, versionModel) {
        this.model = model;
        this.agentModel = agentModel;
        this.versionModel = versionModel;
    }
    normalizeAgentName(value) {
        return String(value || '').trim() || 'default-agent';
    }
    createAgentIdSlug(value) {
        const ascii = String(value || '')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const slug = ascii
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^[-_]+|[-_]+$/g, '');
        return slug || 'default-agent';
    }
    normalizeAgentDisplayName(value, fallback) {
        return String(value || fallback || '').trim() || 'Agente';
    }
    async nextAvailableAgentId(baseAgentId, organizationId) {
        const base = this.normalizeAgentName(baseAgentId);
        for (let index = 0; index < 1000; index += 1) {
            const candidate = index === 0 ? base : `${base}-${index + 1}`;
            const query = this.withOrganization({ agentId: candidate }, organizationId);
            const [agent, flow] = await Promise.all([
                this.agentModel.findOne(query).select('_id').lean().exec(),
                this.model.findOne(query).select('_id').lean().exec(),
            ]);
            if (!agent && !flow)
                return candidate;
        }
        return `${base}-${Date.now()}`;
    }
    async unsetOtherMainFlows(flow) {
        if (flow?.config?.isMainFlow !== true)
            return;
        const query = {
            _id: { $ne: flow._id },
            'config.isMainFlow': true,
        };
        if (flow.agentId)
            query.agentId = flow.agentId;
        if (flow.organizationId)
            query.organizationId = flow.organizationId;
        if (flow.config?.channel)
            query['config.channel'] = flow.config.channel;
        await this.model.updateMany(query, { $set: { 'config.isMainFlow': false } }).exec();
    }
    withOrganization(query, organizationId) {
        if (organizationId)
            query.organizationId = organizationId;
        return query;
    }
    scopedQuery(agentId, organizationId) {
        return this.withOrganization(agentId ? { agentId } : {}, organizationId);
    }
    agentQuery(agentId, organizationId) {
        const query = {};
        if (agentId) {
            const normalized = this.normalizeAgentName(agentId);
            query.$or = [
                { agentId: normalized },
                { name: normalized, $or: [{ agentId: { $exists: false } }, { agentId: '' }, { agentId: null }] },
            ];
        }
        if (organizationId)
            query.organizationId = organizationId;
        return query;
    }
    agentDisplayNameQuery(name, organizationId, excludeAgentId) {
        const query = { name: this.normalizeAgentDisplayName(name) };
        if (organizationId)
            query.organizationId = organizationId;
        if (excludeAgentId)
            query.agentId = { $ne: this.normalizeAgentName(excludeAgentId) };
        return query;
    }
    async ensureAgent(agentId, auth, displayName) {
        const id = this.normalizeAgentName(agentId);
        const name = this.normalizeAgentDisplayName(displayName, id);
        const sortOrder = await this.nextAgentSortOrder(auth?.organizationId);
        await this.agentModel.updateOne(this.agentQuery(id, auth?.organizationId), {
            $set: {
                agentId: id,
            },
            $setOnInsert: {
                name,
                sortOrder,
                ...(auth?.organizationId ? { organizationId: auth.organizationId } : {}),
                ...(auth?.userId ? { createdBy: auth.userId } : {}),
            },
        }, { upsert: true }).exec();
    }
    sortFlows(flows) {
        return flows.sort((a, b) => {
            const orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER;
            const orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB)
                return orderA - orderB;
            return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        });
    }
    sortAgents(agents) {
        return agents.sort((a, b) => {
            const orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER;
            const orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB)
                return orderA - orderB;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
    }
    cloneJson(value) {
        if (value === undefined || value === null)
            return value;
        return JSON.parse(JSON.stringify(value));
    }
    isPlainObject(value) {
        return Boolean(value && typeof value === 'object' && !Array.isArray(value));
    }
    normalizeObjectList(value) {
        if (!Array.isArray(value))
            return [];
        return value
            .filter((item) => this.isPlainObject(item))
            .map((item) => this.cloneJson(item));
    }
    normalizeBlockedTerms(value) {
        if (Array.isArray(value)) {
            return value.map((item) => String(item || '').trim()).filter(Boolean);
        }
        return String(value || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    normalizeAgentRuntimeConfig(value) {
        const input = this.isPlainObject(value) ? value : {};
        const provider = String(input.llmProvider || '').trim();
        const allowedProviders = new Set(['openai', 'azure_openai', 'azure', 'gemini', 'claude', 'grok', 'bedrock']);
        const spec = this.isPlainObject(input.agentSpec) ? input.agentSpec : {};
        return {
            ...(String(input.model || '').trim() ? { model: String(input.model || '').trim() } : {}),
            ...(allowedProviders.has(provider) ? { llmProvider: provider } : {}),
            agentSpec: {
                agentsMd: String(spec.agentsMd || ''),
                guardrails: String(spec.guardrails || ''),
                blockedTerms: this.normalizeBlockedTerms(spec.blockedTerms),
                rules: this.normalizeObjectList(spec.rules),
                skills: this.normalizeObjectList(spec.skills),
                subagents: this.normalizeObjectList(spec.subagents),
                mcpServers: this.normalizeObjectList(spec.mcpServers),
            },
        };
    }
    safeWorkspaceFileName(value, fallback) {
        const source = String(value || fallback || '').trim() || fallback;
        return this.createAgentIdSlug(source).replace(/\.(rule|skill|agent|json|md)$/i, '') || fallback;
    }
    workspaceJson(value) {
        return `${JSON.stringify(value ?? {}, null, 2)}\n`;
    }
    workspaceFile(path, content, type = 'text/plain') {
        return {
            path,
            content: typeof content === 'string' ? content : this.workspaceJson(content),
            type,
            encoding: 'utf8',
        };
    }
    normalizeWorkspacePath(path) {
        return String(path || '')
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .toLowerCase();
    }
    workspaceFilesFromPayload(payload) {
        const source = this.isPlainObject(payload?.workspace) ? payload.workspace : payload;
        const rawFiles = Array.isArray(source?.files)
            ? source.files
            : Array.isArray(payload?.files)
                ? payload.files
                : [];
        const objectFiles = !rawFiles.length && this.isPlainObject(source?.files)
            ? Object.entries(source.files).map(([path, content]) => ({ path, content }))
            : [];
        return [...rawFiles, ...objectFiles]
            .map((file) => ({
            path: String(file?.path || '').trim(),
            content: typeof file?.content === 'string'
                ? file.content
                : file?.content === undefined || file?.content === null
                    ? ''
                    : this.workspaceJson(file.content),
            type: String(file?.type || '').trim() || undefined,
            encoding: String(file?.encoding || '').trim() || undefined,
        }))
            .filter((file) => file.path);
    }
    readWorkspaceFile(files, path) {
        const target = this.normalizeWorkspacePath(path);
        return files.find((file) => this.normalizeWorkspacePath(file.path) === target)?.content;
    }
    readWorkspaceFolder(files, folder) {
        const target = this.normalizeWorkspacePath(folder).replace(/\/?$/, '/');
        return files
            .filter((file) => {
            const path = this.normalizeWorkspacePath(file.path);
            return path.startsWith(target) && path.endsWith('.json');
        })
            .sort((a, b) => this.normalizeWorkspacePath(a.path).localeCompare(this.normalizeWorkspacePath(b.path)));
    }
    parseWorkspaceJson(content, fallback) {
        if (content === undefined || content === null || content === '')
            return fallback;
        if (typeof content !== 'string')
            return content;
        try {
            return JSON.parse(content);
        }
        catch {
            return fallback;
        }
    }
    normalizeWorkspaceLoadMode(value, fallback = 'auto') {
        const mode = String(value || '').trim();
        if (mode === 'always' || mode === 'auto' || mode === 'on_demand' || mode === 'manual')
            return mode;
        return fallback;
    }
    catalogItemId(item, fallback) {
        return String(item?.id || item?.key || item?.name || item?.label || fallback).trim() || fallback;
    }
    catalogItemName(item, fallback) {
        return String(item?.name || item?.label || item?.title || this.catalogItemId(item, fallback)).trim() || fallback;
    }
    catalogItemDescription(item) {
        return String(item?.description || item?.role || item?.instructions || item?.instruction || item?.action || '').trim();
    }
    buildWorkspaceManifest(config) {
        const spec = config.agentSpec || {};
        const toEntries = (items, kind, fallbackLoad) => (Array.isArray(items) ? items : []).filter((item) => this.isPlainObject(item)).map((item, index) => ({
            id: this.catalogItemId(item, `${kind}-${index + 1}`),
            name: this.catalogItemName(item, `${kind}-${index + 1}`),
            description: this.catalogItemDescription(item),
            path: String(item.path || '').trim() || (kind === 'skill'
                ? `.canvas-flow/skills/${this.safeWorkspaceFileName(item.id || item.name, `skill-${index + 1}`)}/SKILL.md`
                : kind === 'subagent'
                    ? `.canvas-flow/subagents/${this.safeWorkspaceFileName(item.id || item.name, `subagent-${index + 1}`)}.agent.md`
                    : kind === 'mcp'
                        ? '.canvas-flow/mcp.json'
                        : `.canvas-flow/rules/${this.safeWorkspaceFileName(item.id || item.name, `rule-${index + 1}`)}.rule.json`),
            load: this.normalizeWorkspaceLoadMode(item.load || item.loadMode, fallbackLoad),
            enabled: item.enabled !== false,
        }));
        return {
            version: 1,
            agentsMd: { path: '.canvas-flow/agents.md', load: 'always' },
            guardrails: { path: '.canvas-flow/guardrails.md', load: 'always' },
            rules: toEntries(spec.rules, 'rule', 'always'),
            skills: toEntries(spec.skills, 'skill', 'auto'),
            subagents: toEntries(spec.subagents, 'subagent', 'auto'),
            mcpServers: toEntries(spec.mcpServers, 'mcp', 'on_demand'),
        };
    }
    applyWorkspaceManifestList(list, manifestEntries, kind, fallbackLoad) {
        const current = Array.isArray(list) ? list.filter((item) => this.isPlainObject(item)).map((item) => this.cloneJson(item)) : [];
        const entries = Array.isArray(manifestEntries) ? manifestEntries.filter((item) => this.isPlainObject(item)) : [];
        if (!entries.length)
            return current.map((item, index) => ({
                ...item,
                id: this.catalogItemId(item, `${kind}-${index + 1}`),
                load: this.normalizeWorkspaceLoadMode(item.load || item.loadMode, fallbackLoad),
            }));
        const byId = new Map(current.map((item, index) => [this.catalogItemId(item, `${kind}-${index + 1}`), item]));
        entries.forEach((entry, index) => {
            const id = this.catalogItemId(entry, `${kind}-${index + 1}`);
            const existing = byId.get(id) || current.find((item) => String(item.path || '').trim() && String(item.path || '').trim() === String(entry.path || '').trim());
            const merged = {
                ...(existing || {}),
                ...entry,
                id,
                name: this.catalogItemName(entry, this.catalogItemName(existing, id)),
                description: this.catalogItemDescription(entry) || this.catalogItemDescription(existing),
                load: this.normalizeWorkspaceLoadMode(entry.load || existing?.load, fallbackLoad),
                enabled: entry.enabled !== false && existing?.enabled !== false,
            };
            if (existing) {
                const existingIndex = current.indexOf(existing);
                current[existingIndex] = merged;
            }
            else {
                current.push(merged);
            }
            byId.set(id, merged);
        });
        return current;
    }
    applyWorkspaceManifestToSpec(spec, manifest) {
        if (!this.isPlainObject(manifest))
            return spec;
        return {
            ...spec,
            rules: this.applyWorkspaceManifestList(spec.rules, manifest.rules, 'rule', 'always'),
            skills: this.applyWorkspaceManifestList(spec.skills, manifest.skills, 'skill', 'auto'),
            subagents: this.applyWorkspaceManifestList(spec.subagents, manifest.subagents, 'subagent', 'auto'),
            mcpServers: this.applyWorkspaceManifestList(spec.mcpServers, manifest.mcpServers, 'mcp', 'on_demand'),
        };
    }
    workspaceConfigFromPayload(payload) {
        const source = this.isPlainObject(payload?.workspace) ? payload.workspace : payload;
        const files = this.workspaceFilesFromPayload(payload);
        const configSource = this.isPlainObject(source?.config)
            ? source.config
            : this.isPlainObject(payload?.config)
                ? payload.config
                : {};
        const base = this.normalizeAgentRuntimeConfig(configSource);
        const agentJson = this.parseWorkspaceJson(this.readWorkspaceFile(files, '.canvas-flow/agent.json'), {});
        const agentsMd = this.readWorkspaceFile(files, '.canvas-flow/agents.md');
        const guardrails = this.readWorkspaceFile(files, '.canvas-flow/guardrails.md');
        const blockedTermsFile = this.readWorkspaceFile(files, '.canvas-flow/blocked-terms.json');
        const rulesFile = this.readWorkspaceFile(files, '.canvas-flow/rules.json');
        const skillsFile = this.readWorkspaceFile(files, '.canvas-flow/skills.json');
        const subagentsFile = this.readWorkspaceFile(files, '.canvas-flow/subagents.json');
        const mcpFile = this.readWorkspaceFile(files, '.canvas-flow/mcp.json');
        const manifestFile = this.readWorkspaceFile(files, '.canvas-flow/manifest.json');
        const rulesFromFolder = this.readWorkspaceFolder(files, '.canvas-flow/rules')
            .map((file) => this.parseWorkspaceJson(file.content, null))
            .filter((item) => this.isPlainObject(item));
        const skillsFromFolder = this.readWorkspaceFolder(files, '.canvas-flow/skills')
            .map((file) => this.parseWorkspaceJson(file.content, null))
            .filter((item) => this.isPlainObject(item));
        const subagentsFromFolder = this.readWorkspaceFolder(files, '.canvas-flow/subagents')
            .map((file) => this.parseWorkspaceJson(file.content, null))
            .filter((item) => this.isPlainObject(item));
        const nextSpec = {
            ...(base.agentSpec || {}),
            ...(agentsMd !== undefined ? { agentsMd } : {}),
            ...(guardrails !== undefined ? { guardrails } : {}),
            ...(blockedTermsFile !== undefined ? { blockedTerms: this.parseWorkspaceJson(blockedTermsFile, blockedTermsFile) } : {}),
            ...(rulesFromFolder.length ? { rules: rulesFromFolder } : rulesFile !== undefined ? { rules: this.parseWorkspaceJson(rulesFile, []) } : {}),
            ...(skillsFromFolder.length ? { skills: skillsFromFolder } : skillsFile !== undefined ? { skills: this.parseWorkspaceJson(skillsFile, []) } : {}),
            ...(subagentsFromFolder.length ? { subagents: subagentsFromFolder } : subagentsFile !== undefined ? { subagents: this.parseWorkspaceJson(subagentsFile, []) } : {}),
            ...(mcpFile !== undefined ? { mcpServers: this.parseWorkspaceJson(mcpFile, []) } : {}),
        };
        const specWithManifest = this.applyWorkspaceManifestToSpec(nextSpec, this.parseWorkspaceJson(manifestFile, {}));
        return this.normalizeAgentRuntimeConfig({
            ...base,
            model: String(agentJson?.model || base.model || '').trim() || base.model,
            llmProvider: String(agentJson?.llmProvider || base.llmProvider || '').trim() || base.llmProvider,
            agentSpec: specWithManifest,
        });
    }
    normalizeVersionValue(value) {
        if (value === undefined || value === null || value === '')
            return undefined;
        if (String(value).trim().toLowerCase() === 'active')
            return undefined;
        const version = Number(value);
        return Number.isInteger(version) && version > 0 ? version : undefined;
    }
    async updateActiveAgentReleaseFlowVersion(flow, version, auth, timestamp = new Date().toISOString()) {
        const agentId = this.normalizeAgentName(flow?.agentId);
        const flowId = flow?._id ? String(flow._id) : '';
        if (!flowId || !agentId || agentId === 'default-agent' || !version)
            return;
        const organizationId = flow?.organizationId || auth?.organizationId;
        const agent = await this.agentModel.findOne(this.agentQuery(agentId, organizationId)).lean().exec();
        const activeRelease = this.normalizeVersionValue(agent?.activeRelease);
        if (!activeRelease)
            return;
        const flowName = flow?.name || flow?.config?.title || flowId;
        await this.agentModel.findOneAndUpdate({ ...this.agentQuery(agentId, organizationId), 'releases.release': activeRelease }, {
            $set: {
                [`releases.$.versions.${flowId}`]: version,
                [`releases.$.flowNames.${flowId}`]: flowName,
                'releases.$.updatedAt': timestamp,
                'releases.$.deployedAt': timestamp,
                'releases.$.deployedBy': auth?.userId || '',
                'releases.$.deployedByEmail': auth?.userEmail || '',
            },
        }).exec();
    }
    flowVersions(flow) {
        return Array.isArray(flow?.versions) ? flow.versions : [];
    }
    flowId(flow) {
        return String(flow?._id || flow?.flowId || flow || '').trim();
    }
    flowVersionQuery(flowOrId, organizationId, version) {
        const query = { flowId: this.flowId(flowOrId) };
        if (organizationId)
            query.organizationId = organizationId;
        if (version)
            query.version = version;
        return query;
    }
    flowObjectId(id) {
        const value = String(id || '').trim();
        return mongoose_1.Types.ObjectId.isValid(value) ? new mongoose_1.Types.ObjectId(value) : value;
    }
    versionRecordFromFlow(flow, version) {
        const flowId = this.flowId(flow);
        const versionNumber = Number(version?.version || 0);
        const record = this.cloneJson(version || {});
        delete record._id;
        delete record.createdAt;
        delete record.updatedAt;
        return {
            ...record,
            flowId,
            agentId: flow?.agentId || version?.agentId || '',
            ...(flow?.organizationId || version?.organizationId ? { organizationId: flow?.organizationId || version?.organizationId } : {}),
            version: versionNumber,
            config: this.cloneJson(version?.config || {}),
        };
    }
    async aggregateVersionRecords(query, includeBsonSize = true) {
        if (!query.flowId)
            return [];
        if (includeBsonSize) {
            try {
                return await this.versionModel.aggregate([
                    { $match: query },
                    { $addFields: { bsonSizeBytes: { $bsonSize: '$$ROOT' } } },
                    { $sort: { version: -1 } },
                ]).exec();
            }
            catch {
            }
        }
        return await this.versionModel.find(query).sort({ version: -1 }).lean().exec();
    }
    async flowDocumentBsonSize(id, organizationId) {
        const match = this.withOrganization({ _id: this.flowObjectId(id) }, organizationId);
        try {
            const [result] = await this.model.aggregate([
                { $match: match },
                { $project: { _id: 0, bsonSizeBytes: { $bsonSize: '$$ROOT' } } },
            ]).exec();
            const size = Number(result?.bsonSizeBytes);
            return Number.isFinite(size) ? size : undefined;
        }
        catch {
            return undefined;
        }
    }
    async versionDocumentsBsonSize(flowOrId, organizationId) {
        const query = this.flowVersionQuery(flowOrId, organizationId);
        if (!query.flowId)
            return undefined;
        try {
            const [result] = await this.versionModel.aggregate([
                { $match: query },
                { $group: { _id: null, bsonSizeBytes: { $sum: { $bsonSize: '$$ROOT' } } } },
            ]).exec();
            const size = Number(result?.bsonSizeBytes);
            return Number.isFinite(size) ? size : undefined;
        }
        catch {
            return undefined;
        }
    }
    async migrateEmbeddedVersions(flow, organizationId, options) {
        const embedded = this.flowVersions(flow).filter((version) => Number(version?.version || 0) > 0);
        const flowId = this.flowId(flow);
        if (!flowId || !embedded.length)
            return { embeddedCount: 0, upsertedCount: 0 };
        const operations = embedded.map((version) => {
            const versionNumber = Number(version?.version);
            return {
                updateOne: {
                    filter: this.flowVersionQuery(flowId, organizationId || flow?.organizationId, versionNumber),
                    update: {
                        $setOnInsert: this.versionRecordFromFlow(flow, version),
                    },
                    upsert: true,
                },
            };
        });
        if (options?.dryRun) {
            return { embeddedCount: embedded.length, upsertedCount: 0 };
        }
        let result;
        if (operations.length) {
            result = await this.versionModel.bulkWrite(operations, { ordered: false });
        }
        if (!options?.keepLegacy) {
            await this.model.updateOne(this.withOrganization({ _id: flow._id }, organizationId || flow?.organizationId), { $unset: { versions: '' } }).exec().catch(() => undefined);
        }
        return {
            embeddedCount: embedded.length,
            upsertedCount: Number(result?.upsertedCount || result?.nUpserted || 0),
        };
    }
    async loadFlowForVersionAccess(id, organizationId) {
        const flow = await this.model
            .findOne(this.withOrganization({ _id: id }, organizationId))
            .select('+versions')
            .lean()
            .exec();
        if (!flow) {
            throw new common_1.HttpException('Canvas flow not found', common_1.HttpStatus.NOT_FOUND);
        }
        return flow;
    }
    async findFlowVersions(flow, organizationId, includeBsonSize = true) {
        const flowId = this.flowId(flow);
        if (!flowId)
            return [];
        const legacyFlow = this.flowVersions(flow).length
            ? flow
            : await this.model
                .findOne(this.withOrganization({ _id: flowId }, organizationId || flow?.organizationId))
                .select('+versions')
                .lean()
                .exec()
                .catch(() => null);
        if (this.flowVersions(legacyFlow).length) {
            await this.migrateEmbeddedVersions(legacyFlow, organizationId || flow?.organizationId);
        }
        return await this.aggregateVersionRecords(this.flowVersionQuery(flowId, organizationId || flow?.organizationId), includeBsonSize);
    }
    async findFlowVersion(flow, version, organizationId) {
        if (!version)
            return undefined;
        const query = this.flowVersionQuery(flow, organizationId || flow?.organizationId, version);
        let record = await this.versionModel.findOne(query).lean().exec();
        if (record)
            return record;
        const versions = await this.findFlowVersions(flow, organizationId || flow?.organizationId, false);
        record = versions.find((item) => Number(item?.version) === version);
        return record;
    }
    latestVersionFromRecords(flow, versions) {
        const fromField = Number(flow?.latestVersion);
        const fromVersions = (versions || []).reduce((max, version) => Math.max(max, Number(version?.version) || 0), 0);
        return Math.max(Number.isFinite(fromField) ? fromField : 0, fromVersions);
    }
    async latestExistingFlowVersionNumberAsync(flow, organizationId) {
        const versions = await this.findFlowVersions(flow, organizationId || flow?.organizationId, false);
        return versions.reduce((max, version) => Math.max(max, Number(version?.version) || 0), 0);
    }
    async flowWithVersions(flow, organizationId) {
        const versions = await this.findFlowVersions(flow, organizationId || flow?.organizationId, true);
        const bsonSizeBytes = await this.flowDocumentBsonSize(flow?._id, organizationId || flow?.organizationId);
        return {
            ...flow,
            versions,
            latestVersion: this.latestVersionFromRecords(flow, versions),
            activeVersion: this.normalizeVersionValue(flow?.activeVersion),
            ...(bsonSizeBytes !== undefined ? { bsonSizeBytes } : {}),
        };
    }
    async migrateEmbeddedFlowVersions(options = {}) {
        const summary = {
            dryRun: !!options.dryRun,
            keepLegacy: !!options.keepLegacy || !!options.dryRun,
            scannedFlows: 0,
            migratedFlows: 0,
            skippedFlows: 0,
            failedFlows: 0,
            embeddedVersions: 0,
            insertedVersions: 0,
            legacyFlowBsonSizeBytes: 0,
            postMigrationFlowBsonSizeBytes: 0,
            versionBsonSizeBytes: 0,
            errors: [],
        };
        const limit = Math.max(0, Number(options.limit) || 0);
        const query = this.withOrganization({ 'versions.0': { $exists: true } }, options.organizationId);
        const flowQuery = this.model
            .find(query)
            .select('_id name agentId organizationId latestVersion activeVersion versions')
            .lean();
        if (limit)
            flowQuery.limit(limit);
        const cursor = flowQuery.cursor();
        for await (const flow of cursor) {
            summary.scannedFlows += 1;
            const embeddedCount = this.flowVersions(flow).filter((version) => Number(version?.version || 0) > 0).length;
            if (!embeddedCount) {
                summary.skippedFlows += 1;
                continue;
            }
            const organizationId = options.organizationId || flow?.organizationId;
            const flowId = this.flowId(flow);
            const legacySize = await this.flowDocumentBsonSize(flow?._id, organizationId);
            if (legacySize !== undefined)
                summary.legacyFlowBsonSizeBytes = (summary.legacyFlowBsonSizeBytes || 0) + legacySize;
            try {
                const result = await this.migrateEmbeddedVersions(flow, organizationId, {
                    dryRun: options.dryRun,
                    keepLegacy: summary.keepLegacy,
                });
                summary.migratedFlows += 1;
                summary.embeddedVersions += result.embeddedCount;
                summary.insertedVersions += result.upsertedCount;
                if (!options.dryRun) {
                    const postSize = await this.flowDocumentBsonSize(flow?._id, organizationId);
                    const versionSize = await this.versionDocumentsBsonSize(flow, organizationId);
                    if (postSize !== undefined)
                        summary.postMigrationFlowBsonSizeBytes = (summary.postMigrationFlowBsonSizeBytes || 0) + postSize;
                    if (versionSize !== undefined)
                        summary.versionBsonSizeBytes = (summary.versionBsonSizeBytes || 0) + versionSize;
                }
            }
            catch (error) {
                summary.failedFlows += 1;
                summary.errors.push({
                    flowId,
                    message: error?.message || String(error),
                });
            }
        }
        return summary;
    }
    agentReleases(agent) {
        return Array.isArray(agent?.releases) ? agent.releases : [];
    }
    async agentReleasesForResponse(agent, organizationId, existingFlowIds) {
        const releases = this.agentReleases(agent);
        const snapshots = new Map();
        releases.forEach((release) => {
            const versions = release?.versions && typeof release.versions === 'object' && !Array.isArray(release.versions)
                ? release.versions
                : {};
            Object.entries(versions).forEach(([flowId, rawVersion]) => {
                const version = Number(rawVersion);
                if ((!existingFlowIds || existingFlowIds.has(flowId)) && version > 0) {
                    snapshots.set(`${flowId}:${version}`, { flowId, version });
                }
            });
        });
        const snapshotRecords = snapshots.size
            ? await this.versionModel
                .find(this.withOrganization({ $or: [...snapshots.values()] }, organizationId || agent?.organizationId))
                .select('flowId version name')
                .lean()
                .exec()
            : [];
        const snapshotNames = new Map(snapshotRecords
            .filter((record) => String(record?.name || '').trim())
            .map((record) => [`${String(record.flowId)}:${Number(record.version)}`, String(record.name)]));
        return releases
            .map((release) => {
            const versions = release?.versions && typeof release.versions === 'object' && !Array.isArray(release.versions)
                ? release.versions
                : {};
            const flowNames = release?.flowNames && typeof release.flowNames === 'object' && !Array.isArray(release.flowNames)
                ? release.flowNames
                : {};
            const storedVersionNames = release?.versionNames && typeof release.versionNames === 'object' && !Array.isArray(release.versionNames)
                ? release.versionNames
                : {};
            const nextVersions = {};
            const nextFlowNames = {};
            const nextVersionNames = {};
            Object.entries(versions).forEach(([flowId, rawVersion]) => {
                if (existingFlowIds && !existingFlowIds.has(flowId))
                    return;
                const version = Number(rawVersion);
                nextVersions[flowId] = version;
                if (flowNames[flowId])
                    nextFlowNames[flowId] = String(flowNames[flowId]);
                const versionName = snapshotNames.get(`${flowId}:${version}`) || storedVersionNames[flowId];
                if (versionName)
                    nextVersionNames[flowId] = String(versionName);
            });
            return { ...release, versions: nextVersions, flowNames: nextFlowNames, versionNames: nextVersionNames };
        })
            .sort((a, b) => Number(b?.release || 0) - Number(a?.release || 0));
    }
    latestFlowVersionNumber(flow) {
        const fromField = Number(flow?.latestVersion);
        const fromVersions = this.flowVersions(flow).reduce((max, version) => Math.max(max, Number(version?.version) || 0), 0);
        return Math.max(Number.isFinite(fromField) ? fromField : 0, fromVersions);
    }
    latestExistingFlowVersionNumber(flow) {
        return this.flowVersions(flow).reduce((max, version) => Math.max(max, Number(version?.version) || 0), 0);
    }
    latestAgentReleaseNumber(agent) {
        const fromField = Number(agent?.latestRelease);
        const fromReleases = this.agentReleases(agent).reduce((max, release) => Math.max(max, Number(release?.release) || 0), 0);
        return Math.max(Number.isFinite(fromField) ? fromField : 0, fromReleases);
    }
    resolveFlowVersion(flow, requestedVersion) {
        const versions = this.flowVersions(flow);
        const latestVersion = this.latestFlowVersionNumber(flow);
        const rawRequest = String(requestedVersion ?? '').trim().toLowerCase();
        if (rawRequest === 'draft') {
            return {
                config: this.cloneJson(flow?.config || {}),
                source: 'draft',
                activeVersion: this.normalizeVersionValue(flow?.activeVersion),
                latestVersion,
            };
        }
        const requested = this.normalizeVersionValue(requestedVersion);
        const active = this.normalizeVersionValue(flow?.activeVersion);
        const targetVersion = requested || active;
        if (targetVersion) {
            const snapshot = versions.find((version) => Number(version?.version) === targetVersion);
            if (!snapshot) {
                throw new common_1.HttpException(`Versao ${targetVersion} do fluxo nao encontrada.`, common_1.HttpStatus.NOT_FOUND);
            }
            return {
                config: this.cloneJson(snapshot.config || {}),
                version: targetVersion,
                source: 'version',
                activeVersion: active,
                latestVersion,
            };
        }
        return {
            config: this.cloneJson(flow?.config || {}),
            source: 'draft',
            activeVersion: active,
            latestVersion,
        };
    }
    async resolveFlowVersionAsync(flow, requestedVersion) {
        const rawRequest = String(requestedVersion ?? '').trim().toLowerCase();
        const active = this.normalizeVersionValue(flow?.activeVersion);
        if (rawRequest === 'draft') {
            return {
                config: this.cloneJson(flow?.config || {}),
                source: 'draft',
                activeVersion: active,
                latestVersion: Number(flow?.latestVersion) || 0,
            };
        }
        const requested = this.normalizeVersionValue(requestedVersion);
        const targetVersion = requested || active;
        if (targetVersion) {
            const snapshot = await this.findFlowVersion(flow, targetVersion, flow?.organizationId);
            if (!snapshot) {
                throw new common_1.HttpException(`Versao ${targetVersion} do fluxo nao encontrada.`, common_1.HttpStatus.NOT_FOUND);
            }
            return {
                config: this.cloneJson(snapshot.config || {}),
                version: targetVersion,
                source: 'version',
                activeVersion: active,
                latestVersion: Math.max(Number(flow?.latestVersion) || 0, Number(snapshot.version) || 0),
            };
        }
        return {
            config: this.cloneJson(flow?.config || {}),
            source: 'draft',
            activeVersion: active,
            latestVersion: Number(flow?.latestVersion) || 0,
        };
    }
    async resolveAgentRelease(agentId, organizationId, requestedRelease) {
        const name = this.normalizeAgentName(agentId);
        const agent = await this.agentModel.findOne(this.agentQuery(name, organizationId)).lean().exec();
        if (!agent)
            return { versions: {}, source: 'none' };
        const releases = this.agentReleases(agent);
        const requested = this.normalizeVersionValue(requestedRelease);
        const active = this.normalizeVersionValue(agent.activeRelease);
        const target = requested || active;
        if (!target) {
            return { versions: {}, source: 'none', latestRelease: this.latestAgentReleaseNumber(agent) };
        }
        const release = releases.find((item) => Number(item?.release) === target);
        if (!release) {
            if (!requested && active) {
                return { versions: {}, source: 'none', latestRelease: this.latestAgentReleaseNumber(agent) };
            }
            throw new common_1.HttpException(`Release ${target} do agente nao encontrado.`, common_1.HttpStatus.NOT_FOUND);
        }
        return {
            release: target,
            versions: release.versions && typeof release.versions === 'object' && !Array.isArray(release.versions) ? release.versions : {},
            source: requested ? 'requested' : 'active',
            latestRelease: this.latestAgentReleaseNumber(agent),
        };
    }
    async nextAgentSortOrder(organizationId) {
        const last = await this.agentModel
            .findOne(this.withOrganization({}, organizationId))
            .sort({ sortOrder: -1, updatedAt: -1 })
            .select('sortOrder')
            .lean()
            .exec();
        const current = Number(last?.sortOrder);
        return Number.isFinite(current) ? current + 1000 : 1000;
    }
    async nextSortOrder(agentId, organizationId) {
        const last = await this.model
            .findOne(this.scopedQuery(agentId, organizationId))
            .sort({ sortOrder: -1, updatedAt: -1 })
            .select('sortOrder')
            .lean()
            .exec();
        const current = Number(last?.sortOrder);
        return Number.isFinite(current) ? current + 1000 : 1000;
    }
    async create(createDto, auth) {
        const agentId = this.normalizeAgentName(createDto.agentId);
        if (agentId !== 'default-agent') {
            await this.ensureAgent(agentId, auth);
        }
        const initialVersions = Array.isArray(createDto.versions) ? createDto.versions : [];
        const { versions: _ignoredVersions, ...flowDto } = createDto;
        const initialLatestVersion = initialVersions.reduce((max, version) => Math.max(max, Number(version?.version) || 0), 0);
        const saved = await new this.model({
            ...flowDto,
            agentId,
            sortOrder: Number.isFinite(Number(createDto.sortOrder))
                ? Number(createDto.sortOrder)
                : await this.nextSortOrder(agentId, auth?.organizationId),
            config: createDto.config || {},
            latestVersion: Math.max(Number.isFinite(Number(createDto.latestVersion)) ? Number(createDto.latestVersion) : 0, initialLatestVersion),
            activeVersion: Number.isFinite(Number(createDto.activeVersion)) ? Number(createDto.activeVersion) : undefined,
            ...(auth?.organizationId ? { organizationId: auth.organizationId } : {}),
            ...(auth?.userId ? { createdBy: auth.userId } : {}),
        }).save();
        if (initialVersions.length) {
            const operations = initialVersions
                .filter((version) => Number(version?.version || 0) > 0)
                .map((version) => ({
                updateOne: {
                    filter: this.flowVersionQuery(saved, auth?.organizationId, Number(version.version)),
                    update: { $setOnInsert: this.versionRecordFromFlow(saved, version) },
                    upsert: true,
                },
            }));
            if (operations.length) {
                await this.versionModel.bulkWrite(operations, { ordered: false });
            }
        }
        await this.unsetOtherMainFlows(saved);
        return saved;
    }
    async findAll(agentId, organizationId, options) {
        const query = this.model.find(this.scopedQuery(agentId, organizationId)).sort({ updatedAt: -1 });
        if (!options?.includeConfig) {
            query.select('_id name agentId organizationId description sortOrder activeVersion latestVersion createdAt updatedAt config.title config.responseName config.channel config.isMainFlow config.execute');
        }
        const flows = await query.lean().exec();
        return this.sortFlows(flows);
    }
    async listAgents(organizationId) {
        const flowAgents = await this.model.aggregate([
            { $match: this.withOrganization({ agentId: { $exists: true, $ne: '' } }, organizationId) },
            { $group: {
                    _id: '$agentId',
                    flowCount: { $sum: 1 },
                    updatedAt: { $max: '$updatedAt' },
                } },
        ]).exec();
        const explicitAgents = await this.agentModel.find(this.withOrganization({}, organizationId)).lean().exec();
        const byId = new Map();
        explicitAgents.forEach((agent) => {
            const id = this.normalizeAgentName(agent.agentId || agent.name);
            const name = this.normalizeAgentDisplayName(agent.name, id);
            byId.set(id, {
                _id: String(agent._id),
                agentId: id,
                name,
                flowCount: 0,
                config: this.normalizeAgentRuntimeConfig(agent.config || {}),
                sortOrder: agent.sortOrder,
                activeRelease: agent.activeRelease,
                latestRelease: agent.latestRelease,
                createdAt: agent.createdAt,
                updatedAt: agent.updatedAt,
            });
        });
        flowAgents.forEach((item) => {
            const id = this.normalizeAgentName(item._id);
            const current = byId.get(id);
            byId.set(id, {
                ...(current || { agentId: id, name: id }),
                flowCount: item.flowCount || 0,
                activeRelease: current?.activeRelease,
                latestRelease: current?.latestRelease,
                updatedAt: item.updatedAt || current?.updatedAt,
            });
        });
        return this.sortAgents(Array.from(byId.values()));
    }
    async createAgent(name, auth) {
        const displayName = this.normalizeAgentDisplayName(name);
        const duplicate = await this.agentModel.findOne(this.agentDisplayNameQuery(displayName, auth?.organizationId)).lean().exec();
        if (duplicate) {
            throw new common_1.HttpException('Ja existe um agente com este nome.', common_1.HttpStatus.CONFLICT);
        }
        const agentId = await this.nextAvailableAgentId(this.createAgentIdSlug(displayName), auth?.organizationId);
        await this.ensureAgent(agentId, auth, displayName);
        return (await this.listAgents(auth?.organizationId)).find((agent) => agent.agentId === agentId);
    }
    async getAgentConfig(agentId, organizationId) {
        const target = this.normalizeAgentName(agentId);
        const agent = await this.agentModel.findOne(this.agentQuery(target, organizationId)).lean().exec();
        return this.normalizeAgentRuntimeConfig(agent?.config || {});
    }
    async updateAgentConfig(agentId, config, auth) {
        const target = this.normalizeAgentName(agentId);
        if (!target || target === 'default-agent') {
            throw new common_1.HttpException('Selecione um agente real antes de configurar o Agent OS.', common_1.HttpStatus.BAD_REQUEST);
        }
        const existing = await this.agentModel.findOne(this.agentQuery(target, auth?.organizationId)).lean().exec();
        const normalized = this.normalizeAgentRuntimeConfig(config);
        await this.agentModel.updateOne(this.agentQuery(target, auth?.organizationId), {
            $set: {
                agentId: target,
                name: this.normalizeAgentDisplayName(existing?.name, target),
                config: normalized,
                ...(auth?.organizationId ? { organizationId: auth.organizationId } : {}),
            },
            $setOnInsert: {
                sortOrder: await this.nextAgentSortOrder(auth?.organizationId),
                ...(auth?.userId ? { createdBy: auth.userId } : {}),
            },
        }, { upsert: true }).exec();
        return (await this.listAgents(auth?.organizationId)).find((agent) => agent.agentId === target);
    }
    async exportAgentWorkspace(agentId, organizationId) {
        const target = this.normalizeAgentName(agentId);
        if (!target || target === 'default-agent') {
            throw new common_1.HttpException('Selecione um agente real para exportar o workspace.', common_1.HttpStatus.BAD_REQUEST);
        }
        const agent = await this.agentModel.findOne(this.agentQuery(target, organizationId)).lean().exec();
        if (!agent) {
            throw new common_1.HttpException('Agente nao encontrado para exportar workspace.', common_1.HttpStatus.NOT_FOUND);
        }
        const config = this.normalizeAgentRuntimeConfig(agent.config || {});
        const spec = config.agentSpec || {};
        const agentName = this.normalizeAgentDisplayName(agent.name, target);
        const exportedAt = new Date().toISOString();
        const rules = this.normalizeObjectList(spec.rules);
        const skills = this.normalizeObjectList(spec.skills);
        const subagents = this.normalizeObjectList(spec.subagents);
        const mcpServers = this.normalizeObjectList(spec.mcpServers);
        const files = [
            this.workspaceFile('.canvas-flow/agent.json', {
                kind: 'canvas-flow-agent',
                version: 1,
                agentId: target,
                name: agentName,
                model: config.model || '',
                llmProvider: config.llmProvider || 'openai',
                exportedAt,
            }, 'application/json'),
            this.workspaceFile('.canvas-flow/README.md', [
                '# Canvas Flow Agent Workspace',
                '',
                'Este pacote representa a pasta .canvas-flow do agente.',
                'Edite os arquivos abaixo, versione no Git e importe de volta no Agent Studio.',
                '',
                '- manifest.json: indice leve com paths, descricoes e load mode.',
                '- agents.md: arquitetura, decisoes e papel do orquestrador.',
                '- guardrails.md: politicas e limites sempre presentes.',
                '- blocked-terms.json: tripwires que bloqueiam entradas sensiveis.',
                '- rules/: regras sempre presentes ou sob demanda.',
                '- skills/: tarefas no contexto principal.',
                '- subagents/: especialistas com contexto isolado.',
                '- mcp.json: ferramentas externas sob demanda.',
                '',
            ].join('\n')),
            this.workspaceFile('.canvas-flow/manifest.json', this.buildWorkspaceManifest(config), 'application/json'),
            this.workspaceFile('.canvas-flow/agents.md', spec.agentsMd || ''),
            this.workspaceFile('.canvas-flow/guardrails.md', spec.guardrails || ''),
            this.workspaceFile('.canvas-flow/blocked-terms.json', spec.blockedTerms || [], 'application/json'),
            this.workspaceFile('.canvas-flow/rules.json', rules, 'application/json'),
            this.workspaceFile('.canvas-flow/skills.json', skills, 'application/json'),
            this.workspaceFile('.canvas-flow/subagents.json', subagents, 'application/json'),
            this.workspaceFile('.canvas-flow/mcp.json', mcpServers, 'application/json'),
            ...rules.map((rule, index) => this.workspaceFile(`.canvas-flow/rules/${this.safeWorkspaceFileName(rule.id || rule.name, `rule-${index + 1}`)}.rule.json`, rule, 'application/json')),
            ...skills.map((skill, index) => this.workspaceFile(`.canvas-flow/skills/${this.safeWorkspaceFileName(skill.id || skill.name, `skill-${index + 1}`)}.skill.json`, skill, 'application/json')),
            ...subagents.map((subagent, index) => this.workspaceFile(`.canvas-flow/subagents/${this.safeWorkspaceFileName(subagent.id || subagent.name, `subagent-${index + 1}`)}.agent.json`, subagent, 'application/json')),
        ];
        return {
            kind: 'canvas-flow-agent-workspace',
            version: 1,
            folderName: '.canvas-flow',
            agentId: target,
            agentName,
            exportedAt,
            config,
            files,
        };
    }
    async importAgentWorkspace(agentId, payload, auth) {
        const target = this.normalizeAgentName(agentId);
        if (!target || target === 'default-agent') {
            throw new common_1.HttpException('Selecione um agente real antes de importar workspace.', common_1.HttpStatus.BAD_REQUEST);
        }
        const config = this.workspaceConfigFromPayload(payload || {});
        return await this.updateAgentConfig(target, config, auth);
    }
    async renameAgent(currentAgentId, nextName, auth) {
        const agentId = this.normalizeAgentName(currentAgentId);
        const displayName = this.normalizeAgentDisplayName(nextName, agentId);
        const current = (await this.listAgents(auth?.organizationId)).find((agent) => agent.agentId === agentId);
        if (current?.name === displayName) {
            return current;
        }
        const duplicate = (await this.listAgents(auth?.organizationId))
            .find((agent) => agent.agentId !== agentId && this.normalizeAgentDisplayName(agent.name) === displayName);
        if (duplicate) {
            throw new common_1.HttpException('Ja existe um agente com este nome.', common_1.HttpStatus.CONFLICT);
        }
        await this.agentModel.updateOne(this.agentQuery(agentId, auth?.organizationId), {
            $set: { agentId, name: displayName },
            $setOnInsert: {
                sortOrder: await this.nextAgentSortOrder(auth?.organizationId),
                ...(auth?.organizationId ? { organizationId: auth.organizationId } : {}),
            },
        }, { upsert: true }).exec();
        return (await this.listAgents(auth?.organizationId)).find((agent) => agent.agentId === agentId);
    }
    async removeAgent(agentId, confirmationName, auth) {
        const target = this.normalizeAgentName(agentId);
        const current = (await this.listAgents(auth?.organizationId)).find((agent) => agent.agentId === target);
        const displayName = current?.name || target;
        const confirmation = String(confirmationName || '').trim();
        if (confirmation !== displayName && confirmation !== target) {
            throw new common_1.HttpException('Digite o nome exato do agente para confirmar a exclusao.', common_1.HttpStatus.BAD_REQUEST);
        }
        const flowDelete = await this.model.deleteMany(this.scopedQuery(target, auth?.organizationId)).exec();
        const agentDelete = await this.agentModel.deleteMany(this.agentQuery(target, auth?.organizationId)).exec();
        return {
            agentId: target,
            name: displayName,
            deletedFlows: flowDelete.deletedCount || 0,
            deletedAgents: agentDelete.deletedCount || 0,
            agents: await this.listAgents(auth?.organizationId),
        };
    }
    async reorderAgents(orderedAgentIds, auth) {
        const ids = Array.from(new Set(orderedAgentIds.map((id) => this.normalizeAgentName(id)).filter(Boolean)));
        if (!ids.length)
            return await this.listAgents(auth?.organizationId);
        const existingAgents = await this.listAgents(auth?.organizationId);
        const byId = new Map(existingAgents.map((agent) => [this.normalizeAgentName(agent.agentId || agent.name), agent]));
        const orderedKnownIds = ids.filter((id) => byId.has(id));
        const trailingIds = existingAgents
            .map((agent) => this.normalizeAgentName(agent.agentId || agent.name))
            .filter((id) => !orderedKnownIds.includes(id));
        const finalIds = [...orderedKnownIds, ...trailingIds];
        const operations = finalIds
            .filter((id) => id !== 'default-agent')
            .map((id, index) => ({
            updateOne: {
                filter: this.agentQuery(id, auth?.organizationId),
                update: {
                    $set: {
                        agentId: id,
                        name: this.normalizeAgentDisplayName(byId.get(id)?.name, id),
                        sortOrder: (index + 1) * 1000,
                        ...(auth?.organizationId ? { organizationId: auth.organizationId } : {}),
                    },
                    $setOnInsert: {
                        ...(auth?.userId ? { createdBy: auth.userId } : {}),
                    },
                },
                upsert: true,
            },
        }));
        if (operations.length) {
            await this.agentModel.bulkWrite(operations);
        }
        return await this.listAgents(auth?.organizationId);
    }
    async reorder(orderedIds, agentId, organizationId) {
        const ids = orderedIds.filter(Boolean);
        if (!ids.length)
            return await this.findAll(agentId, organizationId);
        const query = this.withOrganization({ _id: { $in: ids } }, organizationId);
        if (agentId)
            query.agentId = agentId;
        const flows = await this.model.find(query).select('_id').lean().exec();
        const allowedIds = new Set(flows.map((flow) => String(flow._id)));
        const operations = ids
            .filter((id) => allowedIds.has(String(id)))
            .map((id, index) => ({
            updateOne: {
                filter: this.withOrganization({ _id: id }, organizationId),
                update: { $set: { sortOrder: (index + 1) * 1000 } },
            },
        }));
        if (operations.length) {
            await this.model.bulkWrite(operations);
        }
        return await this.findAll(agentId, organizationId);
    }
    async findMain(agentId, channel) {
        const baseQuery = {};
        if (agentId)
            baseQuery.agentId = agentId;
        const flows = await this.model.find(baseQuery).sort({ updatedAt: -1 }).lean().exec();
        const agentRelease = await this.resolveAgentRelease(agentId).catch(() => ({ versions: {}, source: 'none' }));
        const resolved = await Promise.all(flows.map(async (flow) => {
            try {
                return { flow, resolved: await this.resolveFlowVersionAsync(flow, agentRelease.versions?.[String(flow?._id || '')]) };
            }
            catch {
                return { flow, resolved: { config: flow?.config || {}, source: 'draft', latestVersion: 0 } };
            }
        }));
        const matchesChannel = (item) => !channel || item.resolved?.config?.channel === channel;
        const main = resolved.find((item) => matchesChannel(item) && item.resolved?.config?.isMainFlow === true);
        if (main)
            return main.flow;
        const fallback = resolved.find((item) => matchesChannel(item))?.flow;
        if (!fallback) {
            throw new common_1.HttpException('Canvas main flow not found', common_1.HttpStatus.NOT_FOUND);
        }
        return fallback;
    }
    async findOne(id, organizationId, options) {
        const query = this.withOrganization({ _id: id }, organizationId);
        const request = this.model.findOne(query);
        if (options?.includeVersions)
            request.select('+versions');
        const flow = await request.lean().exec();
        if (!flow) {
            throw new common_1.HttpException('Canvas flow not found', common_1.HttpStatus.NOT_FOUND);
        }
        if (options?.includeVersions) {
            return await this.flowWithVersions(flow, organizationId);
        }
        if (options?.includeBsonSize) {
            const bsonSizeBytes = await this.flowDocumentBsonSize(id, organizationId);
            return {
                ...flow,
                ...(bsonSizeBytes !== undefined ? { bsonSizeBytes } : {}),
            };
        }
        return flow;
    }
    async getVersions(id, auth) {
        const flow = await this.loadFlowForVersionAccess(id, auth?.organizationId);
        return await this.flowWithVersions(flow, auth?.organizationId);
    }
    async deployVersion(id, body = {}, auth) {
        const query = this.withOrganization({ _id: id }, auth?.organizationId);
        const flow = await this.loadFlowForVersionAccess(id, auth?.organizationId);
        const updates = {};
        if (body?.name !== undefined)
            updates.name = String(body.name || flow.name || 'Fluxo');
        if (body?.agentId !== undefined) {
            updates.agentId = this.normalizeAgentName(body.agentId);
            if (updates.agentId !== 'default-agent') {
                await this.ensureAgent(updates.agentId, auth);
            }
        }
        if (body?.description !== undefined)
            updates.description = body.description;
        if (body?.config && typeof body.config === 'object')
            updates.config = body.config;
        const draftConfig = updates.config || flow.config || {};
        const existingVersions = await this.findFlowVersions(flow, auth?.organizationId, false);
        const nextVersion = this.latestVersionFromRecords(flow, existingVersions) + 1;
        const now = new Date().toISOString();
        const versionRecord = {
            flowId: this.flowId(flow),
            agentId: updates.agentId || flow.agentId || '',
            ...(flow.organizationId || auth?.organizationId ? { organizationId: flow.organizationId || auth?.organizationId } : {}),
            version: nextVersion,
            name: String(body?.versionName || body?.name || flow.name || `v${nextVersion}`),
            notes: String(body?.notes || '').trim(),
            config: this.cloneJson(draftConfig),
            deployedAt: now,
            createdAt: now,
            deployedBy: auth?.userId || '',
            deployedByEmail: auth?.userEmail || '',
            ...(body?.activate === false ? {} : {
                activatedAt: now,
                activatedBy: auth?.userId || '',
                activatedByEmail: auth?.userEmail || '',
            }),
        };
        await this.versionModel.updateOne(this.flowVersionQuery(flow, auth?.organizationId, nextVersion), { $setOnInsert: versionRecord }, { upsert: true }).exec();
        const update = {
            $set: {
                ...updates,
                latestVersion: nextVersion,
                activeVersion: body?.activate === false ? this.normalizeVersionValue(flow.activeVersion) : nextVersion,
            },
            $unset: { versions: '' },
        };
        const deployed = await this.model.findOneAndUpdate(query, update, { new: true }).lean().exec();
        await this.unsetOtherMainFlows(deployed);
        if (body?.activate !== false) {
            await this.updateActiveAgentReleaseFlowVersion(deployed, nextVersion, auth, now);
        }
        return await this.flowWithVersions(deployed, auth?.organizationId);
    }
    async activateVersion(id, version, auth) {
        const targetVersion = this.normalizeVersionValue(version);
        if (!targetVersion) {
            throw new common_1.HttpException('Versao invalida para ativacao.', common_1.HttpStatus.BAD_REQUEST);
        }
        const flow = await this.loadFlowForVersionAccess(id, auth?.organizationId);
        const versionRecord = await this.findFlowVersion(flow, targetVersion, auth?.organizationId);
        if (!versionRecord) {
            throw new common_1.HttpException('Versao do fluxo nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        const activatedAt = new Date().toISOString();
        await this.versionModel.updateOne(this.flowVersionQuery(flow, auth?.organizationId, targetVersion), {
            $set: {
                activatedAt,
                activatedBy: auth?.userId || '',
                activatedByEmail: auth?.userEmail || '',
            },
        }).exec();
        const query = this.withOrganization({ _id: id }, auth?.organizationId);
        const updated = await this.model
            .findOneAndUpdate(query, {
            $set: {
                activeVersion: targetVersion,
            },
            $unset: { versions: '' },
        }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.HttpException('Versao do fluxo nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        await this.updateActiveAgentReleaseFlowVersion(updated, targetVersion, auth);
        return await this.flowWithVersions(updated, auth?.organizationId);
    }
    async renameVersion(id, version, body = {}, auth) {
        const targetVersion = this.normalizeVersionValue(version);
        const name = String(body?.name || '').trim();
        if (!targetVersion) {
            throw new common_1.HttpException('Versao invalida para renomear.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!name) {
            throw new common_1.HttpException('Informe um nome para a versao.', common_1.HttpStatus.BAD_REQUEST);
        }
        const flow = await this.loadFlowForVersionAccess(id, auth?.organizationId);
        const updatedVersion = await this.versionModel.findOneAndUpdate(this.flowVersionQuery(flow, auth?.organizationId, targetVersion), { $set: { name } }, { new: true }).lean().exec();
        if (!updatedVersion) {
            throw new common_1.HttpException('Versao do fluxo nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        return await this.flowWithVersions(flow, auth?.organizationId);
    }
    async deleteVersion(id, version, auth) {
        const targetVersion = this.normalizeVersionValue(version);
        if (!targetVersion) {
            throw new common_1.HttpException('Versao invalida para exclusao.', common_1.HttpStatus.BAD_REQUEST);
        }
        const flow = await this.loadFlowForVersionAccess(id, auth?.organizationId);
        const versionRecord = await this.findFlowVersion(flow, targetVersion, auth?.organizationId);
        if (!versionRecord) {
            throw new common_1.HttpException('Versao do fluxo nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        if (this.normalizeVersionValue(flow.activeVersion) === targetVersion) {
            throw new common_1.HttpException('Nao e possivel excluir a versao ativa. Ative outra versao antes.', common_1.HttpStatus.BAD_REQUEST);
        }
        await this.versionModel.deleteOne(this.flowVersionQuery(flow, auth?.organizationId, targetVersion)).exec();
        const remainingVersions = await this.findFlowVersions(flow, auth?.organizationId, false);
        const latestVersion = remainingVersions.reduce((max, item) => Math.max(max, Number(item?.version) || 0), 0);
        const query = this.withOrganization({ _id: id }, auth?.organizationId);
        const updated = await this.model
            .findOneAndUpdate(query, {
            $set: { latestVersion },
            $unset: { versions: '' },
        }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.HttpException('Versao do fluxo nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        return await this.flowWithVersions(updated, auth?.organizationId);
    }
    async overwriteVersion(id, version, body = {}, auth) {
        const targetVersion = this.normalizeVersionValue(version);
        if (!targetVersion) {
            throw new common_1.HttpException('Versao invalida para sobrescrita.', common_1.HttpStatus.BAD_REQUEST);
        }
        const flow = await this.loadFlowForVersionAccess(id, auth?.organizationId);
        const targetSnapshot = await this.findFlowVersion(flow, targetVersion, auth?.organizationId);
        if (!targetSnapshot) {
            throw new common_1.HttpException('Versao do fluxo nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        const sourceVersion = this.normalizeVersionValue(body?.sourceVersion);
        const sourceSnapshot = sourceVersion
            ? await this.findFlowVersion(flow, sourceVersion, auth?.organizationId)
            : null;
        if (sourceVersion && !sourceSnapshot) {
            throw new common_1.HttpException(`Versao ${sourceVersion} do fluxo nao encontrada para origem.`, common_1.HttpStatus.NOT_FOUND);
        }
        const draftConfig = sourceSnapshot?.config && typeof sourceSnapshot.config === 'object'
            ? sourceSnapshot.config
            : body?.config && typeof body.config === 'object'
                ? body.config
                : flow.config || {};
        const now = new Date().toISOString();
        const set = {
            config: this.cloneJson(draftConfig),
            deployedAt: now,
            updatedAt: now,
            deployedBy: auth?.userId || '',
            deployedByEmail: auth?.userEmail || '',
        };
        if (body?.notes !== undefined)
            set.notes = String(body.notes || '').trim();
        if (body?.name !== undefined)
            set.name = String(body.name || flow.name || `v${targetVersion}`);
        const updatedVersion = await this.versionModel.findOneAndUpdate(this.flowVersionQuery(flow, auth?.organizationId, targetVersion), { $set: set }, { new: true }).lean().exec();
        if (!updatedVersion) {
            throw new common_1.HttpException('Versao do fluxo nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        const updated = await this.model.findOneAndUpdate(this.withOrganization({ _id: id }, auth?.organizationId), { $unset: { versions: '' } }, { new: true }).lean().exec();
        await this.updateActiveAgentReleaseFlowVersion(updated, targetVersion, auth, now);
        return await this.flowWithVersions(updated, auth?.organizationId);
    }
    async getAgentReleases(agentId, auth) {
        const name = this.normalizeAgentName(agentId);
        const agent = await this.agentModel.findOne(this.agentQuery(name, auth?.organizationId)).lean().exec();
        if (!agent) {
            return { agentId: name, activeRelease: undefined, latestRelease: 0, releases: [] };
        }
        const flows = await this.model.find(this.scopedQuery(name, auth?.organizationId)).select('_id').lean().exec();
        const existingFlowIds = new Set(flows.map((flow) => String(flow._id)));
        const releases = await this.agentReleasesForResponse(agent, auth?.organizationId, existingFlowIds);
        return {
            agentId: name,
            activeRelease: this.normalizeVersionValue(agent?.activeRelease),
            latestRelease: this.latestAgentReleaseNumber(agent),
            releases,
        };
    }
    async deployAgentRelease(agentId, body = {}, auth) {
        const name = this.normalizeAgentName(agentId);
        await this.ensureAgent(name, auth);
        const agent = await this.agentModel.findOne(this.agentQuery(name, auth?.organizationId)).lean().exec();
        const flows = await this.model.find(this.scopedQuery(name, auth?.organizationId)).select('+versions').lean().exec();
        if (!flows.length) {
            throw new common_1.HttpException('Nenhum fluxo encontrado para este agente.', common_1.HttpStatus.BAD_REQUEST);
        }
        const versionMap = {};
        const flowNames = {};
        const flowOperations = [];
        const versionOperations = [];
        const now = new Date().toISOString();
        for (const flow of flows) {
            const flowId = String(flow._id);
            let latestVersion = await this.latestExistingFlowVersionNumberAsync(flow, auth?.organizationId);
            flowNames[flowId] = flow.name || flow.config?.title || flowId;
            if (!latestVersion) {
                latestVersion = 1;
                versionOperations.push({
                    updateOne: {
                        filter: this.flowVersionQuery(flow, auth?.organizationId, latestVersion),
                        update: {
                            $setOnInsert: {
                                flowId,
                                agentId: flow.agentId || name,
                                ...(flow.organizationId || auth?.organizationId ? { organizationId: flow.organizationId || auth?.organizationId } : {}),
                                version: latestVersion,
                                name: String(flow.name || `v${latestVersion}`),
                                notes: 'Versao inicial criada para pacote do agente.',
                                config: this.cloneJson(flow.config || {}),
                                deployedAt: now,
                                createdAt: now,
                                deployedBy: auth?.userId || '',
                                deployedByEmail: auth?.userEmail || '',
                                agentReleaseCandidate: true,
                            },
                        },
                        upsert: true,
                    },
                });
                flowOperations.push({
                    updateOne: {
                        filter: this.withOrganization({ _id: flow._id }, auth?.organizationId),
                        update: {
                            $set: { latestVersion },
                            $unset: { versions: '' },
                        },
                    },
                });
            }
            versionMap[flowId] = latestVersion;
        }
        if (versionOperations.length) {
            await this.versionModel.bulkWrite(versionOperations, { ordered: false });
        }
        if (flowOperations.length) {
            await this.model.bulkWrite(flowOperations);
        }
        const nextRelease = this.latestAgentReleaseNumber(agent) + 1;
        const releaseRecord = {
            release: nextRelease,
            name: String(body?.name || `Release ${nextRelease}`),
            notes: String(body?.notes || '').trim(),
            versions: versionMap,
            flowNames,
            createdAt: now,
            deployedAt: now,
            deployedBy: auth?.userId || '',
            deployedByEmail: auth?.userEmail || '',
            ...(body?.activate === false ? {} : {
                activatedAt: now,
                activatedBy: auth?.userId || '',
                activatedByEmail: auth?.userEmail || '',
            }),
        };
        const set = {
            agentId: name,
            latestRelease: nextRelease,
            ...(auth?.organizationId ? { organizationId: auth.organizationId } : {}),
        };
        if (body?.activate !== false)
            set.activeRelease = nextRelease;
        const updated = await this.agentModel.findOneAndUpdate(this.agentQuery(name, auth?.organizationId), {
            $set: set,
            $setOnInsert: {
                name,
                sortOrder: await this.nextAgentSortOrder(auth?.organizationId),
                ...(auth?.userId ? { createdBy: auth.userId } : {}),
            },
            $push: { releases: releaseRecord },
        }, { new: true, upsert: true }).lean().exec();
        const releases = await this.agentReleasesForResponse(updated, auth?.organizationId);
        return {
            agentId: name,
            activeRelease: this.normalizeVersionValue(updated?.activeRelease),
            latestRelease: this.latestAgentReleaseNumber(updated),
            release: releases.find((release) => Number(release?.release) === nextRelease) || releaseRecord,
            releases,
        };
    }
    async activateAgentRelease(agentId, release, auth) {
        const name = this.normalizeAgentName(agentId);
        const targetRelease = this.normalizeVersionValue(release);
        if (!targetRelease) {
            throw new common_1.HttpException('Release invalido para ativacao.', common_1.HttpStatus.BAD_REQUEST);
        }
        const updated = await this.agentModel.findOneAndUpdate({ ...this.agentQuery(name, auth?.organizationId), 'releases.release': targetRelease }, {
            $set: {
                activeRelease: targetRelease,
                'releases.$.activatedAt': new Date().toISOString(),
                'releases.$.activatedBy': auth?.userId || '',
                'releases.$.activatedByEmail': auth?.userEmail || '',
            },
        }, { new: true }).lean().exec();
        if (!updated) {
            throw new common_1.HttpException('Release do agente nao encontrado.', common_1.HttpStatus.NOT_FOUND);
        }
        return {
            agentId: name,
            activeRelease: this.normalizeVersionValue(updated.activeRelease),
            latestRelease: this.latestAgentReleaseNumber(updated),
            releases: await this.agentReleasesForResponse(updated, auth?.organizationId),
        };
    }
    async renameAgentRelease(agentId, release, body = {}, auth) {
        const name = this.normalizeAgentName(agentId);
        const targetRelease = this.normalizeVersionValue(release);
        const nextName = String(body?.name || '').trim();
        if (!targetRelease) {
            throw new common_1.HttpException('Versao do agente invalida para renomear.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!nextName) {
            throw new common_1.HttpException('Informe um nome para a versao do agente.', common_1.HttpStatus.BAD_REQUEST);
        }
        const updated = await this.agentModel.findOneAndUpdate({ ...this.agentQuery(name, auth?.organizationId), 'releases.release': targetRelease }, { $set: { 'releases.$.name': nextName } }, { new: true }).lean().exec();
        if (!updated) {
            throw new common_1.HttpException('Versao do agente nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        return {
            agentId: name,
            activeRelease: this.normalizeVersionValue(updated.activeRelease),
            latestRelease: this.latestAgentReleaseNumber(updated),
            releases: await this.agentReleasesForResponse(updated, auth?.organizationId),
        };
    }
    async overwriteAgentRelease(agentId, release, body = {}, auth) {
        const name = this.normalizeAgentName(agentId);
        const targetRelease = this.normalizeVersionValue(release);
        if (!targetRelease) {
            throw new common_1.HttpException('Versao do agente invalida para sobrescrita.', common_1.HttpStatus.BAD_REQUEST);
        }
        const query = { ...this.agentQuery(name, auth?.organizationId), 'releases.release': targetRelease };
        const agent = await this.agentModel.findOne(query).lean().exec();
        if (!agent) {
            throw new common_1.HttpException('Versao do agente nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        const now = new Date().toISOString();
        let versionMap = {};
        let flowNames = {};
        const sourceRelease = this.normalizeVersionValue(body?.sourceRelease);
        if (sourceRelease) {
            const source = this.agentReleases(agent).find((item) => Number(item?.release) === sourceRelease);
            if (!source) {
                throw new common_1.HttpException(`Versao do agente r${sourceRelease} nao encontrada para origem.`, common_1.HttpStatus.NOT_FOUND);
            }
            versionMap = source.versions && typeof source.versions === 'object' && !Array.isArray(source.versions)
                ? this.cloneJson(source.versions)
                : {};
            flowNames = source.flowNames && typeof source.flowNames === 'object' && !Array.isArray(source.flowNames)
                ? this.cloneJson(source.flowNames)
                : {};
        }
        else {
            const flows = await this.model.find(this.scopedQuery(name, auth?.organizationId)).select('+versions').lean().exec();
            if (!flows.length) {
                throw new common_1.HttpException('Nenhum fluxo encontrado para este agente.', common_1.HttpStatus.BAD_REQUEST);
            }
            const flowOperations = [];
            const versionOperations = [];
            for (const flow of flows) {
                const flowId = String(flow._id);
                let latestVersion = await this.latestExistingFlowVersionNumberAsync(flow, auth?.organizationId);
                flowNames[flowId] = flow.name || flow.config?.title || flowId;
                if (!latestVersion) {
                    latestVersion = 1;
                    versionOperations.push({
                        updateOne: {
                            filter: this.flowVersionQuery(flow, auth?.organizationId, latestVersion),
                            update: {
                                $setOnInsert: {
                                    flowId,
                                    agentId: flow.agentId || name,
                                    ...(flow.organizationId || auth?.organizationId ? { organizationId: flow.organizationId || auth?.organizationId } : {}),
                                    version: latestVersion,
                                    name: String(flow.name || `v${latestVersion}`),
                                    notes: 'Versao inicial criada para pacote do agente.',
                                    config: this.cloneJson(flow.config || {}),
                                    deployedAt: now,
                                    createdAt: now,
                                    deployedBy: auth?.userId || '',
                                    deployedByEmail: auth?.userEmail || '',
                                    agentReleaseCandidate: true,
                                    overwrittenAgentRelease: targetRelease,
                                },
                            },
                            upsert: true,
                        },
                    });
                    flowOperations.push({
                        updateOne: {
                            filter: this.withOrganization({ _id: flow._id }, auth?.organizationId),
                            update: {
                                $set: { latestVersion },
                                $unset: { versions: '' },
                            },
                        },
                    });
                }
                versionMap[flowId] = latestVersion;
            }
            if (versionOperations.length) {
                await this.versionModel.bulkWrite(versionOperations, { ordered: false });
            }
            if (flowOperations.length) {
                await this.model.bulkWrite(flowOperations);
            }
        }
        const set = {
            'releases.$.versions': versionMap,
            'releases.$.flowNames': flowNames,
            'releases.$.deployedAt': now,
            'releases.$.updatedAt': now,
            'releases.$.deployedBy': auth?.userId || '',
            'releases.$.deployedByEmail': auth?.userEmail || '',
        };
        if (body?.name !== undefined)
            set['releases.$.name'] = String(body.name || `Release ${targetRelease}`);
        if (body?.notes !== undefined)
            set['releases.$.notes'] = String(body.notes || '').trim();
        const updated = await this.agentModel.findOneAndUpdate(query, { $set: set }, { new: true }).lean().exec();
        if (!updated) {
            throw new common_1.HttpException('Versao do agente nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        return {
            agentId: name,
            activeRelease: this.normalizeVersionValue(updated.activeRelease),
            latestRelease: this.latestAgentReleaseNumber(updated),
            releases: await this.agentReleasesForResponse(updated, auth?.organizationId),
        };
    }
    async deleteAgentRelease(agentId, release, auth) {
        const name = this.normalizeAgentName(agentId);
        const targetRelease = this.normalizeVersionValue(release);
        if (!targetRelease) {
            throw new common_1.HttpException('Versao do agente invalida para exclusao.', common_1.HttpStatus.BAD_REQUEST);
        }
        const query = { ...this.agentQuery(name, auth?.organizationId), 'releases.release': targetRelease };
        const agent = await this.agentModel.findOne(query).lean().exec();
        if (!agent) {
            throw new common_1.HttpException('Versao do agente nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        if (this.normalizeVersionValue(agent.activeRelease) === targetRelease) {
            throw new common_1.HttpException('Nao e possivel excluir a versao ativa do agente. Ative outra versao antes.', common_1.HttpStatus.BAD_REQUEST);
        }
        const remainingReleases = this.agentReleases(agent).filter((item) => Number(item?.release) !== targetRelease);
        const latestRelease = remainingReleases.reduce((max, item) => Math.max(max, Number(item?.release) || 0), 0);
        const updated = await this.agentModel.findOneAndUpdate(query, {
            $pull: { releases: { release: targetRelease } },
            $set: { latestRelease },
        }, { new: true }).lean().exec();
        if (!updated) {
            throw new common_1.HttpException('Versao do agente nao encontrada.', common_1.HttpStatus.NOT_FOUND);
        }
        return {
            agentId: name,
            activeRelease: this.normalizeVersionValue(updated.activeRelease),
            latestRelease: this.latestAgentReleaseNumber(updated),
            releases: await this.agentReleasesForResponse(updated, auth?.organizationId),
        };
    }
    async update(id, updateDto, auth) {
        if (updateDto.agentId) {
            updateDto.agentId = this.normalizeAgentName(updateDto.agentId);
            if (updateDto.agentId !== 'default-agent') {
                await this.ensureAgent(updateDto.agentId, auth);
            }
        }
        const { versions: _ignoredVersions, ...safeUpdateDto } = updateDto;
        const query = this.withOrganization({ _id: id }, auth?.organizationId);
        const updated = await this.model
            .findOneAndUpdate(query, safeUpdateDto, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.HttpException('Canvas flow not found', common_1.HttpStatus.NOT_FOUND);
        }
        await this.unsetOtherMainFlows(updated);
        return updated;
    }
    async remove(id, organizationId) {
        const flow = await this.model.findOneAndDelete(this.withOrganization({ _id: id }, organizationId)).lean().exec();
        if (!flow)
            return null;
        const flowId = String(flow._id || id);
        const cleanupQuery = this.withOrganization({}, organizationId || flow.organizationId);
        await this.versionModel.deleteMany(this.flowVersionQuery(flowId, organizationId || flow.organizationId)).exec();
        await this.agentModel.updateMany(cleanupQuery, {
            $unset: {
                [`releases.$[].versions.${flowId}`]: '',
                [`releases.$[].flowNames.${flowId}`]: '',
            },
        }).exec();
        return flow;
    }
};
exports.CanvasFlowService = CanvasFlowService;
exports.CanvasFlowService = CanvasFlowService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(canvas_flow_constants_model_1.MODEL_NAME)),
    __param(1, (0, common_1.Inject)(canvas_flow_constants_model_1.AGENT_MODEL_NAME)),
    __param(2, (0, common_1.Inject)(canvas_flow_constants_model_1.VERSION_MODEL_NAME)),
    __metadata("design:paramtypes", [mongoose_1.Model,
        mongoose_1.Model,
        mongoose_1.Model])
], CanvasFlowService);
//# sourceMappingURL=canvas-flow-service.js.map