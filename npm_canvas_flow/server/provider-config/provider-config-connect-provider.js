"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const provider_config_constants_model_1 = require("./provider-config-constants-model");
const provider_config_schema_1 = require("./provider-config-schema");
exports.connectProviders = [
    {
        provide: provider_config_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(provider_config_constants_model_1.COLLECTION_NAME, provider_config_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=provider-config-connect-provider.js.map