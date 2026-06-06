import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemoryService } from './memory-service';

@ApiTags('memory')
@Controller('api/memory')
export class MemoryController {
  constructor(private readonly service: MemoryService) {}

  @Get(':conversationId')
  async findRecent(
    @Param('conversationId') conversationId: string,
    @Query('agentId') agentId?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.service.findRecent(agentId, conversationId, Number(limit || 50));
  }

  @Delete(':conversationId')
  async clear(@Param('conversationId') conversationId: string, @Query('agentId') agentId?: string) {
    return await this.service.clearConversation(agentId, conversationId);
  }
}
