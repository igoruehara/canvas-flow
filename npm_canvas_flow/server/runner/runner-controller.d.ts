import { ApiKeyService } from '../api-key/api-key-service';
import { AuthService } from '../auth/auth-service';
import { SqsTransitionService } from '../queue/sqs-transition-service';
import { RunnerQueueProcessor } from './runner-queue-processor';
import { RunnerService } from './runner-service';
export declare class RunnerController {
    private readonly service;
    private readonly apiKeyService;
    private readonly authService;
    private readonly sqsTransitionService;
    private readonly runnerQueueProcessor;
    constructor(service: RunnerService, apiKeyService: ApiKeyService, authService: AuthService, sqsTransitionService: SqsTransitionService, runnerQueueProcessor: RunnerQueueProcessor);
    private assertApiToken;
    test(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        queued: boolean;
        skipped: boolean;
        messageId?: undefined;
        id?: undefined;
        jobId?: undefined;
        type?: undefined;
        status?: undefined;
    } | {
        queued: boolean;
        messageId: string;
        id: string;
        jobId: string;
        type: string;
        status: string;
        skipped?: undefined;
    } | {
        messages: {
            role: string;
            text: string;
        }[];
        slots: any;
        trace: any[];
        tracePage: {
            mode: "debug" | "off" | "compact" | "full";
            total: number;
            buffered: number;
            dropped: number;
            offset: number;
            limit: number;
            returned: number;
            hasMore: boolean;
            nextOffset: number;
        };
        currentStepId?: undefined;
        ended?: undefined;
        conversationId?: undefined;
        entryFlowId?: undefined;
        activeFlowId?: undefined;
        activeFlowName?: undefined;
        flowVersion?: undefined;
        activeFlowVersion?: undefined;
        flowVersionSource?: undefined;
        agentRelease?: undefined;
        agentReleaseSource?: undefined;
        memoryClearRequested?: undefined;
        memoryCleared?: undefined;
        runtime?: undefined;
    } | {
        messages: import("./runner-service").FlowMessage[];
        slots: any;
        currentStepId: string;
        ended: boolean;
        conversationId: any;
        entryFlowId: any;
        activeFlowId: any;
        activeFlowName: any;
        trace: any[];
        tracePage: {
            mode: "debug" | "off" | "compact" | "full";
            total: number;
            buffered: number;
            dropped: number;
            offset: number;
            limit: number;
            returned: number;
            hasMore: boolean;
            nextOffset: number;
        };
        flowVersion: number;
        activeFlowVersion: number;
        flowVersionSource: "version" | "draft";
        agentRelease: any;
        agentReleaseSource: "active" | "requested" | "none";
        memoryClearRequested: boolean;
        memoryCleared: boolean;
        runtime: import("./langgraph-runtime.service").CanvasFlowLangGraphRuntimeMetadata;
    }>;
    templates(authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        templates: {
            id: string;
            name: string;
            segment: string;
            description: string;
            channel: string;
            config: {
                startStepId: string;
                steps: {
                    id: string;
                    type: string;
                    title: string;
                    instruction: string;
                    position: {
                        x: number;
                        y: number;
                    };
                    tags: any[];
                }[];
                edges: {
                    id: string;
                    source: any;
                    target: any;
                }[];
                title: string;
                responseName: string;
                execute: string;
                model: string;
                llmProvider: string;
                channel: "webWidget" | "whatsapp";
                isMainFlow: boolean;
                webWidget: {
                    primaryColor: string;
                    accentColor: string;
                    assistantName: string;
                    subtitle: string;
                    welcomeMessage: string;
                    placeholder: string;
                    bubbleLabel: string;
                    avatarText: string;
                    openByDefault: boolean;
                    position: string;
                };
                whatsapp: {
                    provider: string;
                    deliveryMode: string;
                    verifyToken: string;
                    phoneNumberId: string;
                    accessToken: string;
                    graphApiVersion: string;
                    autoReply: boolean;
                };
                turnHistoricMessages: number;
            };
        }[];
    }>;
    agentOpsDashboard(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        filters: {
            organizationId: any;
            agentId: any;
            flowId: any;
            conversationId: any;
            dateFrom: any;
            dateTo: any;
        };
        summary: {
            conversations: number;
            messages: any;
            userMessages: number;
            assistantMessages: number;
            runs: number;
            errorCount: number;
            errorRate: number;
            avgDurationMs: number;
            llmCalls: any;
            estimatedTokens: number;
            estimatedTokenSource: string;
        };
        queue: any;
        insights: {
            summary: {
                totalMessages: any;
                userMessages: number;
                assistantMessages: number;
                conversations: number;
                avgMessagesPerConversation: number;
                avgUserMessagesPerConversation: number;
                longConversations: number;
            };
            byRole: any[];
            byChannel: any[];
            byFlow: any[];
            topConversations: any[];
            daily: any[];
        };
        traceInsights: {
            summary: {
                runs: number;
                totalEvents: number;
                errorCount: number;
                nodesTouched: number;
                callTypes: number;
            };
            byType: any[];
            byStep: any[];
            calls: any[];
            errors: any[];
        };
        errors: any[];
        hotNodes: any[];
        releases: any;
        flows: {
            flowId: string;
            name: any;
            activeVersion: any;
            latestVersion: any;
            isMainFlow: boolean;
            channel: any;
        }[];
        capabilities: {
            totalNodes: number;
            approvalGates: number;
            mcpNodes: number;
            exposedMcpTools: number;
            ragNodes: number;
            cronNodes: number;
            webhookNodes: number;
            whatsappFlows: number;
            dashboards: number;
            flowToMcpEndpointReady: boolean;
        };
        capabilityByFlow: any[];
        readiness: {
            status: string;
            warnings: string[];
        };
        history: (import("mongoose").FlattenMaps<import("../memory/memory-schema").MemoryTurnEntity> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[] | (import("mongoose").FlattenMaps<import("../memory/memory-history-schema").MemoryHistoryEntity> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        generatedAt: string;
    }>;
    mcpTools(agentId: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        name: string;
        protocol: string;
        transport: string;
        endpoint: string;
        authentication: {
            headers: {
                Authorization: string;
                'x-api-key': string;
            };
            note: string;
        };
        consumption: {
            description: string;
            sequence: string[];
            toolNameSource: string;
            callArguments: {
                text: string;
                conversationId: string;
                slots: string;
                flowVersion: string;
                agentRelease: string;
                approvals: string;
            };
        };
        clientExample: {
            initialize: {
                jsonrpc: string;
                id: number;
                method: string;
                params: {
                    protocolVersion: string;
                    capabilities: {};
                    clientInfo: {
                        name: string;
                        version: string;
                    };
                };
            };
            listTools: {
                jsonrpc: string;
                id: number;
                method: string;
                params: {};
            };
            callTool: {
                jsonrpc: string;
                id: number;
                method: string;
                params: {
                    name: string;
                    arguments: {
                        text: string;
                        conversationId: string;
                        slots: {};
                    };
                };
            };
        };
        tools: {
            name: string;
            title: any;
            description: any;
            inputSchema: {
                type: string;
                properties: {
                    text: {
                        type: string;
                        description: string;
                    };
                    conversationId: {
                        type: string;
                        description: string;
                    };
                    slots: {
                        type: string;
                        description: string;
                        additionalProperties: boolean;
                    };
                    flowVersion: {
                        type: string;
                        description: string;
                    };
                    agentRelease: {
                        type: string;
                        description: string;
                    };
                    approvals: {
                        type: string;
                        description: string;
                        additionalProperties: boolean;
                    };
                };
                required: string[];
                additionalProperties: boolean;
                description: string;
            };
            annotations: {
                flowId: string;
                agentId: any;
                channel: any;
                activeVersion: any;
                latestVersion: any;
                isMainFlow: boolean;
            };
        }[];
    }>;
    mcpJsonRpc(agentId: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        jsonrpc: string;
        id: any;
        result: {
            protocolVersion: any;
            capabilities: {
                tools: {};
            };
            serverInfo: {
                name: string;
                version: string;
            };
            tools?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            protocolVersion?: undefined;
            capabilities?: undefined;
            serverInfo?: undefined;
            tools?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            tools: {
                name: string;
                title: any;
                description: any;
                inputSchema: {
                    type: string;
                    properties: {
                        text: {
                            type: string;
                            description: string;
                        };
                        conversationId: {
                            type: string;
                            description: string;
                        };
                        slots: {
                            type: string;
                            description: string;
                            additionalProperties: boolean;
                        };
                        flowVersion: {
                            type: string;
                            description: string;
                        };
                        agentRelease: {
                            type: string;
                            description: string;
                        };
                        approvals: {
                            type: string;
                            description: string;
                            additionalProperties: boolean;
                        };
                    };
                    required: string[];
                    additionalProperties: boolean;
                    description: string;
                };
                annotations: {
                    flowId: string;
                    agentId: any;
                    channel: any;
                    activeVersion: any;
                    latestVersion: any;
                    isMainFlow: boolean;
                };
            }[];
            protocolVersion?: undefined;
            capabilities?: undefined;
            serverInfo?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            content: {
                type: string;
                text: string;
            }[];
            structuredContent: {
                messages: {
                    role: string;
                    text: string;
                }[];
                slots: any;
                currentStepId: string;
                ended: boolean;
                conversationId: any;
                flowId: string;
                flowName: any;
                trace: any[];
            };
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        error: {
            code: any;
            message: any;
        };
        result?: undefined;
    } | ({
        jsonrpc: string;
        id: any;
        result: {
            protocolVersion: any;
            capabilities: {
                tools: {};
            };
            serverInfo: {
                name: string;
                version: string;
            };
            tools?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            protocolVersion?: undefined;
            capabilities?: undefined;
            serverInfo?: undefined;
            tools?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            tools: {
                name: string;
                title: any;
                description: any;
                inputSchema: {
                    type: string;
                    properties: {
                        text: {
                            type: string;
                            description: string;
                        };
                        conversationId: {
                            type: string;
                            description: string;
                        };
                        slots: {
                            type: string;
                            description: string;
                            additionalProperties: boolean;
                        };
                        flowVersion: {
                            type: string;
                            description: string;
                        };
                        agentRelease: {
                            type: string;
                            description: string;
                        };
                        approvals: {
                            type: string;
                            description: string;
                            additionalProperties: boolean;
                        };
                    };
                    required: string[];
                    additionalProperties: boolean;
                    description: string;
                };
                annotations: {
                    flowId: string;
                    agentId: any;
                    channel: any;
                    activeVersion: any;
                    latestVersion: any;
                    isMainFlow: boolean;
                };
            }[];
            protocolVersion?: undefined;
            capabilities?: undefined;
            serverInfo?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            content: {
                type: string;
                text: string;
            }[];
            structuredContent: {
                messages: {
                    role: string;
                    text: string;
                }[];
                slots: any;
                currentStepId: string;
                ended: boolean;
                conversationId: any;
                flowId: string;
                flowName: any;
                trace: any[];
            };
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        error: {
            code: any;
            message: any;
        };
        result?: undefined;
    })[]>;
    listExternalMcpTools(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        external: {
            transport: string;
            url: string;
            authMode: string;
            server: {
                version: string;
                name: string;
                websiteUrl?: string;
                description?: string;
                icons?: {
                    src: string;
                    mimeType?: string;
                    sizes?: string[];
                    theme?: "light" | "dark";
                }[];
                title?: string;
            };
            capabilities: {
                experimental?: {
                    [x: string]: object;
                };
                logging?: object;
                completions?: object;
                prompts?: {
                    listChanged?: boolean;
                };
                resources?: {
                    subscribe?: boolean;
                    listChanged?: boolean;
                };
                tools?: {
                    listChanged?: boolean;
                };
                tasks?: {
                    [x: string]: unknown;
                    list?: object;
                    cancel?: object;
                    requests?: {
                        [x: string]: unknown;
                        tools?: {
                            [x: string]: unknown;
                            call?: object;
                        };
                    };
                };
                extensions?: {
                    [x: string]: object;
                };
            };
        };
        tools: {
            name: string;
            title: string;
            description: string;
            inputSchema: any;
            outputSchema: any;
            annotations: any;
        }[];
    }>;
    replaySimulation(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        mode: string;
        summary: {
            total: number;
            passed: number;
            failed: number;
            passRate: number;
            durationMs: number;
        };
        results: any[];
        finalState: {
            conversationId: any;
            currentStepId: any;
            activeFlowId: any;
            slots: any;
        };
        generatedAt: string;
    }>;
    testStream(body: any, res: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<void>;
    generateContextScript(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        code: string;
        explanation: string;
        model: string;
    }>;
    generateMongoConfig(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        explanation: string;
        model: string;
    }>;
    generateFlowWithAssistant(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    generatePromptField(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    createWhatsappFlow(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        success: boolean;
        flowId: string;
        created: any;
        upload: {
            success: boolean;
            flowId: string;
            data: any;
            validationErrors: any;
            flowJson: any;
        };
        validationErrors: any[];
        publish?: undefined;
        flowJson?: undefined;
    } | {
        success: boolean;
        flowId: string;
        created: any;
        upload: {
            success: boolean;
            flowId: string;
            data: any;
            validationErrors: any;
            flowJson: any;
        };
        publish: {
            success: boolean;
            flowId: string;
            data: any;
        };
        flowJson: any;
        validationErrors?: undefined;
    }>;
    listWhatsappFlows(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        success: boolean;
        flows: any;
        paging: any;
        businessAccountId: string;
        graphApiVersion: string;
    }>;
    deleteWhatsappFlow(flowId: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        success: boolean;
        deleted: boolean;
        flowId: string;
        data: any;
        deprecated?: undefined;
        deleteFallbackReason?: undefined;
    } | {
        success: boolean;
        deleted: boolean;
        deprecated: boolean;
        flowId: string;
        data: any;
        deleteFallbackReason: any;
    }>;
    uploadWhatsappFlowJson(flowId: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        success: boolean;
        flowId: string;
        data: any;
        validationErrors: any;
        flowJson: any;
    }>;
    publishWhatsappFlow(flowId: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        success: boolean;
        flowId: string;
        data: any;
    }>;
    tagDashboard(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        history: (import("mongoose").FlattenMaps<import("../memory/memory-schema").MemoryTurnEntity> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[] | (import("mongoose").FlattenMaps<import("../memory/memory-history-schema").MemoryHistoryEntity> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        historyPagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
        insights: {
            summary: {
                totalMessages: any;
                userMessages: number;
                assistantMessages: number;
                conversations: number;
                avgMessagesPerConversation: number;
                avgUserMessagesPerConversation: number;
                longConversations: number;
            };
            byRole: any[];
            byChannel: any[];
            byFlow: any[];
            topConversations: any[];
            daily: any[];
        };
        traceInsights: {
            summary: {
                runs: number;
                totalEvents: number;
                errorCount: number;
                nodesTouched: number;
                callTypes: number;
            };
            byType: any[];
            byStep: any[];
            calls: any[];
            errors: any[];
        };
        filters: import("../flow-tag/flow-tag-service").FlowTagDashboardFilters;
        summary: {
            total: number;
            conversations: number;
            tags: number;
            flows: number;
        };
        byTag: any[];
        byFlow: any[];
        events: (import("mongoose").FlattenMaps<import("../flow-tag/flow-tag-schema").FlowTagEventEntity> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        conversationIds: any;
    }>;
    runDueCron(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        ok: boolean;
        skipped: boolean;
        reason: string;
        error?: undefined;
        timestamp?: undefined;
        checkedFlows?: undefined;
        executions?: undefined;
        scheduled?: undefined;
    } | {
        ok: boolean;
        skipped: boolean;
        reason: string;
        error: any;
        timestamp: string;
        checkedFlows?: undefined;
        executions?: undefined;
        scheduled?: undefined;
    } | {
        ok: boolean;
        checkedFlows: number;
        executions: any[];
        scheduled: any[];
        timestamp: string;
        skipped?: undefined;
        reason?: undefined;
        error?: undefined;
    }>;
    consumeSqsMessages(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        consumed: number;
        failed: number;
        failures: any[];
        batchItemFailures: any[];
        results: any[];
    }>;
    getSqsJob(jobId: string, agentId?: string, flowId?: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    retrySqsJob(jobId: string, body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        queued: boolean;
        skipped: boolean;
        messageId?: undefined;
        id?: undefined;
        jobId?: undefined;
        type?: undefined;
        status?: undefined;
    } | {
        queued: boolean;
        messageId: string;
        id: string;
        jobId: string;
        type: string;
        status: string;
        skipped?: undefined;
    } | {
        skipped: boolean;
        reason: string;
        jobId: string;
    }>;
    getSqsHealth(authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    getReport(fileName: string, res: any): Promise<any>;
    getWhatsappMedia(flowId: string, mediaId: string, expiresAt: string, signature: string, res: any): Promise<any>;
    receiveCustomWebhookGet(flowId: string, webhookId: string, query: any, headers: Record<string, any>): Promise<{
        messages: {
            role: string;
            text: string;
        }[];
        slots: any;
        trace: any[];
        tracePage: {
            mode: "debug" | "off" | "compact" | "full";
            total: number;
            buffered: number;
            dropped: number;
            offset: number;
            limit: number;
            returned: number;
            hasMore: boolean;
            nextOffset: number;
        };
        currentStepId?: undefined;
        ended?: undefined;
        conversationId?: undefined;
        entryFlowId?: undefined;
        activeFlowId?: undefined;
        activeFlowName?: undefined;
        flowVersion?: undefined;
        activeFlowVersion?: undefined;
        flowVersionSource?: undefined;
        agentRelease?: undefined;
        agentReleaseSource?: undefined;
        memoryClearRequested?: undefined;
        memoryCleared?: undefined;
        runtime?: undefined;
    } | {
        messages: import("./runner-service").FlowMessage[];
        slots: any;
        currentStepId: string;
        ended: boolean;
        conversationId: any;
        entryFlowId: any;
        activeFlowId: any;
        activeFlowName: any;
        trace: any[];
        tracePage: {
            mode: "debug" | "off" | "compact" | "full";
            total: number;
            buffered: number;
            dropped: number;
            offset: number;
            limit: number;
            returned: number;
            hasMore: boolean;
            nextOffset: number;
        };
        flowVersion: number;
        activeFlowVersion: number;
        flowVersionSource: "version" | "draft";
        agentRelease: any;
        agentReleaseSource: "active" | "requested" | "none";
        memoryClearRequested: boolean;
        memoryCleared: boolean;
        runtime: import("./langgraph-runtime.service").CanvasFlowLangGraphRuntimeMetadata;
    } | {
        async: boolean;
        queued: boolean;
        jobId: `${string}-${string}-${string}-${string}-${string}`;
        status: string;
        retrieval: string;
        callbackUrlConfigured: boolean;
    }>;
    receiveCustomWebhookPost(flowId: string, webhookId: string, body: any, query: any, headers: Record<string, any>): Promise<{
        messages: {
            role: string;
            text: string;
        }[];
        slots: any;
        trace: any[];
        tracePage: {
            mode: "debug" | "off" | "compact" | "full";
            total: number;
            buffered: number;
            dropped: number;
            offset: number;
            limit: number;
            returned: number;
            hasMore: boolean;
            nextOffset: number;
        };
        currentStepId?: undefined;
        ended?: undefined;
        conversationId?: undefined;
        entryFlowId?: undefined;
        activeFlowId?: undefined;
        activeFlowName?: undefined;
        flowVersion?: undefined;
        activeFlowVersion?: undefined;
        flowVersionSource?: undefined;
        agentRelease?: undefined;
        agentReleaseSource?: undefined;
        memoryClearRequested?: undefined;
        memoryCleared?: undefined;
        runtime?: undefined;
    } | {
        messages: import("./runner-service").FlowMessage[];
        slots: any;
        currentStepId: string;
        ended: boolean;
        conversationId: any;
        entryFlowId: any;
        activeFlowId: any;
        activeFlowName: any;
        trace: any[];
        tracePage: {
            mode: "debug" | "off" | "compact" | "full";
            total: number;
            buffered: number;
            dropped: number;
            offset: number;
            limit: number;
            returned: number;
            hasMore: boolean;
            nextOffset: number;
        };
        flowVersion: number;
        activeFlowVersion: number;
        flowVersionSource: "version" | "draft";
        agentRelease: any;
        agentReleaseSource: "active" | "requested" | "none";
        memoryClearRequested: boolean;
        memoryCleared: boolean;
        runtime: import("./langgraph-runtime.service").CanvasFlowLangGraphRuntimeMetadata;
    } | {
        async: boolean;
        queued: boolean;
        jobId: `${string}-${string}-${string}-${string}-${string}`;
        status: string;
        retrieval: string;
        callbackUrlConfigured: boolean;
    }>;
    verifyWhatsappWebhook(flowId: string, mode: string, verifyToken: string, challenge: string, res: any): Promise<any>;
    verifyWhatsappMainWebhook(agentId: string, mode: string, verifyToken: string, challenge: string, res: any): Promise<any>;
    receiveWhatsappWebhook(flowId: string, body: any): Promise<{
        queued: boolean;
        skipped: boolean;
        messageId?: undefined;
        id?: undefined;
        jobId?: undefined;
        type?: undefined;
        status?: undefined;
    } | {
        queued: boolean;
        messageId: string;
        id: string;
        jobId: string;
        type: string;
        status: string;
        skipped?: undefined;
    } | {
        ok: boolean;
        received: number;
        ignored: boolean;
        results?: undefined;
    } | {
        ok: boolean;
        received: any;
        results: any[];
        ignored?: undefined;
    }>;
    receiveWhatsappMainWebhook(agentId: string, body: any): Promise<{
        queued: boolean;
        skipped: boolean;
        messageId?: undefined;
        id?: undefined;
        jobId?: undefined;
        type?: undefined;
        status?: undefined;
    } | {
        queued: boolean;
        messageId: string;
        id: string;
        jobId: string;
        type: string;
        status: string;
        skipped?: undefined;
    } | {
        ok: boolean;
        received: number;
        ignored: boolean;
        results?: undefined;
    } | {
        ok: boolean;
        received: any;
        results: any[];
        ignored?: undefined;
    }>;
}
