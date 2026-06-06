import { Response } from 'express';
import { AuthService } from '../auth/auth-service';
import { DocumentsService } from './documents-service';
export declare class DocumentsController {
    private readonly service;
    private readonly authService;
    constructor(service: DocumentsService, authService: AuthService);
    private actorScope;
    list(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        documents: any[];
        total: number;
    }>;
    generate(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    downloadUrl(documentId: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    download(documentId: string, response: Response, authorization?: string, headerToken?: string, xApiKey?: string): Promise<void>;
}
