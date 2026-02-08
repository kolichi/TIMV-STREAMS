import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Default genres that are always available
const DEFAULT_GENRES = [
  'Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Classical', 'Electronic', 
  'Country', 'Reggae', 'Blues', 'Soul', 'Folk', 'Latin', 'Metal', 
  'Punk', 'Indie', 'Alternative', 'Dance', 'House', 'Techno', 
  'Ambient', 'Gospel', 'World', 'Afrobeat', 'Afropop', 'Bongo Flava',
  'Amapiano', 'Kwaito', 'Highlife', 'Soukous', 'Rumba', 'Zouk',
  'Dancehall', 'Soca', 'Calypso', 'Trap', 'Drill', 'Grime',
  'K-Pop', 'J-Pop', 'Bollywood', 'Acoustic', 'Instrumental', 'Soundtrack'
];

// Get all genres (default + custom)
router.get('/', async (req, res, next) => {
  try {
    // Get custom genres from database
    const customGenres = await prisma.genre.findMany({
      orderBy: { name: 'asc' },
    });

    // Combine default and custom genres
    const customGenreNames = customGenres.map(g => g.name);
    const allGenres = [
      ...DEFAULT_GENRES.map(name => ({ 
        id: name.toLowerCase().replace(/\s+/g, '-'), 
        name, 
        isCustom: false 
      })),
      ...customGenres.map(g => ({ 
        id: g.id, 
        name: g.name, 
        isCustom: g.isCustom 
      }))
    ];

    // Remove duplicates (prefer custom over default)
    const uniqueGenres = allGenres.filter((genre, index, self) => 
      index === self.findIndex(g => g.name.toLowerCase() === genre.name.toLowerCase())
    );

    // Sort alphabetically
    uniqueGenres.sort((a, b) => a.name.localeCompare(b.name));

    res.json(uniqueGenres);
  } catch (error) {
    next(error);
  }
});

// Create a custom genre (requires authentication)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Genre name is required' });
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return res.status(400).json({ error: 'Genre name must be between 2 and 50 characters' });
    }

    // Check if it's a default genre
    if (DEFAULT_GENRES.some(g => g.toLowerCase() === trimmedName.toLowerCase())) {
      return res.status(400).json({ error: 'This genre already exists as a default genre' });
    }

    // Check if custom genre already exists
    const existing = await prisma.genre.findFirst({
      where: { 
        name: { equals: trimmedName, mode: 'insensitive' } 
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'This genre already exists' });
    }

    const genre = await prisma.genre.create({
      data: {
        name: trimmedName,
        isCustom: true,
        createdById: req.user!.id,
      },
    });

    res.status(201).json(genre);
  } catch (error) {
    next(error);
  }
});

// Delete a custom genre (requires authentication, only creator or admin)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const genre = await prisma.genre.findUnique({
      where: { id },
    });

    if (!genre) {
      return res.status(404).json({ error: 'Genre not found' });
    }

    if (!genre.isCustom) {
      return res.status(400).json({ error: 'Cannot delete default genres' });
    }

    // Only allow creator or admin to delete
    if (genre.createdById !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this genre' });
    }

    await prisma.genre.delete({
      where: { id },
    });

    res.json({ message: 'Genre deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export const genreRoutes = router;
