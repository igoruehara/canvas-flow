import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FlowTagService } from './flow-tag-service';
import { connectProviders } from './flow-tag-connect-provider';

@Module({
  imports: [DatabaseModule],
  providers: [FlowTagService, ...connectProviders],
  exports: [FlowTagService],
})
export class FlowTagModule {}
