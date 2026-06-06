import { AuthService } from '../auth/auth-service';
import { RagService } from './rag-service';
export declare class RagController {
    private readonly service;
    private readonly authService;
    constructor(service: RagService, authService: AuthService);
    private assertAuth;
    createCollection(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<import("@zilliz/milvus2-sdk-node").ResStatus>;
    createIndex(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        collectionName: string;
        dense: any;
        sparse: any;
        azureSearch: any;
    }>;
    addDocuments(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        success: boolean;
        inserted: number;
        totalChunks: number;
        batches: number;
        message: string;
        response?: undefined;
        responses?: undefined;
        azureSearch?: undefined;
        azureBlobs?: undefined;
    } | {
        success: boolean;
        inserted: number;
        totalChunks: number;
        batches: number;
        response: any;
        responses: any[];
        azureSearch: {
            indexed: number;
            batches: number;
            vectorField: string;
            textFields: string[];
            expectedDimensions: number;
            responses: any[];
        };
        azureBlobs: number;
        message: string;
    }>;
    addDocumentsFromFile(arquivos: any[], req: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        collectionName: any;
        files: any[];
        documents: number;
        success: boolean;
        inserted: number;
        totalChunks: number;
        batches: number;
        message: string;
        response?: undefined;
        responses?: undefined;
        azureSearch?: undefined;
        azureBlobs?: undefined;
    } | {
        collectionName: any;
        files: any[];
        documents: number;
        success: boolean;
        inserted: number;
        totalChunks: number;
        batches: number;
        response: any;
        responses: any[];
        azureSearch: {
            indexed: number;
            batches: number;
            vectorField: string;
            textFields: string[];
            expectedDimensions: number;
            responses: any[];
        };
        azureBlobs: number;
        message: string;
    }>;
    extractFiles(arquivos: any[], req: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        files: any[];
        documents: number;
    }>;
    listDocuments(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        collectionName: string;
        total: number;
        documents: {
            id: any;
            embeddingId: any;
            embeddingName: any;
            agentId: any;
            extraFields: {
                [x: string]: any;
            };
            chunksCount: number;
            ids: any[];
            text: any;
            textLength: any;
            textPreview: any;
        }[];
    }>;
    getDocument(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        collectionName: string;
        document: {
            id: any;
            embeddingId: any;
            embeddingName: any;
            agentId: any;
            extraFields: {
                [x: string]: any;
            };
            chunksCount: number;
            ids: any[];
            text: any;
            textLength: any;
            textPreview: any;
        };
    }>;
    updateDocument(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        success: boolean;
        inserted: number;
        totalChunks: number;
        batches: number;
        message: string;
        response?: undefined;
        responses?: undefined;
        azureSearch?: undefined;
        azureBlobs?: undefined;
        collectionName: string;
        embeddingId: any;
        updated: boolean;
    } | {
        success: boolean;
        inserted: number;
        totalChunks: number;
        batches: number;
        response: any;
        responses: any[];
        azureSearch: {
            indexed: number;
            batches: number;
            vectorField: string;
            textFields: string[];
            expectedDimensions: number;
            responses: any[];
        };
        azureBlobs: number;
        message: string;
        collectionName: string;
        embeddingId: any;
        updated: boolean;
    }>;
    deleteDocument(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        collectionName: string;
        deleted: boolean;
        filter: string;
        response: import("@zilliz/milvus2-sdk-node").MutationResult;
    }>;
    embeddingCreate(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    searchHybrid(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    chatLlmRag(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        text: any;
        conversationId: any;
        docs: any;
        searchDebug: any;
        trace: any[];
        model: string;
    }>;
    listCollections(authorization?: string, headerToken?: string, xApiKey?: string): Promise<import("@zilliz/milvus2-sdk-node").CollectionData[]>;
}
