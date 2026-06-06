"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProviders = void 0;
const constants_global_1 = require("./../constants-global");
const queue_job_constants_model_1 = require("./queue-job-constants-model");
const queue_job_schema_1 = require("./queue-job-schema");
exports.connectProviders = [
    {
        provide: queue_job_constants_model_1.MODEL_NAME,
        useFactory: (connection) => connection.model(queue_job_constants_model_1.COLLECTION_NAME, queue_job_schema_1.EntitySchema),
        inject: [constants_global_1.STRING_URL_DATABASE_CONNECTION],
    },
];
//# sourceMappingURL=queue-job-connect-provider.js.map