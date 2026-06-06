export declare class UpdateCanvasFlowDto {
    name?: string;
    agentId?: string;
    description?: string;
    sortOrder?: number;
    config?: Record<string, any>;
    versions?: Array<Record<string, any>>;
    latestVersion?: number;
    activeVersion?: number;
}
