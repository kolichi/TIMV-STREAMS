import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { cache, cacheKeys } from '../db/redis.js';
import { errors } from '../middleware/errorHandler.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import '../types/express.js';

export const trackRoutes = Router();

// Get trending tracks
trackRoutes.get('/trending', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try cache first
    const cached = await cache.get<any[]>(cacheKeys.trending());
    if (cached) {
      return res.json(cached);
    }
    
    const tracks = await prisma.track.findMany({
      where: { isPublic: true },
      orderBy: { playCount: 'desc' },
      take: 50,
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
        album: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
          },
        },
      },
    });
    
    // Cache for 5 minutes
    await cache.set(cacheKeys.trending(), tracks, 300);
    
    res.json(tracks);
  } catch (error) {
    next(error);
  }
});

// Get new releases
trackRoutes.get('/new', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cached = await cache.get<any[]>(cacheKeys.newReleases());
    if (cached) {
      return res.json(cached);
    }
    
    const tracks = await prisma.track.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
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
        album: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
          },
        },
      },
    });
    
    await cache.set(cacheKeys.newReleases(), tracks, 300);
    
    res.json(tracks);
  } catch (error) {
    next(error);
  }
});

// Get single track
trackRoutes.get('/:trackId', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackId } = req.params;
    
    const track = await prisma.track.findUnique({
      where: { id: trackId },
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
        album: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
          },
        },
        _count: {
          select: {
            likedBy: true,
          },
        },
      },
    });
    
    if (!track) {
      throw errors.notFound('Track not found');
    }
    
    if (!track.isPublic && req.user?.id !== track.artistId) {
      throw errors.forbidden('This track is private');
    }
    
    // Check if user liked this track
    let isLiked = false;
    if (req.user) {
      const like = await prisma.likedTrack.findUnique({
        where: {
          userId_trackId: {
            userId: req.user.id,
            trackId,
          },
        },
      });
      isLiked = !!like;
    }
    
    res.json({ ...track, isLiked });
  } catch (error) {
    next(error);
  }
});

// Like/unlike track
trackRoutes.post('/:trackId/like', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackId } = req.params;
    
    const track = await prisma.track.findUnique({
      where: { id: trackId },
    });
    
    if (!track) {
      throw errors.notFound('Track not found');
    }
    
    // Check if already liked
    const existing = await prisma.likedTrack.findUnique({
      where: {
        userId_trackId: {
          userId: req.user!.id,
          trackId,
        },
      },
    });
    
    if (existing) {
      // Unlike
      await prisma.likedTrack.delete({
        where: { id: existing.id },
      });
      res.json({ liked: false });
    } else {
      // Like
      await prisma.likedTrack.create({
        data: {
          userId: req.user!.id,
          trackId,
        },
      });
      res.json({ liked: true });
    }
  } catch (error) {
    next(error);
  }
});

// Get user's liked tracks
trackRoutes.get('/liked/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const [tracks, total] = await Promise.all([
      prisma.likedTrack.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          track: {
            include: {
              artist: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              album: {
                select: {
                  id: true,
                  title: true,
                  coverUrl: true,
                },
              },
            },
          },
        },
      }),
      prisma.likedTrack.count({ where: { userId: req.user!.id } }),
    ]);
    
    res.json({
      tracks: tracks.map((lt: any) => ({ ...lt.track, likedAt: lt.createdAt })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update track
trackRoutes.patch('/:trackId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackId } = req.params;
    
    const track = await prisma.track.findUnique({
      where: { id: trackId },
    });
    
    if (!track) {
      throw errors.notFound('Track not found');
    }
    
    if (track.artistId !== req.user!.id) {
      throw errors.forbidden('You can only edit your own tracks');
    }
    
    const updateSchema = z.object({
      title: z.string().min(1).max(200).optional(),
      genre: z.string().max(50).optional().nullable(),
      isPublic: z.boolean().optional(),
      isExplicit: z.boolean().optional(),
      coverUrl: z.string().optional().nullable(),
    });
    
    const data = updateSchema.parse(req.body);
    
    const updated = await prisma.track.update({
      where: { id: trackId },
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
    
    // Clear cache
    await cache.del(cacheKeys.track(trackId));
    await cache.del(cacheKeys.trackMeta(trackId));
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});

// Delete track
trackRoutes.delete('/:trackId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackId } = req.params;
    
    const track = await prisma.track.findUnique({
      where: { id: trackId },
    });
    
    if (!track) {
      throw errors.notFound('Track not found');
    }
    
    if (track.artistId !== req.user!.id) {
      throw errors.forbidden('You can only delete your own tracks');
    }
    
    await prisma.track.delete({
      where: { id: trackId },
    });
    
    // Clear cache
    await cache.del(cacheKeys.track(trackId));
    await cache.del(cacheKeys.trackMeta(trackId));
    
    res.json({ message: 'Track deleted' });
  } catch (error) {
    next(error);
  }
});
