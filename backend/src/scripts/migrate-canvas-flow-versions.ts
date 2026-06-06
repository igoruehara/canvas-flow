import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as mongoose from 'mongoose';
import { CanvasFlowModule } from '../canvas-flow/canvas-flow-module';
import { CanvasFlowService } from '../canvas-flow/canvas-flow-service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'backend/.env'],
    }),
    CanvasFlowModule,
  ],
})
class CanvasFlowVersionMigrationModule {}

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function positiveInt(value: string | undefined): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

async function main() {
  const dryRun = hasFlag('--dry-run');
  const app = await NestFactory.createApplicationContext(CanvasFlowVersionMigrationModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const service = app.get(CanvasFlowService);
    const summary = await service.migrateEmbeddedFlowVersions({
      dryRun,
      keepLegacy: dryRun || hasFlag('--keep-legacy'),
      organizationId: argValue('--organization-id'),
      limit: positiveInt(argValue('--limit')),
    });
    console.log(JSON.stringify(summary, null, 2));
    if (summary.failedFlows > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
    await mongoose.disconnect().catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
