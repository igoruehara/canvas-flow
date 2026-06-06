import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAIRuntimeConfig } from '../provider-config/provider-config-service';
export declare function isAzureOpenAIEnabled(configService: ConfigService, runtime?: OpenAIRuntimeConfig): boolean;
export declare function createOpenAIClient(configService: ConfigService, runtime?: OpenAIRuntimeConfig): OpenAI;
export declare function getOpenAIChatModel(configService: ConfigService, model?: string, runtime?: OpenAIRuntimeConfig): string;
export declare function getOpenAIEmbeddingModel(configService: ConfigService, model?: string, runtime?: OpenAIRuntimeConfig): string;
export declare function getOpenAIOcrModel(configService: ConfigService, model?: string, runtime?: OpenAIRuntimeConfig): string;
