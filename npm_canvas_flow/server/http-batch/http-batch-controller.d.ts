import { HttpBatchService } from './http-batch-service';
export declare class HttpBatchController {
    private readonly service;
    constructor(service: HttpBatchService);
    execute(body: any): Promise<{
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
