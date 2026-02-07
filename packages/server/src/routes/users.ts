import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { errors } from '../middleware/errorHandler.js';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth.js';

export const userRoutes = Router();

// Get user profile
userRoutes.get('/:username', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { username } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isArtist: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            tracks: { where: { isPublic: true } },
            albums: { where: { isPublic: true } },
            playlists: { where: { isPublic: true } },
            followers: true,
            following: true,
          },
        },
      },
    });
    
    if (!user) {
      throw errors.notFound('User not found');
    }
    
    // Check if current user follows this user
    let isFollowing = false;
    if (req.user && req.user.id !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: req.user.id,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;
    }
    
    res.json({ ...user, isFollowing });
  } catch (error) {
    next(error);
  }
});

// Get user's tracks
userRoutes.get('/:username/tracks', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    
    if (!user) {
      throw errors.notFound('User not found');
    }
    
    const isOwner = req.user?.id === user.id;
    
    const [tracks, total] = await Promise.all([
      prisma.track.findMany({
        where: {
          artistId: user.id,
          ...(isOwner ? {} : { isPublic: true }),
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          album: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
            },
          },
        },
      }),
      prisma.track.count({
        where: {
          artistId: user.id,
          ...(isOwner ? {} : { isPublic: true }),
        },
      }),
    ]);
    
    res.json({
      tracks,
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

// Follow/unfollow user
userRoutes.post('/:username/follow', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { username } = req.params;
    
    const targetUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    
    if (!targetUser) {
      throw errors.notFound('User not found');
    }
    
    if (targetUser.id === req.user!.id) {
      throw errors.badRequest('Cannot follow yourself');
    }
    
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: req.user!.id,
          followingId: targetUser.id,
        },
      },
    });
    
    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      res.json({ following: false });
    } else {
      await prisma.follow.create({
        data: {
          followerId: req.user!.id,
          followingId: targetUser.id,
        },
      });
      res.json({ following: true });
    }
  } catch (error) {
    next(error);
  }
});

// Update profile
userRoutes.patch('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const updateSchema = z.object({
      displayName: z.string().min(1).max(100).optional(),
      bio: z.string().max(500).optional().nullable(),
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
    });
    
    const data = updateSchema.parse(req.body);
    
    // Check username uniqueness
    if (data.username) {
      const existing = await prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id: req.user!.id },
        },
      });
      if (existing) {
        throw errors.conflict('Username already taken');
      }
    }
    
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isArtist: true,
        isPremium: true,
      },
    });
    
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});
