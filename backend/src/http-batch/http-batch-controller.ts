import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HttpBatchService } from './http-batch-service';

@ApiTags('http-batch')
@Controller('api/http-batch')
export class HttpBatchController {
  constructor(private readonly service: HttpBatchService) {}

  @Post()
  async execute(@Body() body: any) {
    return await this.service.execute(body?.requests || []);
  }
}
