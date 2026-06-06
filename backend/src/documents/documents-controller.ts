import { Body, Controller, Get, Headers, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from '../auth/auth-service';
import { CanvasArtifactFormat, DocumentsService } from './documents-service';

@ApiTags('documents')
@Controller('api/documents')
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly authService: AuthService,
  ) {}

  private async actorScope(authorization?: string, headerToken?: string, xApiKey?: string) {
    const actor = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    return { organizationId: actor?.organizationId || '' };
  }

  @Post('list')
  async list(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const actor = await this.actorScope(authorization, headerToken, xApiKey);
    return await this.service.list({
      ...actor,
      agentId: body?.agentId,
      flowId: body?.flowId,
      conversationId: body?.conversationId,
    }, body?.limit);
  }

  @Post('generate')
  async generate(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const actor = await this.actorScope(authorization, headerToken, xApiKey);
    return await this.service.createArtifact({
      format: String(body?.format || 'txt').toLowerCase() as CanvasArtifactFormat,
      filename: body?.filename,
      content: body?.content,
      replacements: body?.replacements,
      templateDocumentId: body?.templateDocumentId,
      docxEdits: body?.docxEdits,
      xlsxEdits: body?.xlsxEdits,
      parentDocumentId: body?.parentDocumentId,
      scope: {
        ...actor,
        agentId: body?.agentId,
        flowId: body?.flowId,
        conversationId: body?.conversationId,
      },
    });
  }

  @Get(':documentId/download-url')
  async downloadUrl(
    @Param('documentId') documentId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    return await this.service.getDownloadInfo(documentId, await this.actorScope(authorization, headerToken, xApiKey));
  }

  @Get(':documentId/download')
  async download(
    @Param('documentId') documentId: string,
    @Res() response: Response,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const scope = await this.actorScope(authorization, headerToken, xApiKey);
    const { record, buffer } = await this.service.getFile(documentId, scope);
    response.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    response.setHeader('Content-Length', String(buffer.length));
    response.setHeader('Content-Disposition', `attachment; filename="${String(record.filename || 'arquivo.bin').replace(/"/g, '')}"`);
    response.send(buffer);
  }
}
