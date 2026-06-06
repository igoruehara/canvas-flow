"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageDedupeConnectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const queue_message_dedupe_constants_model_1 = require("./queue-message-dedupe-constants-model");
const queue_message_dedupe_schema_1 = require("./queue-message-dedupe-schema");
exports.messageDedupeConnectProviders = [
    {
        provide: queue_message_dedupe_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(queue_message_dedupe_constants_model_1.COLLECTION_NAME, queue_message_dedupe_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=queue-message-dedupe-connect-provider.js.map