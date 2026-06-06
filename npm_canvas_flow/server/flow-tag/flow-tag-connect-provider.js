"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const flow_tag_constants_model_1 = require("./flow-tag-constants-model");
const flow_tag_schema_1 = require("./flow-tag-schema");
exports.connectProviders = [
    {
        provide: flow_tag_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(flow_tag_constants_model_1.COLLECTION_NAME, flow_tag_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=flow-tag-connect-provider.js.map