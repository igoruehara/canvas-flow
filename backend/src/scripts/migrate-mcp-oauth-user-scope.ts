import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as mongoose from 'mongoose';
import { COLLECTION_NAME } from '../mcp-oauth/mcp-oauth-constants-model';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'backend/.env'],
    }),
  ],
})
class McpOAuthUserScopeMigrationModule {}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function isLegacyUniqueIndex(index: any) {
  const keys = index?.key || {};
  return index?.unique === true
    && Object.keys(keys).length === 3
    && keys.organizationId === 1
    && keys.agentId === 1
    && keys.serverUrlHash === 1;
}

async function main() {
  const dryRun = hasFlag('--dry-run');
  const app = await NestFactory.createApplicationContext(McpOAuthUserScopeMigrationModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const config = app.get(ConfigService);
    const uri = String(config.get<string>('MONGO_DB_CONNECTION_STRING') || '').trim();
    if (!uri) throw new Error('MONGO_DB_CONNECTION_STRING nao configurada.');

    await mongoose.connect(uri);
    const collectionExists = await mongoose.connection.db
      ?.listCollections({ name: COLLECTION_NAME }, { nameOnly: true })
      .hasNext();
    if (!collectionExists) {
      console.log(JSON.stringify({
        dryRun,
        collection: COLLECTION_NAME,
        collectionExists: false,
        message: 'Colecao ainda nao existe; nenhuma migracao necessaria.',
      }, null, 2));
      return;
    }
    const collection = mongoose.connection.collection(COLLECTION_NAME);
    const indexes = await collection.indexes();
    const legacyIndexes = indexes.filter(isLegacyUniqueIndex);
    const legacyRows = await collection.countDocuments({ connectionScope: { $exists: false } });

    const summary: Record<string, any> = {
      dryRun,
      collection: COLLECTION_NAME,
      legacyIndexes: legacyIndexes.map((index) => index.name),
      legacyRows,
      droppedIndexes: [],
      backfilledRows: 0,
      lookupIndex: 'mcp_oauth_scope_lookup',
    };

    if (!dryRun) {
      for (const index of legacyIndexes) {
        if (!index.name) continue;
        await collection.dropIndex(index.name);
        summary.droppedIndexes.push(index.name);
      }
      const backfill = await collection.updateMany(
        { connectionScope: { $exists: false } },
        { $set: { connectionScope: 'agent' } },
      );
      summary.backfilledRows = backfill.modifiedCount;
      await collection.createIndex(
        { organizationId: 1, agentId: 1, connectionScope: 1, oauthUserId: 1, serverUrlHash: 1 },
        { name: 'mcp_oauth_scope_lookup' },
      );
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
