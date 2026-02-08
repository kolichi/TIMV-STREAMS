import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  // App
  appName: 'Izwei Music',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  
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
  
  // OAuth - Facebook
  facebookAppId: process.env.FACEBOOK_APP_ID || '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',
  facebookCallbackUrl: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3001/api/auth/facebook/callback',
  
  // OAuth - Google (optional)
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  
  // Email (for magic links)
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'noreply@izwei.music',
  
  // File Storage
  uploadDir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || './uploads'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB now!
  allowedAudioFormats: (process.env.ALLOWED_AUDIO_FORMATS || 'mp3,wav,flac,aac,ogg,m4a,opus,webm,aiff,wma').split(','),
  
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
