import { MemoryService } from './memory-service';
export declare class MemoryController {
    private readonly service;
    constructor(service: MemoryService);
    findRecent(conversationId: string, agentId?: string, limit?: string): Promise<(import("mongoose").FlattenMaps<import("./memory-schema").MemoryTurnEntity> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    clear(conversationId: string, agentId?: string): Promise<import("mongodb").DeleteResult | {
        acknowledged: boolean;
        deletedCount: number;
        error: string;
    }>;
}
