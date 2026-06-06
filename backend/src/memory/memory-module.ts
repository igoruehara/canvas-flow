import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MemoryController } from './memory-controller';
import { MemoryService } from './memory-service';
import { connectProviders } from './memory-connect-provider';

@Module({
  imports: [DatabaseModule],
  controllers: [MemoryController],
  providers: [MemoryService, ...connectProviders],
  exports: [MemoryService],
})
export class MemoryModule {}
