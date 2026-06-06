"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const canvas_flow_constants_model_1 = require("./canvas-flow-constants-model");
const canvas_flow_schema_1 = require("./canvas-flow-schema");
exports.connectProviders = [
    {
        provide: canvas_flow_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(canvas_flow_constants_model_1.COLLECTION_NAME, canvas_flow_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
    {
        provide: canvas_flow_constants_model_1.AGENT_MODEL_NAME,
        useFactory: (connection) => connection.model(canvas_flow_constants_model_1.AGENT_COLLECTION_NAME, canvas_flow_schema_1.AgentSchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
    {
        provide: canvas_flow_constants_model_1.VERSION_MODEL_NAME,
        useFactory: (connection) => connection.model(canvas_flow_constants_model_1.VERSION_COLLECTION_NAME, canvas_flow_schema_1.VersionSchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=canvas-flow-connect-provider.js.map