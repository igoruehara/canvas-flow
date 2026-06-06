import { Body, Controller, Get, Headers, Post, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth-service';
import { RagService } from './rag-service';

@ApiTags('rag')
@Controller('api/rag')
export class RagController {
  constructor(
    private readonly service: RagService,
    private readonly authService: AuthService,
  ) {}

  private async assertAuth(authorization?: string, headerToken?: string, xApiKey?: string) {
    return await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
  }

  @Post('create-collection')
  async createCollection(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.createCollection(body?.collectionName);
  }

  @Post('create-index')
  async createIndex(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.createIndex(body?.collectionName);
  }

  @Post('add-documents')
  async addDocuments(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.addDocuments(body?.collectionName, body?.documents || [], body?.options || {});
  }

  @Post('add-documents-from-file')
  @UseInterceptors(FilesInterceptor('arquivos', 8, { limits: { fileSize: 30 * 1024 * 1024 } }))
  async addDocumentsFromFile(@UploadedFiles() arquivos: any[], @Req() req: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.addDocumentsFromFiles(arquivos || [], req.body || {});
  }

  @Post('extract-files')
  @UseInterceptors(FilesInterceptor('arquivos', 8, { limits: { fileSize: 30 * 1024 * 1024 } }))
  async extractFiles(@UploadedFiles() arquivos: any[], @Req() req: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    const actor = await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.extractFiles(arquivos || [], {
      ...(req.body || {}),
      organizationId: actor?.organizationId || req.body?.organizationId || '',
    });
  }

  @Post('documents/list')
  async listDocuments(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.listDocuments(body?.collectionName, body?.agentId, body?.query, body || {});
  }

  @Post('documents/get')
  async getDocument(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.getDocument(body?.collectionName, body?.id || body?.embeddingId, body?.agentId);
  }

  @Post('documents/update')
  async updateDocument(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.updateDocument(body?.collectionName, body?.id || body?.embeddingId, body || {});
  }

  @Post('documents/delete')
  async deleteDocument(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.deleteDocument(body?.collectionName, body?.id || body?.embeddingId, body?.agentId);
  }

  @Post('embedding-create')
  async embeddingCreate(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.embeddingCreate(body?.text || '', body?.embeddingProvider || body?.provider);
  }

  @Post('search-hybrid')
  async searchHybrid(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.searchHybrid(body?.query, body?.collectionName, body?.agentId, body?.params || {});
  }

  @Post('chat-llm-rag')
  async chatLlmRag(@Body() body: any, @Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    const params = {
      ...(body?.params || {}),
      ...(body?.turnHistoricMessages !== undefined ? { turnHistoricMessages: body.turnHistoricMessages } : {}),
      ...(body?.tools !== undefined ? { tools: body.tools } : {}),
      ...(body?.allowHttpBatchTool !== undefined ? { allowHttpBatchTool: body.allowHttpBatchTool === true } : {}),
      ...(body?.enableHttpBatchTool !== undefined ? { enableHttpBatchTool: body.enableHttpBatchTool === true } : {}),
    };
    return await this.service.chatLlmRag(body?.text, body?.agentId, params);
  }

  @Get('collections')
  async listCollections(@Headers('authorization') authorization?: string, @Headers('x-canvas-flow-token') headerToken?: string, @Headers('x-api-key') xApiKey?: string) {
    await this.assertAuth(authorization, headerToken, xApiKey);
    return await this.service.listCollections();
  }
}
