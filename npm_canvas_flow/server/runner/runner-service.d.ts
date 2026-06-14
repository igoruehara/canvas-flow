import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CanvasFlowService } from '../canvas-flow/canvas-flow-service';
import { HttpBatchService } from '../http-batch/http-batch-service';
import { MemoryService } from '../memory/memory-service';
import { RagService } from '../rag/rag-service';
import { ProviderConfigService } from '../provider-config/provider-config-service';
import { FlowTagService } from '../flow-tag/flow-tag-service';
import { SqsTransitionService } from '../queue/sqs-transition-service';
import { McpOAuthService } from '../mcp-oauth/mcp-oauth-service';
import { LangGraphRuntimeService } from './langgraph-runtime.service';
import * as mongoose from 'mongoose';
import { DocumentsService } from '../documents/documents-service';
type TraceMode = 'compact' | 'debug' | 'full' | 'off';
export interface FlowMessage {
    role: string;
    text: string;
    kind?: string;
    delayBeforeMs?: number;
    debug?: unknown;
    content?: RichMessageConfig;
}
interface RichMessageAction {
    id?: string;
    label?: string;
    value?: string;
    url?: string;
}
interface RichMessageGenerationConfig {
    enabled?: boolean;
    prompt?: string;
    model?: string;
    maxItems?: number;
}
type AppointmentFlowStage = 'actions' | 'appointments' | 'providers' | 'services' | 'dates' | 'times' | 'items' | 'exams';
type AppointmentFlowAttachmentType = 'image' | 'document';
interface AppointmentFlowAttachmentStep {
    id?: string;
    label?: string;
    type?: AppointmentFlowAttachmentType;
    required?: boolean;
    description?: string;
}
interface RichMessageAppointmentFlowConfig {
    mode?: 'auto' | 'metaFlow' | 'interactive';
    flowId?: string;
    flowToken?: string;
    flowCta?: string;
    flowScreen?: string;
    headerText?: string;
    buttonText?: string;
    stage?: AppointmentFlowStage;
    stageTemplate?: string;
    actionsTemplate?: any;
    appointmentsTemplate?: any;
    providersTemplate?: any;
    servicesTemplate?: any;
    datesTemplate?: any;
    timesTemplate?: any;
    itemsTemplate?: any;
    itemsFilterTemplate?: string;
    itemsMaxSelected?: number;
    examsTemplate?: any;
    payloadTemplate?: any;
    stepOrder?: string[];
    stepLabels?: Record<string, string>;
    attachmentSteps?: AppointmentFlowAttachmentStep[];
    llmEnabled?: boolean;
    llmSourceTemplate?: any;
    llmInstruction?: string;
    llmModel?: string;
    llmTemperature?: number;
}
interface RichMessageMediaConfig {
    url?: string;
    fileName?: string;
    mimeType?: string;
    caption?: string;
}
interface RichMessageConfig {
    type: 'text' | 'buttons' | 'quickReplies' | 'list' | 'carousel' | 'appointmentFlow' | 'image' | 'document';
    text?: string;
    footer?: string;
    media?: RichMessageMediaConfig;
    buttons?: RichMessageAction[];
    quickReplies?: RichMessageAction[];
    list?: {
        buttonText?: string;
        sections?: Array<{
            title?: string;
            items?: Array<{
                id?: string;
                title?: string;
                description?: string;
                value?: string;
            }>;
        }>;
    };
    carousel?: {
        cards?: Array<{
            id?: string;
            title?: string;
            subtitle?: string;
            imageUrl?: string;
            buttons?: RichMessageAction[];
        }>;
    };
    appointmentFlow?: RichMessageAppointmentFlowConfig;
    generation?: RichMessageGenerationConfig;
}
export declare class RunnerService implements OnModuleInit, OnModuleDestroy {
    private readonly canvasFlowService;
    private readonly httpBatchService;
    private readonly memoryService;
    private readonly ragService;
    private readonly configService;
    private readonly providerConfigService;
    private readonly flowTagService;
    private readonly sqsTransitionService;
    private readonly mcpOAuthService;
    private readonly langGraphRuntimeService?;
    private readonly documentsService?;
    private openAIClient?;
    private openAIRuntimeConfig?;
    private openAISignature;
    private operationalMongoConnection?;
    private operationalMongoSignature;
    private cronTimer?;
    private cronRunning;
    private fallbackLangGraphRuntimeService?;
    constructor(canvasFlowService: CanvasFlowService, httpBatchService: HttpBatchService, memoryService: MemoryService, ragService: RagService, configService: ConfigService, providerConfigService: ProviderConfigService, flowTagService: FlowTagService, sqsTransitionService: SqsTransitionService, mcpOAuthService: McpOAuthService, langGraphRuntimeService?: LangGraphRuntimeService, documentsService?: DocumentsService);
    private refreshOpenAIClient;
    private getOpenAIClient;
    private normalizeFlowLlmProvider;
    private isRuntimeLlmProviderConfigured;
    private resolveRuntimeLlmProvider;
    private getOpenAIClientForProvider;
    private getChatModelForProvider;
    private flowLlmProvider;
    private componentLlmProvider;
    private normalizeAgentCatalogLoadMode;
    private agentCatalogItemId;
    private agentCatalogItemName;
    private normalizeAgentManifestRefs;
    private scopeAgentCatalog;
    private withComponentAgentSpec;
    private buildAgentSystemPreamble;
    private withAgentSystemPreamble;
    private evaluateAgentGuardrails;
    private getProviderSettings;
    private getHeaderValue;
    private redactIncomingHeaders;
    private safeSecretEquals;
    private getWebhookInputText;
    private findCustomWebhookStep;
    private assertCustomWebhookAuth;
    private buildCustomWebhookRunPayload;
    deliverWebhookCallback(callback: any, result?: any, error?: any): Promise<{
        error: string;
        results: any[];
    } | {
        results: ({
            index: number;
            error: string;
            status?: undefined;
            statusText?: undefined;
            headers?: undefined;
            data?: undefined;
            message?: undefined;
            code?: undefined;
        } | {
            index: number;
            status: number;
            statusText: string;
            headers: Record<string, any>;
            data: any;
            error?: undefined;
            message?: undefined;
            code?: undefined;
        } | {
            index: number;
            error: string;
            message: any;
            code: any;
            status?: undefined;
            statusText?: undefined;
            headers?: undefined;
            data?: undefined;
        } | {
            polling: {
                enabled: boolean;
                completed: boolean;
                attempts: number;
                intervalSeconds: number;
                maxAttempts: number;
                reason: string;
                stopPath: string;
                value: any;
                finalResult: {
                    index: number;
                    error: string;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    status: number;
                    statusText: string;
                    headers: Record<string, any>;
                    data: any;
                    error?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    error: string;
                    message: any;
                    code: any;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                };
                history: any[];
                conditionError?: undefined;
            };
            finalStatus: number;
            finalData: any;
            index: number;
            error: string;
            status?: undefined;
            statusText?: undefined;
            headers?: undefined;
            data?: undefined;
            message?: undefined;
            code?: undefined;
        } | {
            polling: {
                enabled: boolean;
                completed: boolean;
                attempts: number;
                intervalSeconds: number;
                maxAttempts: number;
                reason: string;
                stopPath: string;
                value: any;
                finalResult: {
                    index: number;
                    error: string;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    status: number;
                    statusText: string;
                    headers: Record<string, any>;
                    data: any;
                    error?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    error: string;
                    message: any;
                    code: any;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                };
                history: any[];
                conditionError?: undefined;
            };
            finalStatus: number;
            finalData: any;
            index: number;
            status: number;
            statusText: string;
            headers: Record<string, any>;
            data: any;
            error?: undefined;
            message?: undefined;
            code?: undefined;
        } | {
            polling: {
                enabled: boolean;
                completed: boolean;
                attempts: number;
                intervalSeconds: number;
                maxAttempts: number;
                reason: string;
                stopPath: string;
                value: any;
                finalResult: {
                    index: number;
                    error: string;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    status: number;
                    statusText: string;
                    headers: Record<string, any>;
                    data: any;
                    error?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    error: string;
                    message: any;
                    code: any;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                };
                history: any[];
                conditionError?: undefined;
            };
            finalStatus: number;
            finalData: any;
            index: number;
            error: string;
            message: any;
            code: any;
            status?: undefined;
            statusText?: undefined;
            headers?: undefined;
            data?: undefined;
        } | {
            polling: {
                enabled: boolean;
                completed: boolean;
                attempts: number;
                intervalSeconds: number;
                maxAttempts: number;
                reason: string;
                conditionError: any;
                finalResult: {
                    index: number;
                    error: string;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    status: number;
                    statusText: string;
                    headers: Record<string, any>;
                    data: any;
                    error?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    error: string;
                    message: any;
                    code: any;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                };
                history: any[];
                stopPath?: undefined;
                value?: undefined;
            };
            finalStatus: number;
            finalData: any;
            index: number;
            error: string;
            status?: undefined;
            statusText?: undefined;
            headers?: undefined;
            data?: undefined;
            message?: undefined;
            code?: undefined;
        } | {
            polling: {
                enabled: boolean;
                completed: boolean;
                attempts: number;
                intervalSeconds: number;
                maxAttempts: number;
                reason: string;
                conditionError: any;
                finalResult: {
                    index: number;
                    error: string;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    status: number;
                    statusText: string;
                    headers: Record<string, any>;
                    data: any;
                    error?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    error: string;
                    message: any;
                    code: any;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                };
                history: any[];
                stopPath?: undefined;
                value?: undefined;
            };
            finalStatus: number;
            finalData: any;
            index: number;
            status: number;
            statusText: string;
            headers: Record<string, any>;
            data: any;
            error?: undefined;
            message?: undefined;
            code?: undefined;
        } | {
            polling: {
                enabled: boolean;
                completed: boolean;
                attempts: number;
                intervalSeconds: number;
                maxAttempts: number;
                reason: string;
                conditionError: any;
                finalResult: {
                    index: number;
                    error: string;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    status: number;
                    statusText: string;
                    headers: Record<string, any>;
                    data: any;
                    error?: undefined;
                    message?: undefined;
                    code?: undefined;
                } | {
                    index: number;
                    error: string;
                    message: any;
                    code: any;
                    status?: undefined;
                    statusText?: undefined;
                    headers?: undefined;
                    data?: undefined;
                };
                history: any[];
                stopPath?: undefined;
                value?: undefined;
            };
            finalStatus: number;
            finalData: any;
            index: number;
            error: string;
            message: any;
            code: any;
            status?: undefined;
            statusText?: undefined;
            headers?: undefined;
            data?: undefined;
        })[];
        error?: undefined;
    } | {
        skipped: boolean;
        reason: string;
    }>;
    persistWebhookRunState(runPayload: any, result: any): Promise<void>;
    private getWebhookListenerSteps;
    private shouldDispatchWebhookListeners;
    private createWebhookListenerEvent;
    private executeWebhookListenerStep;
    private dispatchWebhookListeners;
    runCustomWebhook(flowId: string, webhookId: string, payload: {
        method: string;
        body?: any;
        query?: any;
        headers?: Record<string, any>;
    }): Promise<{
        messages: {
            role: string;
            text: string;
        }[];
        slots: any;
        trace: any[];
        tracePage: {
            mode: TraceMode;
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
        messages: FlowMessage[];
        slots: any;
        currentStepId: string;
        ended: boolean;
        conversationId: any;
        entryFlowId: any;
        activeFlowId: any;
        activeFlowName: any;
        trace: any[];
        tracePage: {
            mode: TraceMode;
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
    onModuleInit(): void;
    onModuleDestroy(): void;
    private getByPath;
    private renderTemplate;
    private parseJsonConfig;
    private parseTemplatedJsonConfig;
    private toPlain;
    private resolveTraceOptions;
    private createTraceBuffer;
    private compactTraceEntry;
    private compactTraceValue;
    private traceValueSummary;
    private paginateTrace;
    private getOperationalMongoConnection;
    private getMongoCollection;
    private waitForMongoConnection;
    private limitNumber;
    private limitDecimal;
    private sleep;
    private emitFlowMessage;
    private maxParallelNodes;
    private allSettledLimited;
    private normalizeMongoUpdate;
    private normalizeMongoSort;
    private mergeMongoFilter;
    private getMongoEffectiveLlmMode;
    private hasMongoFilter;
    private applyMongoDateRange;
    private getMongoEffectiveDateComponent;
    private getMongoEffectivePagination;
    private buildMongoLlmQuery;
    private createAnalyticsDocument;
    private runMongoComponent;
    private resolveContextPathValue;
    private normalizeRagDocuments;
    private responseSlotForStep;
    private connectedInputsForStep;
    private withConnectedInputs;
    private connectedInputsContextText;
    private dedupeRagDocuments;
    private collectFileContextDocuments;
    private collectConnectedRagDocuments;
    private resolveRagDocumentsForComponent;
    private resolveLoopSourceArray;
    private setOrDeleteSlot;
    private getLoopBodyTargets;
    private runBranchTargets;
    private runLoopForComponent;
    private evaluateLoopStopCondition;
    private buildConditionFunctionBody;
    private collectLoopRevisitTargets;
    private runCounterLoopComponent;
    private evaluateFlowRouterRule;
    private getFlowRouterRuleModel;
    private getFlowRouterRuleTemperature;
    private sameFlowRouterLlmOptions;
    private evaluateFlowRouterLlmRules;
    private mergeContextSlots;
    private runFlowRouterComponent;
    private buildTraceDashboard;
    private isChartMode;
    private toNumber;
    private extractRowsForChart;
    private buildFallbackChart;
    private normalizeChartConfig;
    private generateDashboardChart;
    private getReportsDir;
    getReportFilePath(fileName: string): string;
    private getPublicBaseUrl;
    private getMediaProxySecret;
    private getMediaProxyTtlSeconds;
    private signWhatsappMediaProxy;
    private assertWhatsappMediaProxySignature;
    private buildWhatsappMediaProxyUrl;
    private normalizeDownloadFileName;
    downloadWhatsappMedia(flowId: string, mediaId: string, expiresAt: any, signature: any): Promise<{
        buffer: Buffer<ArrayBuffer>;
        mimeType: any;
        fileName: string;
    }>;
    private formatPdfValue;
    private drawDashboardRows;
    private createDashboardPdf;
    private runDashboardComponent;
    private toExtraFieldsFilterObject;
    private evaluateExtraFieldsFilterRules;
    private buildActiveExtraFieldsFilter;
    private resolveRagAgentId;
    private evaluateRagRuleExpression;
    private normalizeRagFilterObject;
    private normalizeRagFilterRounds;
    private normalizeRagRoundLimits;
    private normalizeRagOrderBy;
    private normalizeRagPositiveInteger;
    private mergeExtraFieldsFilterObjects;
    private resolveRagConditionalOverrides;
    private resolveRagPrompt;
    private buildRagSearchParams;
    private runRagSearchComponent;
    private renderMilvusDocumentId;
    private runMilvusComponent;
    private buildRagDocumentFromComponent;
    private normalizeRagDocumentsFromPath;
    private runRagIndexComponent;
    private runAzureBlobComponent;
    private getGoogleDriveFileId;
    private normalizeFilesDocuments;
    private hydrateFilesDocuments;
    private parseFilesArtifactPayload;
    private parseLooseFilesArtifactPayload;
    private extractLooseJsonStringField;
    private extractLooseJsonObjectField;
    private normalizeFilesDocumentSkillPlan;
    private normalizeFilesDocxEdits;
    private normalizeFilesXlsxValue;
    private normalizeFilesXlsxEdits;
    private filesDocxTableCount;
    private inferFilesDocxEdits;
    private filesStructureContext;
    private filesDocumentSkillEnabled;
    private filesDocumentSkillInventory;
    private filesDocumentSkillPrompt;
    private filesArtifactQuality;
    private nativeEditableFilesFormat;
    private filesArtifactFormat;
    private filesArtifactFilename;
    private assertFilesArtifactPayload;
    private numberedArtifactFilename;
    private fileNameFromUrl;
    private extractFileFromUrlForFilesComponent;
    private runFilesComponent;
    private runLlmGenComponent;
    private normalizeAgentExecutionMode;
    private agentExecutionModeForComponent;
    private isAgenticToolCaller;
    private manifestTargetStepId;
    private agenticManifestToolStepIds;
    private isManifestVisualEdge;
    private responseSlotCandidates;
    private agentDecisionSlots;
    private agentDecisionContext;
    private normalizeMessageInstruction;
    private isDefaultMessageInstruction;
    private rememberAssistantText;
    private getLastAssistantText;
    private rememberEmittedAssistantText;
    private getLastEmittedAssistantText;
    private getLastAssistantMessage;
    private assistantTextLooksLikeUserPrompt;
    private inferWaitingInputFromAssistantPrompt;
    private isDefaultPassthroughMessageStep;
    private isAssistantResponseWorkStep;
    private splitDeferredPassthroughMessages;
    private recordInputHistory;
    private resolveTurnHistoricMessages;
    private normalizeConversationTurns;
    private loadConversationTurns;
    private agentAutoToolTargetStepIds;
    private resolveCalledAgentToolDownstreamTargets;
    private filterHybridAgentOutgoingTargets;
    private agentToolText;
    private buildAgentAutoToolCatalog;
    private normalizeAgentToolSchema;
    private agentToolManifestForLlm;
    private agentToolCompactManifestForLlm;
    private agentToolContractForLlm;
    private agentToolObservationForLlm;
    private normalizeAgentToolPlanItem;
    private normalizeAgentToolPlan;
    private validateJsonSchemaValue;
    private validateAgentToolArguments;
    private validateAgentToolOutput;
    private agentToolSearchText;
    private normalizeEntityKey;
    private isEntityIdKey;
    private entityTokensFromText;
    private entityIdArgumentKey;
    private isEntityDetailTool;
    private isAppointmentDetailTool;
    private appointmentIdArgumentKey;
    private extractEntityIdsFromValue;
    private resolveNumericSelectionIndex;
    private extractAppointmentIdFromValue;
    private collectEntityCandidates;
    private collectAppointmentCandidates;
    private appointmentCandidatesFromContext;
    private entityCandidatesFromContext;
    private resolveAppointmentCandidateFromSelection;
    private resolveEntityCandidateFromSelection;
    private detailToolCandidateScore;
    private selectDetailToolForCandidate;
    private buildEntityDetailToolPlanFromContext;
    private buildAppointmentDetailToolPlanFromContext;
    private shouldBlockUngroundedAppointmentFinal;
    private hasSuccessfulAppointmentDetailObservation;
    private resolveAgentToolApproval;
    private buildAgentTaskState;
    private updateAgentTaskState;
    private runAgentPlanComponent;
    private readActiveAgentPlan;
    private normalizeExternalAgentPlan;
    private markAgentPlanConsumed;
    private normalizeAgentIntentText;
    private detectAgentIntents;
    private agentIntentLabel;
    private agentIntentTask;
    private agentToolCapabilities;
    private agentToolIntentScore;
    private rankedAgentToolsForIntent;
    private agentToolTriggerTokens;
    private agentToolMatchesQueryTrigger;
    private extractAgentTaskText;
    private trimAgentExtractedText;
    private extractAgentIntentPayload;
    private planItemTextForIntentDetection;
    private sanitizeAgentPlan;
    private validateAgentPlanCoverage;
    private repairAgentPlanCoverage;
    private agentToolResultAliases;
    private writeAgentToolResultSlots;
    private mergeAgentToolSlots;
    private planAgentAutoTools;
    private chooseAgentAutoTool;
    private prepareAgentToolArgumentsWithContract;
    private executeAgentAutoTool;
    private runAgentAutoToolsIfEnabled;
    private getRichMessageText;
    private getChatModel;
    private limitText;
    private limitId;
    private richMaxItems;
    private getRichMediaUrl;
    private getRichMediaCaption;
    private getRichMediaFileName;
    private getRichMediaMimeType;
    private mediaTypeFromUrlOrMime;
    private parseGeneratedJson;
    private isPlainObject;
    private assertContextPayload;
    private runContextScript;
    private generateContextPayloadWithLlm;
    private normalizeGeneratedContextScript;
    private assertContextScriptSyntax;
    generateContextScriptWithLlm(body: any): Promise<{
        code: string;
        explanation: string;
        model: string;
    }>;
    private stripUndefinedMongoFields;
    private assertSafeGeneratedMongoConfig;
    generateMongoConfigWithLlm(body: any): Promise<{
        explanation: string;
        model: string;
    }>;
    private normalizeAssistantSlug;
    private uniqueAssistantId;
    private normalizeAssistantVariableName;
    private normalizeAssistantPosition;
    private normalizeAssistantSearchText;
    private assistantTextMatchesMcpPreset;
    private assistantMcpPresetsForInstruction;
    private assistantMcpPresetPromptCatalog;
    private assistantStepMatchesMcpPreset;
    private assistantCatalogItemMatchesMcpPreset;
    private assistantArchitectureStepId;
    private upsertAssistantArchitectureEdge;
    private upsertAssistantManifestRef;
    private upsertAssistantCatalogItem;
    private ensureAssistantMcpArchitecture;
    private normalizeAssistantTags;
    private normalizeAssistantRichMessageConfig;
    private normalizeAssistantStep;
    private normalizeAssistantEdge;
    private normalizeAssistantFlowConfig;
    generateFlowConfigWithLlm(body: any): Promise<any>;
    private promptFieldSpec;
    generatePromptFieldWithLlm(body: any): Promise<any>;
    private runContextComponent;
    private resolveMcpLlmProvider;
    private normalizeMcpSchema;
    private getMcpSchemaKeys;
    private filterMcpObjectBySchema;
    private pruneMcpOptionalEmptyValues;
    private coerceMcpArgumentValueForSchema;
    private normalizeMcpArgumentsForSchema;
    private buildMcpContextPayload;
    private generateMcpPayloadWithLlm;
    private normalizeMcpMethod;
    private normalizeMcpBodyType;
    private isMcpGeneratedUrlAllowed;
    private applyMcpAuth;
    private redactMcpRequest;
    private redactMcpExternalUrl;
    private buildMcpExternalHeaders;
    private buildMcpExternalUrl;
    private createFetchWithMcpHeaders;
    private removeMcpExternalHeader;
    private normalizeMcpExternalError;
    private normalizeMcpFetchHeaders;
    private getAwsMcpEndpointConfig;
    private injectAwsMcpMetadata;
    private createAwsSigV4Fetch;
    private createMcpExternalTransport;
    private redactMcpExternalHeaders;
    listExternalMcpTools(body: any): Promise<{
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
    private getTextFromMcpContent;
    private getMcpResultOutputCandidate;
    private runExternalMcpComponent;
    private buildMcpApiRequest;
    private parseMcpApiJsonValue;
    private buildMcpApiRequestFromConfig;
    private normalizeMcpApiRequestConfigs;
    private createMcpApiProgress;
    private extractMcpApiOutputWithoutLlm;
    private runMcpMultiApiRequests;
    private runMcpComponent;
    private normalizeGeneratedAction;
    private normalizeGeneratedRichContent;
    private formatAppointmentFlowDataWithLlm;
    private generateRichMessageContent;
    private generateMessageTextWithLlm;
    private onlyDigits;
    private isValidCpf;
    private isValidCnpj;
    private validateTypedInput;
    private validateRegexInput;
    private validateInputWithLlm;
    private validateInputValue;
    private normalizeGeneratedApiRequests;
    private generateApiRequestsWithLlm;
    private normalizeWhatsappButtons;
    private buildWhatsappTextPayload;
    private buildWhatsappImagePayload;
    private buildWhatsappDocumentPayload;
    private buildWhatsappButtonPayload;
    private buildWhatsappListPayload;
    private parsePossibleJsonValue;
    private normalizeAppointmentStage;
    private appointmentStageTitle;
    private normalizeAppointmentOptions;
    private filterAppointmentOptions;
    private defaultAppointmentActions;
    private buildAppointmentFlowData;
    private buildWhatsappAppointmentListPayload;
    private compactMetaFlowOptions;
    private firstMetaOptionId;
    private buildMetaAppointmentFlowData;
    private buildWhatsappAppointmentFlowPayload;
    private buildWhatsappPayloads;
    private evaluateCondition;
    private evaluateConditionResult;
    private buildConditionSlotPreview;
    private extractConditionSlotReferences;
    private buildConditionMissingSlotReferences;
    private readBooleanDecision;
    private evaluateLlmCondition;
    private getOutgoing;
    private getOutgoingAsync;
    private createSnapshot;
    private cloneJson;
    private cloneJsonSafe;
    private stripAgentRuntimeSlots;
    private safeJsonStringify;
    private getErrorMessage;
    private getCronTimezone;
    private getTimeZoneParts;
    private getTimeZoneOffsetMs;
    private zonedTimeToUtc;
    private parseCronDate;
    private parseCronTime;
    private getLocalDateParts;
    private atCronTime;
    private addCronDays;
    private addCronMonths;
    private computeNextCronRun;
    private cronSummary;
    private appendCronExecutionLog;
    private outgoingTargets;
    private isDescendantOfGroup;
    private getDirectChildren;
    private sortStepsByCanvasPosition;
    private sortStepsByVerticalFlow;
    private sortStepIdsByExecutionOrder;
    private flushDeferredMessages;
    private isCostlyOrSideEffectStep;
    private isUserInteractionWaitStep;
    private emitUserInteractionWaitPrompt;
    private shouldQueueRuntimeTarget;
    private resolveStartStepIds;
    private getGroupEntryTargets;
    private getGroupExitTargets;
    private hasWhatsappRuntimeOverride;
    private mergeWhatsappFallback;
    private mergeAgentRuntimeConfig;
    private resolveRuntimeFlowConfig;
    private normalizeWhatsappProvider;
    private normalizeWhatsappDeliveryMode;
    private hasSinchRelayCredentials;
    private hasSinchConversationCredentials;
    private normalizeSinchApiMode;
    private normalizeGraphApiVersion;
    private resolveWhatsappFlowCredentials;
    private buildWhatsappFlowOptionSchema;
    private identifierNumberWord;
    private normalizeAttachmentStepId;
    private attachmentStepKey;
    private normalizeAppointmentAttachmentSteps;
    private normalizeAppointmentFlowStepOrder;
    private appointmentFlowConfiguredLabel;
    private appointmentFlowScreenId;
    private appointmentFlowScreenTitle;
    private appointmentFlowComponentForStep;
    private appointmentFlowDataSchema;
    private appointmentFlowPayloadForStep;
    private buildOrderedAppointmentWhatsappFlowJson;
    private buildAppointmentWhatsappFlowJson;
    private sanitizeWhatsappFlowJsonForMeta;
    private metaJsonRequest;
    private createMetaWhatsappFlow;
    listWhatsappFlows(body: any): Promise<{
        success: boolean;
        flows: any;
        paging: any;
        businessAccountId: string;
        graphApiVersion: string;
    }>;
    deleteWhatsappFlow(body: any): Promise<{
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
    uploadWhatsappFlowJson(body: any): Promise<{
        success: boolean;
        flowId: string;
        data: any;
        validationErrors: any;
        flowJson: any;
    }>;
    publishWhatsappFlow(body: any): Promise<{
        success: boolean;
        flowId: string;
        data: any;
    }>;
    createWhatsappFlow(body: any): Promise<{
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
    private sanitizeMcpToolName;
    private mcpToolNameForFlow;
    private mcpInputSchemaForFlow;
    listMcpTools(agentId: string, organizationId?: string): Promise<{
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
    }[]>;
    callMcpTool(agentId: string, toolName: string, args?: any, organizationId?: string, oauthUserId?: string): Promise<{
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
    }>;
    handleMcpJsonRpc(agentId: string, body: any, organizationId?: string, oauthUserId?: string): Promise<{
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
    private parseSimulationCases;
    private resolvePathValue;
    private evaluateSimulationCase;
    replaySimulation(body: any): Promise<{
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
    getTagDashboard(body: any): Promise<{
        history: (mongoose.FlattenMaps<import("../memory/memory-schema").MemoryTurnEntity> & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        })[] | (mongoose.FlattenMaps<import("../memory/memory-history-schema").MemoryHistoryEntity> & Required<{
            _id: mongoose.Types.ObjectId;
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
        events: (mongoose.FlattenMaps<import("../flow-tag/flow-tag-schema").FlowTagEventEntity> & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        })[];
        conversationIds: any;
    }>;
    private summarizeFlowCapabilities;
    getAgentOpsDashboard(body: any): Promise<{
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
        history: (mongoose.FlattenMaps<import("../memory/memory-schema").MemoryTurnEntity> & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        })[] | (mongoose.FlattenMaps<import("../memory/memory-history-schema").MemoryHistoryEntity> & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        })[];
        generatedAt: string;
    }>;
    private incrementMetric;
    private traceErrorMessage;
    private compactTraceForHistory;
    private buildTraceDashboardFromHistory;
    private extractMessageTextFromObject;
    private getAppointmentAttachmentFields;
    private resolveMetaMediaUrl;
    private withWhatsappMediaProxy;
    private normalizeFlowAttachmentFiles;
    private enrichFlowReplyDataWithAttachmentUrls;
    private extractFlowReplyData;
    private extractMetaWhatsappMessageText;
    private normalizeWhatsappPhone;
    private inferWhatsappHistoryRole;
    private extractMetaWhatsappMessages;
    private extractBlipWhatsappMessages;
    private extractSinchWhatsappMessages;
    private extractWhatsappMessages;
    private pushMetaWhatsappSyncMessage;
    private getMetaWhatsappMessageArray;
    private extractMetaWhatsappHistoryEvents;
    private extractMetaWhatsappSyncEvents;
    private extractWhatsappSyncEvents;
    private buildWhatsappSyncDedupeKey;
    private persistWhatsappSyncEvents;
    private getAssistantText;
    private whatsappDeliveryKey;
    private buildWhatsappDedupeKey;
    private getCanvasFlowState;
    private compactSlotsForState;
    private saveCanvasFlowState;
    private postWhatsappPayload;
    private flowInteractiveToListInteractive;
    private metaPayloadToText;
    private buildBlipPayload;
    private postBlipPayload;
    private buildSinchRelayMessage;
    private getSinchRelayApiUrl;
    private buildSinchRelayPayload;
    private buildSinchConversationBody;
    private buildSinchConversationPayload;
    private buildSinchPayload;
    private postSinchPayload;
    private buildMetaApiPayload;
    private buildBlipApiPayload;
    private buildProviderApiPayload;
    private buildWhatsappApiResponsePayloads;
    private shouldSendWhatsappAssistantMessage;
    private sendWhatsappMessage;
    private recordStepTags;
    private normalizeApprovalText;
    private resolveApprovalDecision;
    private buildApprovalResult;
    private runApprovalComponent;
    private runStep;
    private getLangGraphRuntime;
    private snapshotLangGraphContext;
    private restoreLangGraphTrace;
    private langGraphRuntimeStatus;
    private advanceLangGraphRuntime;
    run(body: any): Promise<{
        messages: {
            role: string;
            text: string;
        }[];
        slots: any;
        trace: any[];
        tracePage: {
            mode: TraceMode;
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
        messages: FlowMessage[];
        slots: any;
        currentStepId: string;
        ended: boolean;
        conversationId: any;
        entryFlowId: any;
        activeFlowId: any;
        activeFlowName: any;
        trace: any[];
        tracePage: {
            mode: TraceMode;
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
    runDueCronFlows(options?: {
        agentId?: string;
        dryRun?: boolean;
        suppressConnectionErrors?: boolean;
    }): Promise<{
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
    verifyWhatsappWebhook(flowId: string, mode: string, verifyToken: string, challenge: string): Promise<string>;
    verifyWhatsappMainWebhook(agentId: string, mode: string, verifyToken: string, challenge: string): Promise<string>;
    runWhatsappWebhook(flowId: string, payload: any): Promise<{
        ok: boolean;
        received: number;
        synced: number;
        syncResults: any[];
        ignored: boolean;
        results?: undefined;
    } | {
        ok: boolean;
        received: any;
        synced: number;
        syncResults: any[];
        results: any[];
        ignored?: undefined;
    }>;
    runWhatsappMainWebhook(agentId: string, payload: any): Promise<{
        ok: boolean;
        received: number;
        synced: number;
        syncResults: any[];
        ignored: boolean;
        results?: undefined;
    } | {
        ok: boolean;
        received: any;
        synced: number;
        syncResults: any[];
        results: any[];
        ignored?: undefined;
    }>;
}
export {};
