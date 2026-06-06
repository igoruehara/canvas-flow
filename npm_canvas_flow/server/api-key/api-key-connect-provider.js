"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const api_key_constants_model_1 = require("./api-key-constants-model");
const api_key_schema_1 = require("./api-key-schema");
exports.connectProviders = [
    {
        provide: api_key_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(api_key_constants_model_1.COLLECTION_NAME, api_key_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=api-key-connect-provider.js.map