import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth-service';
import { CanvasFlowService } from './canvas-flow-service';
import { CreateCanvasFlowDto } from './dto/create-canvas-flow.dto';
import { UpdateCanvasFlowDto } from './dto/update-canvas-flow.dto';

@ApiTags('canvas-flow')
@Controller('api/canvas-flows')
export class CanvasFlowController {
  constructor(
    private readonly service: CanvasFlowService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async create(
    @Body() createDto: CreateCanvasFlowDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.create(createDto, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
  }

  @Get()
  async findAll(
    @Query('agentId') agentId?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.findAll(agentId, user?.organizationId);
  }

  @Get('agents')
  async listAgents(
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.listAgents(user?.organizationId);
  }

  @Post('agents')
  async createAgent(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.createAgent(body?.name, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
  }

  @Patch('agents/reorder')
  async reorderAgents(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    const orderedAgentIds = Array.isArray(body?.orderedAgentIds)
      ? body.orderedAgentIds.map((id: unknown) => String(id))
      : Array.isArray(body?.orderedNames)
        ? body.orderedNames.map((name: unknown) => String(name))
        : [];
    return await this.service.reorderAgents(orderedAgentIds, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
  }

  @Patch('agents/:name/config')
  async updateAgentConfig(
    @Param('name') name: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.updateAgentConfig(name, body?.config || body || {}, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
  }

  @Get('agents/:name/workspace')
  async exportAgentWorkspace(
    @Param('name') name: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.exportAgentWorkspace(name, user?.organizationId);
  }

  @Put('agents/:name/workspace')
  async importAgentWorkspace(
    @Param('name') name: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.importAgentWorkspace(name, body, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
  }

  @Patch('agents/:name')
  async renameAgent(
    @Param('name') name: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.renameAgent(name, body?.name, user ? { organizationId: user.organizationId } : undefined);
  }

  @Delete('agents/:name')
  async removeAgent(
    @Param('name') name: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.removeAgent(name, body?.confirmationName, user ? { organizationId: user.organizationId } : undefined);
  }

  @Get('agents/:name/releases')
  async getAgentReleases(
    @Param('name') name: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.getAgentReleases(name, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
  }

  @Post('agents/:name/releases/deploy')
  async deployAgentRelease(
    @Param('name') name: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.deployAgentRelease(name, body, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
  }

  @Patch('agents/:name/releases/:release/activate')
  async activateAgentRelease(
    @Param('name') name: string,
    @Param('release') release: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.activateAgentRelease(name, release, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
  }

  @Patch('agents/:name/releases/:release')
  async renameAgentRelease(
    @Param('name') name: string,
    @Param('release') release: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.renameAgentRelease(name, release, body, user ? { organizationId: user.organizationId } : undefined);
  }

  @Patch('agents/:name/releases/:release/overwrite')
  async overwriteAgentRelease(
    @Param('name') name: string,
    @Param('release') release: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.overwriteAgentRelease(name, release, body, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
  }

  @Delete('agents/:name/releases/:release')
  async deleteAgentRelease(
    @Param('name') name: string,
    @Param('release') release: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.deleteAgentRelease(name, release, user ? { organizationId: user.organizationId } : undefined);
  }

  @Get(':id/versions')
  async getVersions(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.getVersions(id, user ? { organizationId: user.organizationId } : undefined);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.findOne(id, user?.organizationId);
  }

  @Post(':id/versions/deploy')
  async deployVersion(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.deployVersion(id, body, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
  }

  @Patch(':id/versions/:version/activate')
  async activateVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.activateVersion(id, version, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
  }

  @Patch(':id/versions/:version')
  async renameVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.renameVersion(id, version, body, user ? { organizationId: user.organizationId } : undefined);
  }

  @Patch(':id/versions/:version/overwrite')
  async overwriteVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.overwriteVersion(id, version, body, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
  }

  @Delete(':id/versions/:version')
  async deleteVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.deleteVersion(id, version, user ? { organizationId: user.organizationId } : undefined);
  }

  @Patch('reorder')
  async reorder(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds.map((id: unknown) => String(id)) : [];
    return await this.service.reorder(orderedIds, body?.agentId, user?.organizationId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCanvasFlowDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.update(id, updateDto, user ? { organizationId: user.organizationId } : undefined);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.remove(id, user?.organizationId);
  }
}
