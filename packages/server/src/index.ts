import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { trackRoutes } from './routes/tracks.js';
import { albumRoutes } from './routes/albums.js';
import { playlistRoutes } from './routes/playlists.js';
import { streamRoutes } from './routes/stream.js';
import { uploadRoutes } from './routes/upload.js';
import { searchRoutes } from './routes/search.js';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Allow audio streaming
}));

// CORS configuration - support multiple origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (config.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}. Allowed: ${config.corsOrigins.join(', ')}`);
      callback(null, false);
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));

// Compression for API responses (not for audio streams)
app.use(compression({
  filter: (req, res) => {
    // Don't compress audio streams
    if (req.path.startsWith('/api/stream')) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);

// Static files for uploads (with caching headers)
app.use('/uploads', express.static(config.uploadDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Start server (only in non-Vercel environment)
if (process.env.VERCEL !== '1') {
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`🎵 Stream server running on http://localhost:${PORT}`);
    console.log(`📁 Upload directory: ${config.uploadDir}`);
    console.log(`🔒 Environment: ${config.nodeEnv}`);
  });
}

// Export for Vercel serverless
export default app;
