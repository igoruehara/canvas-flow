"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockConnectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const queue_lock_constants_model_1 = require("./queue-lock-constants-model");
const queue_lock_schema_1 = require("./queue-lock-schema");
exports.lockConnectProviders = [
    {
        provide: queue_lock_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(queue_lock_constants_model_1.COLLECTION_NAME, queue_lock_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=queue-lock-connect-provider.js.map