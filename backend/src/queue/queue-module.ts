import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SqsTransitionService } from './sqs-transition-service';
import { connectProviders } from './queue-job-connect-provider';
import { lockConnectProviders } from './queue-lock-connect-provider';
import { rateLimitConnectProviders } from './queue-rate-limit-connect-provider';
import { messageDedupeConnectProviders } from './queue-message-dedupe-connect-provider';

@Module({
  imports: [DatabaseModule],
  providers: [
    SqsTransitionService,
    ...connectProviders,
    ...lockConnectProviders,
    ...rateLimitConnectProviders,
    ...messageDedupeConnectProviders,
  ],
  exports: [SqsTransitionService],
})
export class QueueModule {}
