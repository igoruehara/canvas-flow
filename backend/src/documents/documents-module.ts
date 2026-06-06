import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth-module';
import { DatabaseModule } from '../database/database.module';
import { connectProviders } from './documents-connect-provider';
import { DocumentsController } from './documents-controller';
import { DocumentsService } from './documents-service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, ...connectProviders],
  exports: [DocumentsService],
})
export class DocumentsModule {}
