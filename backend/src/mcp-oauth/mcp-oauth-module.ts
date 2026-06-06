import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth-module';
import { DatabaseModule } from '../database/database.module';
import { connectProviders } from './mcp-oauth-connect-provider';
import { McpOAuthController } from './mcp-oauth-controller';
import { McpOAuthService } from './mcp-oauth-service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [McpOAuthController],
  providers: [McpOAuthService, ...connectProviders],
  exports: [McpOAuthService],
})
export class McpOAuthModule {}
