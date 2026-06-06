import * as mongoose from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { STRING_URL_DATABASE_CONNECTION } from './../constants-global';

export const databaseProviders = [
  {
    provide: STRING_URL_DATABASE_CONNECTION,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService): Promise<typeof mongoose> => {
      const uri =
        configService.get<string>('MONGO_DB_CONNECTION_STRING') ||
        'mongodb://127.0.0.1:27017/canvas_flow';
      mongoose.set('bufferCommands', false);
      try {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: Number(configService.get('MONGO_SERVER_SELECTION_TIMEOUT_MS') || 8000),
          connectTimeoutMS: Number(configService.get('MONGO_CONNECT_TIMEOUT_MS') || 8000),
        });
        console.log('MongoDB connected');
      } catch (error) {
        console.error(`MongoDB connection failed: ${error?.message || String(error)}`);
        throw error;
      }
      return mongoose;
    },
  },
];
