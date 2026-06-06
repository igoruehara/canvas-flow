import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth-module';
import { ApiKeyController } from './api-key-controller';
import { ApiKeyService } from './api-key-service';
import { connectProviders } from './api-key-connect-provider';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ...connectProviders],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
