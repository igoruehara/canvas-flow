import { AuthService } from '../auth/auth-service';
import { CanvasFlowService } from './canvas-flow-service';
import { CreateCanvasFlowDto } from './dto/create-canvas-flow.dto';
import { UpdateCanvasFlowDto } from './dto/update-canvas-flow.dto';
export declare class CanvasFlowController {
    private readonly service;
    private readonly authService;
    constructor(service: CanvasFlowService, authService: AuthService);
    create(createDto: CreateCanvasFlowDto, authorization?: string, headerToken?: string, xApiKey?: string): Promise<import("./canvas-flow-schema").CanvasFlowEntity>;
    findAll(agentId?: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any[]>;
    listAgents(authorization?: string, headerToken?: string, xApiKey?: string): Promise<any[]>;
    createAgent(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    reorderAgents(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any[]>;
    updateAgentConfig(name: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    exportAgentWorkspace(name: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        kind: "canvas-flow-agent-workspace";
        version: number;
        folderName: ".canvas-flow";
        agentId: string;
        agentName: string;
        exportedAt: string;
        config: {
            model?: string;
            llmProvider?: "openai" | "azure_openai" | "azure" | "gemini" | "claude" | "grok" | "bedrock";
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
        files: {
            path: string;
            content: string;
            type?: string;
            encoding?: string;
        }[];
    }>;
    importAgentWorkspace(name: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    renameAgent(name: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    removeAgent(name: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        agentId: string;
        name: any;
        deletedFlows: number;
        deletedAgents: number;
        agents: any[];
    }>;
    getAgentReleases(name: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    deployAgentRelease(name: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        release: any;
        releases: any[];
    }>;
    activateAgentRelease(name: string, release: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    renameAgentRelease(name: string, release: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    overwriteAgentRelease(name: string, release: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    deleteAgentRelease(name: string, release: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        agentId: string;
        activeRelease: number;
        latestRelease: number;
        releases: any[];
    }>;
    getVersions(id: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    findOne(id: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    deployVersion(id: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    activateVersion(id: string, version: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    renameVersion(id: string, version: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    overwriteVersion(id: string, version: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    deleteVersion(id: string, version: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    reorder(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any[]>;
    update(id: string, updateDto: UpdateCanvasFlowDto, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    remove(id: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
}
