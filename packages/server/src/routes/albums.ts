import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { errors } from '../middleware/errorHandler.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

export const albumRoutes = Router();

// Get album by ID
albumRoutes.get('/:albumId', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { albumId } = req.params;
    
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        artist: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
        tracks: {
          where: { isPublic: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            duration: true,
            playCount: true,
            coverUrl: true,
          },
        },
      },
    });
    
    if (!album) {
      throw errors.notFound('Album not found');
    }
    
    if (!album.isPublic && req.user?.id !== album.artistId) {
      throw errors.forbidden('This album is private');
    }
    
    res.json(album);
  } catch (error) {
    next(error);
  }
});

// Create album
albumRoutes.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.isArtist) {
      throw errors.forbidden('Only artists can create albums');
    }
    
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      coverUrl: z.string().optional(),
      albumType: z.enum(['ALBUM', 'EP', 'SINGLE', 'COMPILATION']).optional(),
      releaseDate: z.string().datetime().optional(),
      isPublic: z.boolean().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Check for duplicate
    const existing = await prisma.album.findFirst({
      where: { artistId: req.user!.id, slug },
    });
    
    const album = await prisma.album.create({
      data: {
        ...data,
        slug: existing ? `${slug}-${Date.now()}` : slug,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
        artistId: req.user!.id,
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
    
    res.status(201).json(album);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});

// Update album
albumRoutes.patch('/:albumId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { albumId } = req.params;
    
    const album = await prisma.album.findUnique({
      where: { id: albumId },
    });
    
    if (!album) {
      throw errors.notFound('Album not found');
    }
    
    if (album.artistId !== req.user!.id) {
      throw errors.forbidden('You can only edit your own albums');
    }
    
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional().nullable(),
      coverUrl: z.string().optional().nullable(),
      isPublic: z.boolean().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const updated = await prisma.album.update({
      where: { id: albumId },
      data,
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
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});

// Delete album
albumRoutes.delete('/:albumId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { albumId } = req.params;
    
    const album = await prisma.album.findUnique({
      where: { id: albumId },
    });
    
    if (!album) {
      throw errors.notFound('Album not found');
    }
    
    if (album.artistId !== req.user!.id) {
      throw errors.forbidden('You can only delete your own albums');
    }
    
    // Remove album reference from tracks first
    await prisma.track.updateMany({
      where: { albumId },
      data: { albumId: null },
    });
    
    await prisma.album.delete({ where: { id: albumId } });
    
    res.json({ message: 'Album deleted' });
  } catch (error) {
    next(error);
  }
});
