"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const mcp_oauth_constants_model_1 = require("./mcp-oauth-constants-model");
const mcp_oauth_schema_1 = require("./mcp-oauth-schema");
exports.connectProviders = [
    {
        provide: mcp_oauth_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(mcp_oauth_constants_model_1.COLLECTION_NAME, mcp_oauth_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=mcp-oauth-connect-provider.js.map