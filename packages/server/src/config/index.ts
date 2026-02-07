import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // File Storage
  uploadDir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || './uploads'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
  allowedAudioFormats: (process.env.ALLOWED_AUDIO_FORMATS || 'mp3,wav,flac,aac,ogg,m4a').split(','),
  
  // Audio Quality Settings (kbps)
  audioQuality: {
    low: parseInt(process.env.AUDIO_QUALITY_LOW || '64', 10),
    medium: parseInt(process.env.AUDIO_QUALITY_MEDIUM || '128', 10),
    high: parseInt(process.env.AUDIO_QUALITY_HIGH || '256', 10),
    lossless: parseInt(process.env.AUDIO_QUALITY_LOSSLESS || '320', 10),
  },
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // Chunk size for streaming (64KB for mobile optimization)
  streamChunkSize: 64 * 1024,
};
