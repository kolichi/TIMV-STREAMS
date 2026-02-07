import { Router, Response } from 'express';
import { createReadStream, statSync, existsSync } from 'fs';
import path from 'path';
import { prisma } from '../db/client.js';
import { cache, cacheKeys } from '../db/redis.js';
import { config } from '../config/index.js';
import { errors } from '../middleware/errorHandler.js';
import { optionalAuth, AuthRequest } from '../middleware/auth.js';

export const streamRoutes = Router();

/**
 * OPTIMIZED AUDIO STREAMING
 * 
 * Features:
 * 1. Range request support (seeking, resume)
 * 2. Adaptive quality based on connection & preference
 * 3. Chunked transfer for low memory usage
 * 4. Aggressive caching headers
 * 5. Play count tracking with debouncing
 */

// Quality preference from query or user settings
type Quality = 'low' | 'medium' | 'high' | 'lossless';

const getQualityFile = (track: any, quality: Quality): string | null => {
  switch (quality) {
    case 'low':
      return track.fileUrlLow || track.fileUrlMedium || track.fileUrl;
    case 'medium':
      return track.fileUrlMedium || track.fileUrl;
    case 'high':
      return track.fileUrlHigh || track.fileUrl;
    case 'lossless':
      return track.fileUrl;
    default:
      return track.fileUrlMedium || track.fileUrl;
  }
};

// Stream audio with range support
streamRoutes.get('/:trackId', optionalAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { trackId } = req.params;
    const quality = (req.query.quality as Quality) || 'medium';
    
    // Try cache first
    let track = await cache.get<any>(cacheKeys.trackMeta(trackId));
    
    if (!track) {
      track = await prisma.track.findUnique({
        where: { id: trackId },
        select: {
          id: true,
          title: true,
          fileUrl: true,
          fileUrlLow: true,
          fileUrlMedium: true,
          fileUrlHigh: true,
          duration: true,
          isPublic: true,
          artistId: true,
        },
      });
      
      if (track) {
        await cache.set(cacheKeys.trackMeta(trackId), track, 3600);
      }
    }
    
    if (!track) {
      throw errors.notFound('Track not found');
    }
    
    // Check if track is public or user is the artist
    if (!track.isPublic && req.user?.id !== track.artistId) {
      throw errors.forbidden('This track is private');
    }
    
    // Get the appropriate quality file
    const relativeFilePath = getQualityFile(track, quality);
    if (!relativeFilePath) {
      throw errors.notFound('Audio file not available');
    }
    
    const filePath = path.join(config.uploadDir, relativeFilePath);
    
    if (!existsSync(filePath)) {
      throw errors.notFound('Audio file not found');
    }
    
    const stat = statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
    };
    const contentType = contentTypes[ext] || 'audio/mpeg';
    
    // Handle range requests (for seeking)
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + config.streamChunkSize, fileSize - 1);
      const chunkSize = end - start + 1;
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'X-Content-Duration': track.duration,
      });
      
      const stream = createReadStream(filePath, { start, end });
      stream.pipe(res);
      
      // Track play if starting from beginning (or near it)
      if (start < 1000 && req.user) {
        trackPlay(trackId, req.user.id).catch(console.error);
      }
    } else {
      // No range - send entire file (but with streaming)
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Duration': track.duration,
      });
      
      const stream = createReadStream(filePath);
      stream.pipe(res);
      
      // Track play
      if (req.user) {
        trackPlay(trackId, req.user.id).catch(console.error);
      }
    }
  } catch (error) {
    next(error);
  }
});

// Track waveform data for visualization
streamRoutes.get('/:trackId/waveform', async (req, res, next) => {
  try {
    const { trackId } = req.params;
    
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      select: { waveformData: true },
    });
    
    if (!track) {
      throw errors.notFound('Track not found');
    }
    
    res.json({ waveform: track.waveformData || [] });
  } catch (error) {
    next(error);
  }
});

// Helper: Track play with debouncing
const playDebounce = new Map<string, number>();

async function trackPlay(trackId: string, userId: string) {
  const key = `${trackId}:${userId}`;
  const now = Date.now();
  const lastPlay = playDebounce.get(key) || 0;
  
  // Debounce: Only count if more than 30 seconds since last play
  if (now - lastPlay < 30000) {
    return;
  }
  
  playDebounce.set(key, now);
  
  // Clean up old entries periodically
  if (playDebounce.size > 10000) {
    const cutoff = now - 60000;
    for (const [k, v] of playDebounce) {
      if (v < cutoff) playDebounce.delete(k);
    }
  }
  
  // Increment play count (batched in Redis, synced to DB periodically)
  await cache.incr(`plays:${trackId}`);
  
  // Record in play history
  await prisma.playHistory.create({
    data: {
      userId,
      trackId,
      duration: 0, // Will be updated on completion
      completed: false,
    },
  });
}

// Update play history on completion
streamRoutes.post('/:trackId/complete', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.json({ success: true });
    }
    
    const { trackId } = req.params;
    const { duration } = req.body;
    
    // Find the most recent play history entry
    const history = await prisma.playHistory.findFirst({
      where: {
        userId: req.user.id,
        trackId,
        completed: false,
      },
      orderBy: { playedAt: 'desc' },
    });
    
    if (history) {
      await prisma.playHistory.update({
        where: { id: history.id },
        data: {
          duration: duration || 0,
          completed: true,
        },
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
