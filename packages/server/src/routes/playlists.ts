import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { errors } from '../middleware/errorHandler.js';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth.js';

export const playlistRoutes = Router();

// Get playlist by ID
playlistRoutes.get('/:playlistId', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { playlistId } = req.params;
    
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        tracks: {
          orderBy: { position: 'asc' },
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
        },
        _count: {
          select: { tracks: true },
        },
      },
    });
    
    if (!playlist) {
      throw errors.notFound('Playlist not found');
    }
    
    if (!playlist.isPublic && req.user?.id !== playlist.userId) {
      throw errors.forbidden('This playlist is private');
    }
    
    // Calculate total duration
    const totalDuration = playlist.tracks.reduce(
      (acc, pt) => acc + pt.track.duration,
      0
    );
    
    res.json({
      ...playlist,
      tracks: playlist.tracks.map(pt => ({
        ...pt.track,
        addedAt: pt.addedAt,
        position: pt.position,
      })),
      totalDuration,
    });
  } catch (error) {
    next(error);
  }
});

// Create playlist
playlistRoutes.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      isPublic: z.boolean().optional(),
      isCollaborative: z.boolean().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    const existing = await prisma.playlist.findFirst({
      where: { userId: req.user!.id, slug },
    });
    
    const playlist = await prisma.playlist.create({
      data: {
        ...data,
        slug: existing ? `${slug}-${Date.now()}` : slug,
        userId: req.user!.id,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
    
    res.status(201).json(playlist);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});

// Add track to playlist
playlistRoutes.post('/:playlistId/tracks', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { playlistId } = req.params;
    const { trackId } = req.body;
    
    if (!trackId) {
      throw errors.badRequest('Track ID required');
    }
    
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });
    
    if (!playlist) {
      throw errors.notFound('Playlist not found');
    }
    
    if (playlist.userId !== req.user!.id && !playlist.isCollaborative) {
      throw errors.forbidden('Cannot add tracks to this playlist');
    }
    
    // Check if track exists
    const track = await prisma.track.findUnique({
      where: { id: trackId },
    });
    
    if (!track) {
      throw errors.notFound('Track not found');
    }
    
    // Check if already in playlist
    const existing = await prisma.playlistTrack.findUnique({
      where: {
        playlistId_trackId: { playlistId, trackId },
      },
    });
    
    if (existing) {
      throw errors.conflict('Track already in playlist');
    }
    
    // Get max position
    const maxPosition = await prisma.playlistTrack.aggregate({
      where: { playlistId },
      _max: { position: true },
    });
    
    await prisma.playlistTrack.create({
      data: {
        playlistId,
        trackId,
        position: (maxPosition._max.position || 0) + 1,
      },
    });
    
    res.json({ message: 'Track added to playlist' });
  } catch (error) {
    next(error);
  }
});

// Remove track from playlist
playlistRoutes.delete('/:playlistId/tracks/:trackId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { playlistId, trackId } = req.params;
    
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });
    
    if (!playlist) {
      throw errors.notFound('Playlist not found');
    }
    
    if (playlist.userId !== req.user!.id) {
      throw errors.forbidden('Cannot modify this playlist');
    }
    
    await prisma.playlistTrack.deleteMany({
      where: { playlistId, trackId },
    });
    
    res.json({ message: 'Track removed from playlist' });
  } catch (error) {
    next(error);
  }
});

// Update playlist
playlistRoutes.patch('/:playlistId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { playlistId } = req.params;
    
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });
    
    if (!playlist) {
      throw errors.notFound('Playlist not found');
    }
    
    if (playlist.userId !== req.user!.id) {
      throw errors.forbidden('Cannot edit this playlist');
    }
    
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional().nullable(),
      coverUrl: z.string().optional().nullable(),
      isPublic: z.boolean().optional(),
      isCollaborative: z.boolean().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const updated = await prisma.playlist.update({
      where: { id: playlistId },
      data,
    });
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});

// Delete playlist
playlistRoutes.delete('/:playlistId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { playlistId } = req.params;
    
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });
    
    if (!playlist) {
      throw errors.notFound('Playlist not found');
    }
    
    if (playlist.userId !== req.user!.id) {
      throw errors.forbidden('Cannot delete this playlist');
    }
    
    await prisma.playlist.delete({ where: { id: playlistId } });
    
    res.json({ message: 'Playlist deleted' });
  } catch (error) {
    next(error);
  }
});

// Get user's playlists
playlistRoutes.get('/user/:username', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { username } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    
    if (!user) {
      throw errors.notFound('User not found');
    }
    
    const isOwner = req.user?.id === user.id;
    
    const playlists = await prisma.playlist.findMany({
      where: {
        userId: user.id,
        ...(isOwner ? {} : { isPublic: true }),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { tracks: true } },
      },
    });
    
    res.json(playlists);
  } catch (error) {
    next(error);
  }
});
