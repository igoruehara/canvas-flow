import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth-controller';
import { AuthService } from './auth-service';
import { connectProviders } from './auth-connect-provider';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, ...connectProviders],
  exports: [AuthService],
})
export class AuthModule {}
