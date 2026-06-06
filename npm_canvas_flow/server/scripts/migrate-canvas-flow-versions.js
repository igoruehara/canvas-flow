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
const canvas_flow_module_1 = require("../canvas-flow/canvas-flow-module");
const canvas_flow_service_1 = require("../canvas-flow/canvas-flow-service");
let CanvasFlowVersionMigrationModule = class CanvasFlowVersionMigrationModule {
};
CanvasFlowVersionMigrationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env', 'backend/.env'],
            }),
            canvas_flow_module_1.CanvasFlowModule,
        ],
    })
], CanvasFlowVersionMigrationModule);
function argValue(name) {
    const prefix = `${name}=`;
    const inline = process.argv.find((arg) => arg.startsWith(prefix));
    if (inline)
        return inline.slice(prefix.length);
    const index = process.argv.indexOf(name);
    if (index >= 0)
        return process.argv[index + 1];
    return undefined;
}
function hasFlag(name) {
    return process.argv.includes(name);
}
function positiveInt(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}
async function main() {
    const dryRun = hasFlag('--dry-run');
    const app = await core_1.NestFactory.createApplicationContext(CanvasFlowVersionMigrationModule, {
        logger: ['log', 'warn', 'error'],
    });
    try {
        const service = app.get(canvas_flow_service_1.CanvasFlowService);
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
    }
    finally {
        await app.close();
        await mongoose.disconnect().catch(() => undefined);
    }
}
void main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
});
//# sourceMappingURL=migrate-canvas-flow-versions.js.map