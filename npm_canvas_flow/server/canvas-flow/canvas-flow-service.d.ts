import { Model } from 'mongoose';
import { CanvasFlowAgentEntity, CanvasFlowEntity, CanvasFlowVersionEntity } from './canvas-flow-schema';
import { CreateCanvasFlowDto } from './dto/create-canvas-flow.dto';
import { UpdateCanvasFlowDto } from './dto/update-canvas-flow.dto';
type CanvasFlowAuthContext = {
    organizationId?: string;
    userId?: string;
    userEmail?: string;
};
type AgentRuntimeConfig = {
    model?: string;
    llmProvider?: 'openai' | 'azure_openai' | 'azure' | 'gemini' | 'claude' | 'grok' | 'bedrock';
    agentSpec?: {
        agentsMd?: string;
        guardrails?: string;
        blockedTerms?: string[];
        rules?: Array<Record<string, any>>;
        skills?: Array<Record<string, any>>;
        subagents?: Array<Record<string, any>>;
        mcpServers?: Array<Record<string, any>>;
    };
};
type AgentWorkspaceFile = {
    path: string;
    content: string;
    type?: string;
    encoding?: string;
};
type AgentWorkspacePackage = {
    kind: 'canvas-flow-agent-workspace';
    version: number;
    folderName: '.canvas-flow';
    agentId: string;
    agentName: string;
    exportedAt: string;
    config: AgentRuntimeConfig;
    files: AgentWorkspaceFile[];
};
type CanvasFlowVersionMigrationOptions = {
    organizationId?: string;
    dryRun?: boolean;
    keepLegacy?: boolean;
    limit?: number;
};
type CanvasFlowVersionMigrationSummary = {
    dryRun: boolean;
    keepLegacy: boolean;
    scannedFlows: number;
    migratedFlows: number;
    skippedFlows: number;
    failedFlows: number;
    embeddedVersions: number;
    insertedVersions: number;
    legacyFlowBsonSizeBytes?: number;
    postMigrationFlowBsonSizeBytes?: number;
    versionBsonSizeBytes?: number;
    errors: Array<{
        flowId: string;
        message: string;
    }>;
};
export declare class CanvasFlowService {
    private model;
    private agentModel;
    private versionModel;
    constructor(model: Model<CanvasFlowEntity>, agentModel: Model<CanvasFlowAgentEntity>, versionModel: Model<CanvasFlowVersionEntity>);
    private normalizeAgentName;
    private createAgentIdSlug;
    private normalizeAgentDisplayName;
    private nextAvailableAgentId;
    private unsetOtherMainFlows;
    private withOrganization;
    private scopedQuery;
    private agentQuery;
    private agentDisplayNameQuery;
    private ensureAgent;
    private sortFlows;
    private sortAgents;
    private cloneJson;
    private isPlainObject;
    private normalizeObjectList;
    private normalizeBlockedTerms;
    private normalizeAgentRuntimeConfig;
    private safeWorkspaceFileName;
    private workspaceJson;
    private workspaceFile;
    private normalizeWorkspacePath;
    private workspaceFilesFromPayload;
    private readWorkspaceFile;
    private readWorkspaceFolder;
    private parseWorkspaceJson;
    private normalizeWorkspaceLoadMode;
    private catalogItemId;
    private catalogItemName;
    private catalogItemDescription;
    private buildWorkspaceManifest;
    private applyWorkspaceManifestList;
    private applyWorkspaceManifestToSpec;
    private workspaceConfigFromPayload;
    private normalizeVersionValue;
    private updateActiveAgentReleaseFlowVersion;
    private flowVersions;
    private flowId;
    private flowVersionQuery;
    private flowObjectId;
    private versionRecordFromFlow;
    private aggregateVersionRecords;
    private flowDocumentBsonSize;
    private versionDocumentsBsonSize;
    private migrateEmbeddedVersions;
    private loadFlowForVersionAccess;
    private findFlowVersions;
    private findFlowVersion;
    private latestVersionFromRecords;
    private latestExistingFlowVersionNumberAsync;
    private flowWithVersions;
    migrateEmbeddedFlowVersions(options?: CanvasFlowVersionMigrationOptions): Promise<CanvasFlowVersionMigrationSummary>;
    private agentReleases;
    private agentReleasesForResponse;
    private latestFlowVersionNumber;
    private latestExistingFlowVersionNumber;
    private latestAgentReleaseNumber;
    resolveFlowVersion(flow: any, requestedVersion?: any): {
        config: any;
        version?: number;
        source: 'draft' | 'version';
        activeVersion?: number;
        latestVersion: number;
    };
    resolveFlowVersionAsync(flow: any, requestedVersion?: any): Promise<{
        config: any;
        version?: number;
        source: 'draft' | 'version';
        activeVersion?: number;
        latestVersion: number;
    }>;
    resolveAgentRelease(agentId?: string, organizationId?: string, requestedRelease?: any): Promise<{
        release?: number;
        versions: Record<string, number>;
        source: 'active' | 'requested' | 'none';
        latestRelease?: number;
    }>;
    private nextAgentSortOrder;
    private nextSortOrder;
    create(createDto: CreateCanvasFlowDto, auth?: {
        organizationId?: string;
        userId?: string;
    }): Promise<CanvasFlowEntity>;
    findAll(agentId?: string, organizationId?: string, options?: {
        includeConfig?: boolean;
    }): Promise<any[]>;
    listAgents(organizationId?: string): Promise<any[]>;
    createAgent(name: string, auth?: {
        organizationId?: string;
        userId?: string;
    }): Promise<any>;
    getAgentConfig(agentId: string, organizationId?: string): Promise<AgentRuntimeConfig>;
    updateAgentConfig(agentId: string, config: any, auth?: {
        organizationId?: string;
        userId?: string;
    }): Promise<any>;
    exportAgentWorkspace(agentId: string, organizationId?: string): Promise<AgentWorkspacePackage>;
    importAgentWorkspace(agentId: string, payload: any, auth?: {
        organizationId?: string;
        userId?: string;
    }): Promise<any>;
    renameAgent(currentAgentId: string, nextName: string, auth?: {
        organizationId?: string;
    }): Promise<any>;
    removeAgent(agentId: string, confirmationName: string, auth?: {
        organizationId?: string;
    }): Promise<{
        agentId: string;
        name: any;
        deletedFlows: number;
        deletedAgents: number;
        agents: any[];
    }>;
    reorderAgents(orderedAgentIds: string[], auth?: {
        organizationId?: string;
        userId?: string;
    }): Promise<any[]>;
    reorder(orderedIds: string[], agentId?: string, organizationId?: string): Promise<any[]>;
    findMain(agentId?: string, channel?: string): Promise<any>;
    findOne(id: string, organizationId?: string, options?: {
        includeVersions?: boolean;
        includeBsonSize?: boolean;
    }): Promise<any>;
    getVersions(id: string, auth?: {
        organizationId?: string;
    }): Promise<any>;
    deployVersion(id: string, body?: any, auth?: CanvasFlowAuthContext): Promise<any>;
    activateVersion(id: string, version: any, auth?: CanvasFlowAuthContext): Promise<any>;
    renameVersion(id: string, version: any, body?: any, auth?: {
        organizationId?: string;
    }): Promise<any>;
    deleteVersion(id: string, version: any, auth?: {
        organizationId?: string;
    }): Promise<any>;
    overwriteVersion(id: string, version: any, body?: any, auth?: CanvasFlowAuthContext): Promise<any>;
    getAgentReleases(agentId: string, auth?: {
        organizationId?: string;
        userId?: string;
    }): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    deployAgentRelease(agentId: string, body?: any, auth?: CanvasFlowAuthContext): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        release: any;
        releases: any[];
    }>;
    activateAgentRelease(agentId: string, release: any, auth?: CanvasFlowAuthContext): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    renameAgentRelease(agentId: string, release: any, body?: any, auth?: {
        organizationId?: string;
    }): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    overwriteAgentRelease(agentId: string, release: any, body?: any, auth?: CanvasFlowAuthContext): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    deleteAgentRelease(agentId: string, release: any, auth?: {
        organizationId?: string;
    }): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    update(id: string, updateDto: UpdateCanvasFlowDto, auth?: {
        organizationId?: string;
    }): Promise<any>;
    remove(id: string, organizationId?: string): Promise<any>;
}
export {};
