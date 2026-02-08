import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import * as mm from 'music-metadata';
import sharp from 'sharp';
import { prisma } from '../db/client.js';
import { config } from '../config/index.js';
import { errors } from '../middleware/errorHandler.js';
import { authenticate, requireArtist } from '../middleware/auth.js';
import '../types/express.js';
import { cache, cacheKeys } from '../db/redis.js';

export const uploadRoutes = Router();

// Ensure upload directories exist
const audioDir = path.join(config.uploadDir, 'audio');
const coverDir = path.join(config.uploadDir, 'covers');
const avatarDir = path.join(config.uploadDir, 'avatars');

[audioDir, coverDir, avatarDir].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// Multer configuration for audio uploads
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const audioUpload = multer({
  storage: audioStorage,
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (config.allowedAudioFormats.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio format. Allowed: ${config.allowedAudioFormats.join(', ')}`));
    }
  },
});

// Multer configuration for image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, coverDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuid()}.webp`);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for images
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Allowed: JPEG, PNG, WebP, GIF'));
    }
  },
});

/**
 * Generate waveform data from audio file
 * Returns array of amplitude values for visualization
 */
async function generateWaveform(filePath: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const samples: number[] = [];
    
    ffmpeg(filePath)
      .audioFilters('aresample=8000,aformat=channel_layouts=mono')
      .format('f32le')
      .pipe()
      .on('data', (chunk: Buffer) => {
        for (let i = 0; i < chunk.length; i += 4) {
          const sample = chunk.readFloatLE(i);
          samples.push(Math.abs(sample));
        }
      })
      .on('end', () => {
        // Downsample to ~200 points for visualization
        const targetPoints = 200;
        const step = Math.ceil(samples.length / targetPoints);
        const waveform: number[] = [];
        
        for (let i = 0; i < samples.length; i += step) {
          const slice = samples.slice(i, i + step);
          const max = Math.max(...slice);
          waveform.push(Math.round(max * 100) / 100);
        }
        
        resolve(waveform);
      })
      .on('error', (err) => {
        console.error('Waveform generation error:', err);
        resolve([]); // Return empty array on error
      });
  });
}

/**
 * Transcode audio to multiple quality levels
 * This is key for data-efficient streaming
 */
async function transcodeAudio(
  inputPath: string,
  baseName: string
): Promise<{ low?: string; medium?: string; high?: string }> {
  const qualities = {
    low: config.audioQuality.low,
    medium: config.audioQuality.medium,
    high: config.audioQuality.high,
  };
  
  const results: { low?: string; medium?: string; high?: string } = {};
  
  for (const [quality, bitrate] of Object.entries(qualities)) {
    const outputName = `${baseName}_${quality}.mp3`;
    const outputPath = path.join(audioDir, outputName);
    
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(bitrate)
        .audioChannels(2)
        .audioFrequency(44100)
        .output(outputPath)
        .on('end', () => {
          results[quality as keyof typeof results] = `audio/${outputName}`;
          resolve();
        })
        .on('error', (err) => {
          console.error(`Transcode error (${quality}):`, err);
          resolve(); // Continue with other qualities
        })
        .run();
    });
  }
  
  return results;
}

/**
 * Process and optimize cover image
 * Creates multiple sizes for different use cases
 */
async function processImage(
  inputPath: string,
  outputBaseName: string
): Promise<{ small: string; medium: string; large: string }> {
  const sizes = {
    small: 150,  // Thumbnails
    medium: 300, // Lists
    large: 600,  // Full display
  };
  
  const results: { small: string; medium: string; large: string } = {
    small: '',
    medium: '',
    large: '',
  };
  
  for (const [size, width] of Object.entries(sizes)) {
    const outputName = `${outputBaseName}_${size}.webp`;
    const outputPath = path.join(coverDir, outputName);
    
    await sharp(inputPath)
      .resize(width, width, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(outputPath);
    
    results[size as keyof typeof results] = `covers/${outputName}`;
  }
  
  // Remove original uploaded file
  await fs.unlink(inputPath);
  
  return results;
}

// Upload track
uploadRoutes.post(
  '/track',
  authenticate,
  requireArtist,
  audioUpload.single('audio'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw errors.badRequest('No audio file provided');
      }
      
      const { title, albumId, genre, isPublic = true, isExplicit = false } = req.body;
      
      if (!title) {
        throw errors.badRequest('Track title is required');
      }
      
      const filePath = req.file.path;
      const baseName = path.basename(req.file.filename, path.extname(req.file.filename));
      
      // Extract metadata
      const metadata = await mm.parseFile(filePath);
      const duration = Math.round(metadata.format.duration || 0);
      const bitrate = metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : null;
      const sampleRate = metadata.format.sampleRate || null;
      
      // Generate waveform
      const waveformData = await generateWaveform(filePath);
      
      // Transcode to multiple qualities (async)
      const transcodePromise = transcodeAudio(filePath, baseName);
      
      // Generate slug
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Check for duplicate slug
      const existingTrack = await prisma.track.findFirst({
        where: {
          artistId: req.user!.id,
          slug,
        },
      });
      
      const finalSlug = existingTrack ? `${slug}-${Date.now()}` : slug;
      
      // Wait for transcoding
      const transcoded = await transcodePromise;
      
      // Create track record
      const track = await prisma.track.create({
        data: {
          title,
          slug: finalSlug,
          duration,
          fileUrl: `audio/${req.file.filename}`,
          fileUrlLow: transcoded.low,
          fileUrlMedium: transcoded.medium,
          fileUrlHigh: transcoded.high,
          waveformData,
          genre: genre || null,
          isPublic: isPublic === 'true' || isPublic === true,
          isExplicit: isExplicit === 'true' || isExplicit === true,
          fileSize: req.file.size,
          bitrate,
          sampleRate,
          artistId: req.user!.id,
          albumId: albumId || null,
        },
        include: {
          artist: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });
      
      res.status(201).json(track);
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      next(error);
    }
  }
);

// Upload cover image
uploadRoutes.post(
  '/cover',
  authenticate,
  imageUpload.single('cover'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw errors.badRequest('No image file provided');
      }
      
      const baseName = uuid();
      const processed = await processImage(req.file.path, baseName);
      
      res.json({
        coverUrl: processed.large,
        coverUrlSmall: processed.small,
        coverUrlMedium: processed.medium,
      });
    } catch (error) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      next(error);
    }
  }
);

// Upload avatar
uploadRoutes.post(
  '/avatar',
  authenticate,
  imageUpload.single('avatar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw errors.badRequest('No image file provided');
      }
      
      const outputName = `${req.user!.id}.webp`;
      const outputPath = path.join(avatarDir, outputName);
      
      await sharp(req.file.path)
        .resize(200, 200, { fit: 'cover' })
        .webp({ quality: 90 })
        .toFile(outputPath);
      
      await fs.unlink(req.file.path);
      
      const avatarUrl = `avatars/${outputName}`;
      
      // Update user
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { avatarUrl },
      });
      
      // Clear cache
      await cache.del(cacheKeys.user(req.user!.id));
      
      res.json({ avatarUrl });
    } catch (error) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      next(error);
    }
  }
);
