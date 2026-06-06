"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../database/database.module");
const sqs_transition_service_1 = require("./sqs-transition-service");
const queue_job_connect_provider_1 = require("./queue-job-connect-provider");
const queue_lock_connect_provider_1 = require("./queue-lock-connect-provider");
const queue_rate_limit_connect_provider_1 = require("./queue-rate-limit-connect-provider");
const queue_message_dedupe_connect_provider_1 = require("./queue-message-dedupe-connect-provider");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        providers: [
            sqs_transition_service_1.SqsTransitionService,
            ...queue_job_connect_provider_1.connectProviders,
            ...queue_lock_connect_provider_1.lockConnectProviders,
            ...queue_rate_limit_connect_provider_1.rateLimitConnectProviders,
            ...queue_message_dedupe_connect_provider_1.messageDedupeConnectProviders,
        ],
        exports: [sqs_transition_service_1.SqsTransitionService],
    })
], QueueModule);
//# sourceMappingURL=queue-module.js.map