"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitConnectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const queue_rate_limit_constants_model_1 = require("./queue-rate-limit-constants-model");
const queue_rate_limit_schema_1 = require("./queue-rate-limit-schema");
exports.rateLimitConnectProviders = [
    {
        provide: queue_rate_limit_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(queue_rate_limit_constants_model_1.COLLECTION_NAME, queue_rate_limit_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=queue-rate-limit-connect-provider.js.map