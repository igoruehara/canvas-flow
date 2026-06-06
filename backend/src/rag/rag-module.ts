import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth-module';
import { HttpBatchModule } from '../http-batch/http-batch-module';
import { MemoryModule } from '../memory/memory-module';
import { ProviderConfigModule } from '../provider-config/provider-config-module';
import { DocumentsModule } from '../documents/documents-module';
import { RagController } from './rag-controller';
import { RagService } from './rag-service';

@Module({
  imports: [ConfigModule, MemoryModule, HttpBatchModule, AuthModule, ProviderConfigModule, DocumentsModule],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
