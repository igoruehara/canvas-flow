import { Body, Controller, Delete, Get, Headers, Param, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth-service';
import { ProviderConfigService } from './provider-config-service';

@ApiTags('provider-config')
@Controller('api/provider-config')
export class ProviderConfigController {
  constructor(
    private readonly service: ProviderConfigService,
    private readonly authService: AuthService,
  ) {}

  private async assertAuth(authorization?: string, headerToken?: string, xApiKey?: string) {
    return await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
  }

  @Get()
  async getConfig(
    @Query('agentId') agentId?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.getSafeSettings(agentId);
  }

  @Put()
  async updateConfig(
    @Body() body: any,
    @Query('agentId') agentId?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.updateSettings(body?.settings || body || {}, user?.id, body?.agentId || agentId);
  }

  @Delete(':section')
  async clearConfigSection(
    @Param('section') section: string,
    @Query('agentId') agentId?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.clearSection(section, user?.id, agentId);
  }
}
