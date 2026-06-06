"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const auth_constants_model_1 = require("./auth-constants-model");
const auth_organization_schema_1 = require("./auth-organization-schema");
const auth_schema_1 = require("./auth-schema");
exports.connectProviders = [
    {
        provide: auth_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(auth_constants_model_1.COLLECTION_NAME, auth_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
    {
        provide: auth_constants_model_1.ORGANIZATION_MODEL_NAME,
        useFactory: (connection) => connection.model(auth_constants_model_1.ORGANIZATION_COLLECTION_NAME, auth_organization_schema_1.OrganizationEntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=auth-connect-provider.js.map