import { Module } from '@nestjs/common';
import { CanvasFlowModule } from '../canvas-flow/canvas-flow-module';
import { ApiKeyModule } from '../api-key/api-key-module';
import { HttpBatchModule } from '../http-batch/http-batch-module';
import { MemoryModule } from '../memory/memory-module';
import { RagModule } from '../rag/rag-module';
import { AuthModule } from '../auth/auth-module';
import { QueueModule } from '../queue/queue-module';
import { ProviderConfigModule } from '../provider-config/provider-config-module';
import { FlowTagModule } from '../flow-tag/flow-tag-module';
import { McpOAuthModule } from '../mcp-oauth/mcp-oauth-module';
import { LangGraphRuntimeService } from './langgraph-runtime.service';
import { DocumentsModule } from '../documents/documents-module';
import { RunnerController } from './runner-controller';
import { RunnerQueueProcessor } from './runner-queue-processor';
import { RunnerService } from './runner-service';

@Module({
  imports: [CanvasFlowModule, ApiKeyModule, HttpBatchModule, MemoryModule, RagModule, AuthModule, QueueModule, ProviderConfigModule, FlowTagModule, McpOAuthModule, DocumentsModule],
  controllers: [RunnerController],
  providers: [LangGraphRuntimeService, RunnerService, RunnerQueueProcessor],
  exports: [LangGraphRuntimeService, RunnerService, RunnerQueueProcessor],
})
export class RunnerModule {}
