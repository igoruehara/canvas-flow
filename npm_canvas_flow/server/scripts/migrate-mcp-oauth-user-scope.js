"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const mongoose = require("mongoose");
const mcp_oauth_constants_model_1 = require("../mcp-oauth/mcp-oauth-constants-model");
let McpOAuthUserScopeMigrationModule = class McpOAuthUserScopeMigrationModule {
};
McpOAuthUserScopeMigrationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env', 'backend/.env'],
            }),
        ],
    })
], McpOAuthUserScopeMigrationModule);
function hasFlag(name) {
    return process.argv.includes(name);
}
function isLegacyUniqueIndex(index) {
    const keys = index?.key || {};
    return index?.unique === true
        && Object.keys(keys).length === 3
        && keys.organizationId === 1
        && keys.agentId === 1
        && keys.serverUrlHash === 1;
}
async function main() {
    const dryRun = hasFlag('--dry-run');
    const app = await core_1.NestFactory.createApplicationContext(McpOAuthUserScopeMigrationModule, {
        logger: ['log', 'warn', 'error'],
    });
    try {
        const config = app.get(config_1.ConfigService);
        const uri = String(config.get('MONGO_DB_CONNECTION_STRING') || '').trim();
        if (!uri)
            throw new Error('MONGO_DB_CONNECTION_STRING nao configurada.');
        await mongoose.connect(uri);
        const collectionExists = await mongoose.connection.db
            ?.listCollections({ name: mcp_oauth_constants_model_1.COLLECTION_NAME }, { nameOnly: true })
            .hasNext();
        if (!collectionExists) {
            console.log(JSON.stringify({
                dryRun,
                collection: mcp_oauth_constants_model_1.COLLECTION_NAME,
                collectionExists: false,
                message: 'Colecao ainda nao existe; nenhuma migracao necessaria.',
            }, null, 2));
            return;
        }
        const collection = mongoose.connection.collection(mcp_oauth_constants_model_1.COLLECTION_NAME);
        const indexes = await collection.indexes();
        const legacyIndexes = indexes.filter(isLegacyUniqueIndex);
        const legacyRows = await collection.countDocuments({ connectionScope: { $exists: false } });
        const summary = {
            dryRun,
            collection: mcp_oauth_constants_model_1.COLLECTION_NAME,
            legacyIndexes: legacyIndexes.map((index) => index.name),
            legacyRows,
            droppedIndexes: [],
            backfilledRows: 0,
            lookupIndex: 'mcp_oauth_scope_lookup',
        };
        if (!dryRun) {
            for (const index of legacyIndexes) {
                if (!index.name)
                    continue;
                await collection.dropIndex(index.name);
                summary.droppedIndexes.push(index.name);
            }
            const backfill = await collection.updateMany({ connectionScope: { $exists: false } }, { $set: { connectionScope: 'agent' } });
            summary.backfilledRows = backfill.modifiedCount;
            await collection.createIndex({ organizationId: 1, agentId: 1, connectionScope: 1, oauthUserId: 1, serverUrlHash: 1 }, { name: 'mcp_oauth_scope_lookup' });
        }
        console.log(JSON.stringify(summary, null, 2));
    }
    finally {
        await mongoose.disconnect().catch(() => undefined);
        await app.close();
    }
}
void main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
});
//# sourceMappingURL=migrate-mcp-oauth-user-scope.js.map