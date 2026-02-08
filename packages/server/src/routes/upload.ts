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

// Upload track - supports both multipart form data AND base64 JSON
uploadRoutes.post(
  '/track',
  authenticate,
  requireArtist,
  async (req: Request, res: Response, next: NextFunction) => {
    let tempFilePath: string | null = null;
    
    try {
      const contentType = req.headers['content-type'] || '';
      
      let filePath: string;
      let originalName: string;
      let fileSize: number;
      let titleInput: string;
      let albumIdInput: string | undefined;
      let genreInput: string | undefined;
      let isPublicInput: boolean;
      let isExplicitInput: boolean;
      let coverUrlInput: string | undefined;
      let durationInput: number | undefined;
      
      if (contentType.includes('application/json')) {
        // Handle base64 upload (from serverless-compatible frontend)
        const { audio, audioMimeType, audioFileName, title, albumId, genre, isPublic = true, isExplicit = false, coverUrl, duration } = req.body;
        
        if (!audio) {
          throw errors.badRequest('No audio data provided');
        }
        
        if (!title) {
          throw errors.badRequest('Track title is required');
        }
        
        // Decode base64 and save to temp file
        const buffer = Buffer.from(audio, 'base64');
        const ext = path.extname(audioFileName || '.mp3').toLowerCase() || '.mp3';
        const filename = `${uuid()}${ext}`;
        filePath = path.join(audioDir, filename);
        tempFilePath = filePath;
        
        await fs.writeFile(filePath, buffer);
        
        originalName = audioFileName || 'upload.mp3';
        fileSize = buffer.length;
        titleInput = title;
        albumIdInput = albumId;
        genreInput = genre;
        isPublicInput = isPublic === 'true' || isPublic === true;
        isExplicitInput = isExplicit === 'true' || isExplicit === true;
        coverUrlInput = coverUrl;
        durationInput = duration;
      } else {
        // Handle multipart form upload (legacy)
        await new Promise<void>((resolve, reject) => {
          audioUpload.single('audio')(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        if (!req.file) {
          throw errors.badRequest('No audio file provided');
        }
        
        filePath = req.file.path;
        originalName = req.file.originalname;
        fileSize = req.file.size;
        titleInput = req.body.title;
        albumIdInput = req.body.albumId;
        genreInput = req.body.genre;
        isPublicInput = req.body.isPublic === 'true' || req.body.isPublic === true;
        isExplicitInput = req.body.isExplicit === 'true' || req.body.isExplicit === true;
        coverUrlInput = req.body.coverUrl;
        durationInput = req.body.duration ? parseInt(req.body.duration) : undefined;
        
        if (!titleInput) {
          throw errors.badRequest('Track title is required');
        }
      }
      
      const baseName = path.basename(filePath, path.extname(filePath));
      
      // Extract metadata
      let duration: number;
      let bitrate: number | null = null;
      let sampleRate: number | null = null;
      
      try {
        const metadata = await mm.parseFile(filePath);
        duration = durationInput || Math.round(metadata.format.duration || 0);
        bitrate = metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : null;
        sampleRate = metadata.format.sampleRate || null;
      } catch (metaErr) {
        console.error('Metadata extraction error:', metaErr);
        duration = durationInput || 0;
      }
      
      // Generate waveform
      let waveformData: number[] = [];
      try {
        waveformData = await generateWaveform(filePath);
      } catch (waveErr) {
        console.error('Waveform generation error:', waveErr);
      }
      
      // Transcode to multiple qualities (async)
      let transcoded: { low?: string; medium?: string; high?: string } = {};
      try {
        transcoded = await transcodeAudio(filePath, baseName);
      } catch (transErr) {
        console.error('Transcoding error:', transErr);
      }
      
      // Generate slug
      const slug = titleInput
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
      
      // Create track record
      const track = await prisma.track.create({
        data: {
          title: titleInput,
          slug: finalSlug,
          duration,
          fileUrl: `audio/${path.basename(filePath)}`,
          fileUrlLow: transcoded.low,
          fileUrlMedium: transcoded.medium,
          fileUrlHigh: transcoded.high,
          waveformData,
          genre: genreInput || null,
          isPublic: isPublicInput,
          isExplicit: isExplicitInput,
          coverUrl: coverUrlInput || null,
          fileSize,
          bitrate,
          sampleRate,
          artistId: req.user!.id,
          albumId: albumIdInput || null,
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
      
      tempFilePath = null; // Don't delete on success
      res.status(201).json(track);
    } catch (error) {
      // Clean up temp file on error
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {});
      }
      next(error);
    }
  }
);

// Upload cover image - supports both multipart and base64
uploadRoutes.post(
  '/cover',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    let tempFilePath: string | null = null;
    
    try {
      const contentType = req.headers['content-type'] || '';
      
      let filePath: string;
      
      if (contentType.includes('application/json')) {
        // Handle base64 upload
        const { image, mimeType } = req.body;
        
        if (!image) {
          throw errors.badRequest('No image data provided');
        }
        
        const buffer = Buffer.from(image, 'base64');
        const ext = mimeType?.includes('png') ? '.png' : mimeType?.includes('webp') ? '.webp' : '.jpg';
        const filename = `${uuid()}${ext}`;
        filePath = path.join(coverDir, filename);
        tempFilePath = filePath;
        
        await fs.writeFile(filePath, buffer);
      } else {
        // Handle multipart form upload
        await new Promise<void>((resolve, reject) => {
          imageUpload.single('cover')(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        if (!req.file) {
          throw errors.badRequest('No image file provided');
        }
        
        filePath = req.file.path;
      }
      
      const baseName = uuid();
      const processed = await processImage(filePath, baseName);
      
      tempFilePath = null; // processImage handles cleanup
      
      res.json({
        coverUrl: processed.large,
        coverUrlSmall: processed.small,
        coverUrlMedium: processed.medium,
      });
    } catch (error) {
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {});
      }
      next(error);
    }
  }
);

// Upload avatar - supports both multipart and base64
uploadRoutes.post(
  '/avatar',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    let tempFilePath: string | null = null;
    
    try {
      const contentType = req.headers['content-type'] || '';
      
      let filePath: string;
      
      if (contentType.includes('application/json')) {
        // Handle base64 upload
        const { image, mimeType } = req.body;
        
        if (!image) {
          throw errors.badRequest('No image data provided');
        }
        
        const buffer = Buffer.from(image, 'base64');
        const ext = mimeType?.includes('png') ? '.png' : mimeType?.includes('webp') ? '.webp' : '.jpg';
        const filename = `${uuid()}${ext}`;
        filePath = path.join(avatarDir, filename);
        tempFilePath = filePath;
        
        await fs.writeFile(filePath, buffer);
      } else {
        // Handle multipart form upload
        await new Promise<void>((resolve, reject) => {
          imageUpload.single('avatar')(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        if (!req.file) {
          throw errors.badRequest('No image file provided');
        }
        
        filePath = req.file.path;
      }
      
      const outputName = `${req.user!.id}.webp`;
      const outputPath = path.join(avatarDir, outputName);
      
      await sharp(filePath)
        .resize(200, 200, { fit: 'cover' })
        .webp({ quality: 90 })
        .toFile(outputPath);
      
      await fs.unlink(filePath);
      tempFilePath = null;
      
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
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {});
      }
      next(error);
    }
  }
);
