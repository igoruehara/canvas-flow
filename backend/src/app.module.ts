import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { CanvasFlowModule } from './canvas-flow/canvas-flow-module';
import { MemoryModule } from './memory/memory-module';
import { RagModule } from './rag/rag-module';
import { HttpBatchModule } from './http-batch/http-batch-module';
import { RunnerModule } from './runner/runner-module';
import { ApiKeyModule } from './api-key/api-key-module';
import { AuthModule } from './auth/auth-module';
import { ProviderConfigModule } from './provider-config/provider-config-module';
import { FlowTagModule } from './flow-tag/flow-tag-module';
import { McpOAuthModule } from './mcp-oauth/mcp-oauth-module';
import { DocumentsModule } from './documents/documents-module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule,
    DatabaseModule,
    CanvasFlowModule,
    MemoryModule,
    HttpBatchModule,
    AuthModule,
    ProviderConfigModule,
    McpOAuthModule,
    DocumentsModule,
    FlowTagModule,
    RagModule,
    ApiKeyModule,
    RunnerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
