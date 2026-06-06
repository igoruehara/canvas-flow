import { Body, Controller, Delete, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService, CanvasFlowAuthUser } from '../auth/auth-service';
import { ApiKeyService } from './api-key-service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('canvas-flow-api-keys')
@Controller('api/canvas-flow-api-keys')
export class ApiKeyController {
  constructor(
    private readonly service: ApiKeyService,
    private readonly authService: AuthService,
  ) {}

  private async resolveManagementAccess(authorization?: string, headerToken?: string, xApiKey?: string): Promise<CanvasFlowAuthUser | null> {
    if (this.authService.isLoginRequired()) {
      const user = await this.authService.resolveUserFromHeaders(authorization, headerToken, xApiKey);
      if (user) return user;
    }
    this.service.assertMasterToken(authorization, headerToken, xApiKey);
    return null;
  }

  @Get()
  async list(
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
    @Query('flowId') flowId?: string,
    @Query('agentId') agentId?: string,
  ) {
    const user = await this.resolveManagementAccess(authorization, headerToken, xApiKey);
    return await this.service.list({ flowId, agentId, organizationId: user?.organizationId });
  }

  @Post()
  async create(
    @Body() createDto: CreateApiKeyDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.resolveManagementAccess(authorization, headerToken, xApiKey);
    return await this.service.create(createDto, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
  }

  @Delete(':id')
  async revoke(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.resolveManagementAccess(authorization, headerToken, xApiKey);
    return await this.service.revoke(id, user?.organizationId);
  }
}
