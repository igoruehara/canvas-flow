"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProviders = void 0;
const constants_global_1 = require("../constants-global");
const documents_constants_model_1 = require("./documents-constants-model");
const documents_schema_1 = require("./documents-schema");
exports.connectProviders = [
    {
        provide: documents_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(documents_constants_model_1.COLLECTION_NAME, documents_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=documents-connect-provider.js.map