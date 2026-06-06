"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseProviders = void 0;
const mongoose = require("mongoose");
const config_1 = require("@nestjs/config");
const constants_global_1 = require("./../constants-global");
exports.databaseProviders = [
    {
        provide: constants_global_1.STRING_URL_DATABASE_CONNECTION,
        inject: [config_1.ConfigService],
        useFactory: async (configService) => {
            const uri = configService.get('MONGO_DB_CONNECTION_STRING') ||
                'mongodb://127.0.0.1:27017/canvas_flow';
            mongoose.set('bufferCommands', false);
            try {
                await mongoose.connect(uri, {
                    serverSelectionTimeoutMS: Number(configService.get('MONGO_SERVER_SELECTION_TIMEOUT_MS') || 8000),
                    connectTimeoutMS: Number(configService.get('MONGO_CONNECT_TIMEOUT_MS') || 8000),
                });
                console.log('MongoDB connected');
            }
            catch (error) {
                console.error(`MongoDB connection failed: ${error?.message || String(error)}`);
                throw error;
            }
            return mongoose;
        },
    },
];
//# sourceMappingURL=database.providers.js.map