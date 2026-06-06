import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth-module';
import { CanvasFlowController } from './canvas-flow-controller';
import { CanvasFlowService } from './canvas-flow-service';
import { connectProviders } from './canvas-flow-connect-provider';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CanvasFlowController],
  providers: [CanvasFlowService, ...connectProviders],
  exports: [CanvasFlowService],
})
export class CanvasFlowModule {}
