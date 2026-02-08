import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { cache, cacheKeys } from '../db/redis.js';
import { optionalAuth } from '../middleware/auth.js';
import '../types/express.js';

export const searchRoutes = Router();

// Full-text search across tracks, artists, albums, playlists
searchRoutes.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string || '').trim();
    const type = req.query.type as string; // 'tracks', 'artists', 'albums', 'playlists', or undefined for all
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    
    if (!query || query.length < 2) {
      return res.json({
        tracks: [],
        artists: [],
        albums: [],
        playlists: [],
      });
    }
    
    // Check cache
    const cacheKey = cacheKeys.search(`${query}:${type || 'all'}:${limit}`);
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const searchPattern = `%${query}%`;
    
    const results: {
      tracks?: any[];
      artists?: any[];
      albums?: any[];
      playlists?: any[];
    } = {};
    
    // Search tracks
    if (!type || type === 'tracks') {
      results.tracks = await prisma.track.findMany({
        where: {
          isPublic: true,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { genre: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { playCount: 'desc' },
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
      });
    }
    
    // Search artists
    if (!type || type === 'artists') {
      results.artists = await prisma.user.findMany({
        where: {
          isArtist: true,
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isVerified: true,
          _count: {
            select: {
              tracks: { where: { isPublic: true } },
              followers: true,
            },
          },
        },
      });
    }
    
    // Search albums
    if (!type || type === 'albums') {
      results.albums = await prisma.album.findMany({
        where: {
          isPublic: true,
          title: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        include: {
          artist: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: { tracks: true },
          },
        },
      });
    }
    
    // Search playlists
    if (!type || type === 'playlists') {
      results.playlists = await prisma.playlist.findMany({
        where: {
          isPublic: true,
          title: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: { tracks: true },
          },
        },
      });
    }
    
    // Cache for 2 minutes
    await cache.set(cacheKey, results, 120);
    
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Search suggestions (autocomplete)
searchRoutes.get('/suggestions', async (req, res, next) => {
  try {
    const query = (req.query.q as string || '').trim();
    
    if (!query || query.length < 2) {
      return res.json([]);
    }
    
    // Get quick suggestions from tracks and artists
    const [tracks, artists] = await Promise.all([
      prisma.track.findMany({
        where: {
          isPublic: true,
          title: { startsWith: query, mode: 'insensitive' },
        },
        take: 5,
        select: { title: true },
      }),
      prisma.user.findMany({
        where: {
          isArtist: true,
          OR: [
            { displayName: { startsWith: query, mode: 'insensitive' } },
            { username: { startsWith: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { displayName: true, username: true },
      }),
    ]);
    
    const suggestions = [
      ...tracks.map((t: any) => ({ type: 'track', value: t.title })),
      ...artists.map((a: any) => ({ type: 'artist', value: a.displayName || a.username })),
    ];
    
    res.json(suggestions.slice(0, 8));
  } catch (error) {
    next(error);
  }
});
