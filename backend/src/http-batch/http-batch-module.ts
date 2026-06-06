import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpBatchController } from './http-batch-controller';
import { HttpBatchService } from './http-batch-service';

@Module({
  imports: [ConfigModule],
  controllers: [HttpBatchController],
  providers: [HttpBatchService],
  exports: [HttpBatchService],
})
export class HttpBatchModule {}
