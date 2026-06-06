import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCanvasFlowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsOptional()
  versions?: Array<Record<string, any>>;

  @IsNumber()
  @IsOptional()
  latestVersion?: number;

  @IsNumber()
  @IsOptional()
  activeVersion?: number;

  @IsString()
  @IsOptional()
  createdBy?: string;
}
