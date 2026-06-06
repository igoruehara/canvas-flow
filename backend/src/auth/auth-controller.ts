import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth-service';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get('config')
  async config() {
    return await this.service.getConfig();
  }

  @Post('bootstrap')
  async bootstrap(@Body() body: any) {
    return await this.service.bootstrap(body);
  }

  @Post('organizations')
  async createOrganization(@Body() body: any) {
    return await this.service.createOrganization(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    return await this.service.login(body);
  }

  @Get('me')
  async me(
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const user = await this.service.assertUiAuth(authorization, headerToken, xApiKey);
    return { user };
  }

  @Post('users')
  async createUser(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-canvas-flow-token') headerToken?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    const actor = await this.service.assertUiAuth(authorization, headerToken, xApiKey);
    return await this.service.createUser(body, actor!);
  }
}
