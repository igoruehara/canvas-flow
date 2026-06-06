"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const memory_constants_model_1 = require("./memory-constants-model");
const memory_history_schema_1 = require("./memory-history-schema");
const memory_schema_1 = require("./memory-schema");
const memory_trace_history_schema_1 = require("./memory-trace-history-schema");
exports.connectProviders = [
    {
        provide: memory_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(memory_constants_model_1.COLLECTION_NAME, memory_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
    {
        provide: memory_constants_model_1.HISTORY_MODEL_NAME,
        useFactory: (connection) => connection.model(memory_constants_model_1.HISTORY_COLLECTION_NAME, memory_history_schema_1.HistoryEntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
    {
        provide: memory_constants_model_1.TRACE_HISTORY_MODEL_NAME,
        useFactory: (connection) => connection.model(memory_constants_model_1.TRACE_HISTORY_COLLECTION_NAME, memory_trace_history_schema_1.TraceHistoryEntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=memory-connect-provider.js.map