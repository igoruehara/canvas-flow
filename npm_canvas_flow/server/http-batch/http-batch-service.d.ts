import { ConfigService } from '@nestjs/config';
export interface HttpBatchRequest {
    url: string;
    method?: string;
    headers?: Record<string, any>;
    params?: Record<string, any>;
    bodyType?: string;
    body?: any;
    data?: any;
    polling?: {
        enabled?: boolean;
        url?: string;
        method?: string;
        headers?: Record<string, any>;
        params?: Record<string, any>;
        bodyType?: string;
        body?: any;
        data?: any;
        intervalSeconds?: number;
        maxAttempts?: number;
        stopPath?: string;
        resultPath?: string;
        stopCondition?: string;
    };
}
export declare class HttpBatchService {
    private readonly configService;
    constructor(configService: ConfigService);
    private redactHeaders;
    private sleep;
    private limitNumber;
    private getByPath;
    private hasValue;
    private renderTemplate;
    private getRequestData;
    private executeOne;
    private checkPollingStop;
    private buildPollingRequest;
    private summarizePollingResult;
    private executeWithPolling;
    execute(requests: HttpBatchRequest[], context?: any): Promise<{
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
    }>;
}
