import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth-module';
import { DatabaseModule } from '../database/database.module';
import { ProviderConfigController } from './provider-config-controller';
import { ProviderConfigService } from './provider-config-service';
import { connectProviders } from './provider-config-connect-provider';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ProviderConfigController],
  providers: [ProviderConfigService, ...connectProviders],
  exports: [ProviderConfigService],
})
export class ProviderConfigModule {}
