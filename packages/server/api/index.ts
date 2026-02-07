import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const app = express();

// Optimize Prisma for serverless - reuse connection
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
});
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

// CORS - keep it simple for serverless
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '100mb' })); // Increased for audio file uploads

// Auth middleware
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as any).userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, username, password, displayName, isArtist } = req.body;
    
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username, and password are required' });
    }
    
    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Email or username already taken' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username: username.toLowerCase(),
        passwordHash,
        displayName: displayName || username,
        isArtist: isArtist || false
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isArtist: true,
        isPremium: true
      }
    });
    
    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    
    // Save session
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    
    res.status(201).json({ user, accessToken, refreshToken });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    
    // Save session
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isArtist: user.isArtist,
        isPremium: user.isPremium
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
app.post('/api/auth/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    // Verify token
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    
    // Check session exists
    const session = await prisma.session.findFirst({
      where: { refreshToken, userId: payload.userId }
    });
    
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Generate new access token
    const accessToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: '15m' });
    
    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
app.post('/api/auth/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.session.deleteMany({ where: { refreshToken } });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isArtist: true,
        isPremium: true,
        isVerified: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ============ TRACKS ROUTES ============

// Get trending tracks
app.get('/api/tracks/trending', async (req: Request, res: Response) => {
  try {
    const tracks = await prisma.track.findMany({
      where: { isPublic: true },
      orderBy: { playCount: 'desc' },
      take: 20,
      include: {
        artist: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });
    res.json({ tracks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// Get new tracks
app.get('/api/tracks/new', async (req: Request, res: Response) => {
  try {
    const tracks = await prisma.track.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        artist: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });
    res.json({ tracks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// Get all tracks with pagination
app.get('/api/tracks', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const [tracks, total] = await Promise.all([
      prisma.track.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          artist: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
        }
      }),
      prisma.track.count({ where: { isPublic: true } })
    ]);
    
    res.json({ tracks, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// Get single track
app.get('/api/tracks/:id', async (req: Request, res: Response) => {
  try {
    const track = await prisma.track.findUnique({
      where: { id: req.params.id },
      include: {
        artist: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
        album: { select: { id: true, title: true, coverUrl: true } },
        _count: { select: { likedBy: true } }
      }
    });
    
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    res.json(track);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch track' });
  }
});

// ============ SEARCH ROUTES ============

app.get('/api/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const type = (req.query.type as string) || 'all';
    
    if (!q || q.length < 2) {
      return res.json({ tracks: [], artists: [], albums: [], playlists: [] });
    }
    
    const searchTerm = `%${q}%`;
    
    let tracks: any[] = [];
    let artists: any[] = [];
    
    if (type === 'all' || type === 'tracks') {
      tracks = await prisma.track.findMany({
        where: {
          isPublic: true,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { genre: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 20,
        include: {
          artist: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
        }
      });
    }
    
    if (type === 'all' || type === 'artists') {
      artists = await prisma.user.findMany({
        where: {
          isArtist: true,
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 10,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isVerified: true,
          _count: { select: { tracks: true, followers: true } }
        }
      });
    }
    
    res.json({ tracks, artists, albums: [], playlists: [] });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============ USER ROUTES ============

app.get('/api/users/:username', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isArtist: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { tracks: true, followers: true, following: true } }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/api/users/:username/tracks', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const tracks = await prisma.track.findMany({
      where: { artistId: user.id, isPublic: true },
      orderBy: { createdAt: 'desc' },
      include: {
        artist: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });
    
    res.json({ tracks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// ============ GENRE ROUTES ============

// Get all genres (predefined + custom)
app.get('/api/genres', async (req: Request, res: Response) => {
  try {
    // Predefined genres
    const predefinedGenres = [
      'Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical', 
      'Country', 'Folk', 'Indie', 'Metal', 'Punk', 'Reggae', 'Latin', 
      'World', 'Blues', 'Soul', 'Funk', 'Disco', 'House', 'Techno', 
      'Dubstep', 'Drum & Bass', 'Trap', 'Lo-Fi', 'Ambient', 'Gospel',
      'Afrobeat', 'K-Pop', 'J-Pop', 'Dancehall', 'Ska', 'Grunge'
    ];
    
    // Get custom genres from database (handle table not existing)
    let customGenres: any[] = [];
    try {
      customGenres = await prisma.genre.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, isCustom: true }
      });
    } catch {
      // Genre table might not exist yet - that's ok
      console.log('Genre table not available');
    }
    
    res.json({ 
      predefined: predefinedGenres.map(g => ({ name: g, isCustom: false })),
      custom: customGenres 
    });
  } catch (error) {
    console.error('Genres error:', error);
    // Return predefined genres even if there's an error
    res.json({ 
      predefined: [
        'Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical'
      ].map(g => ({ name: g, isCustom: false })),
      custom: [] 
    });
  }
});

// Create custom genre
app.post('/api/genres', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Genre name must be at least 2 characters' });
    }
    
    const normalized = name.trim();
    
    try {
      // Check if already exists
      const existing = await prisma.genre.findFirst({
        where: { name: { equals: normalized, mode: 'insensitive' } }
      });
      
      if (existing) {
        return res.json(existing);
      }
      
      const genre = await prisma.genre.create({
        data: {
          name: normalized,
          isCustom: true,
          createdById: (req as any).userId
        }
      });
      
      res.status(201).json(genre);
    } catch {
      // Genre table might not exist - just return the genre name
      res.status(201).json({ name: normalized, isCustom: true });
    }
  } catch (error) {
    console.error('Create genre error:', error);
    res.status(500).json({ error: 'Failed to create genre' });
  }
});

// ============ UPLOAD ROUTES ============

// Supported audio formats
const SUPPORTED_AUDIO_FORMATS = [
  'audio/mpeg',           // MP3
  'audio/mp3',            // MP3 alternate
  'audio/wav',            // WAV
  'audio/wave',           // WAV alternate
  'audio/x-wav',          // WAV alternate
  'audio/flac',           // FLAC
  'audio/x-flac',         // FLAC alternate
  'audio/aac',            // AAC
  'audio/mp4',            // M4A
  'audio/x-m4a',          // M4A alternate
  'audio/ogg',            // OGG
  'audio/vorbis',         // OGG Vorbis
  'audio/opus',           // Opus
  'audio/webm',           // WebM Audio
  'audio/aiff',           // AIFF
  'audio/x-aiff',         // AIFF alternate
  'audio/basic',          // AU
  'audio/x-ms-wma',       // WMA
];

const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Upload cover art (base64)
app.post('/api/upload/cover', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { image, mimeType } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }
    
    // Validate image type
    if (mimeType && !SUPPORTED_IMAGE_FORMATS.includes(mimeType)) {
      return res.status(400).json({ error: 'Unsupported image format. Use JPEG, PNG, WebP, or GIF' });
    }
    
    // For now, return the base64 as data URL (could integrate Cloudinary/S3 later)
    const coverUrl = `data:${mimeType || 'image/jpeg'};base64,${image}`;
    
    res.json({ coverUrl, success: true });
  } catch (error) {
    console.error('Cover upload error:', error);
    res.status(500).json({ error: 'Failed to upload cover' });
  }
});

// Upload avatar (base64)
app.post('/api/upload/avatar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { image, mimeType } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }
    
    if (mimeType && !SUPPORTED_IMAGE_FORMATS.includes(mimeType)) {
      return res.status(400).json({ error: 'Unsupported image format' });
    }
    
    const avatarUrl = `data:${mimeType || 'image/jpeg'};base64,${image}`;
    
    // Update user avatar
    await prisma.user.update({
      where: { id: (req as any).userId },
      data: { avatarUrl }
    });
    
    res.json({ avatarUrl, success: true });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Upload track (base64)
app.post('/api/upload/track', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { 
      audio, 
      audioMimeType,
      audioFileName,
      title, 
      genre, 
      isPublic = true, 
      isExplicit = false,
      coverUrl,
      duration 
    } = req.body;
    
    if (!audio) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Validate audio type
    const normalizedMimeType = audioMimeType?.toLowerCase() || 'audio/mpeg';
    if (!SUPPORTED_AUDIO_FORMATS.includes(normalizedMimeType)) {
      return res.status(400).json({ 
        error: `Unsupported audio format: ${audioMimeType}. Supported: MP3, WAV, FLAC, AAC, M4A, OGG, Opus, WebM, AIFF, WMA` 
      });
    }
    
    // Check file size (base64 is ~33% larger, so 50MB file = ~67MB base64)
    const approximateSize = (audio.length * 3) / 4; // Approximate original size
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    
    if (approximateSize > maxSize) {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB' });
    }
    
    // Create audio URL (data URL for now - could use cloud storage)
    const audioUrl = `data:${normalizedMimeType};base64,${audio}`;
    
    // Generate a slug from title
    const slug = title.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    
    // Create track in database
    const track = await prisma.track.create({
      data: {
        title: title.trim(),
        slug,
        artistId: (req as any).userId,
        audioUrl,
        coverUrl: coverUrl || null,
        duration: duration || 0,
        genre: genre || null,
        isPublic: isPublic === true || isPublic === 'true',
        isExplicit: isExplicit === true || isExplicit === 'true',
      },
      include: {
        artist: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });
    
    res.status(201).json({ 
      success: true, 
      track,
      message: 'Track uploaded successfully'
    });
  } catch (error) {
    console.error('Track upload error:', error);
    res.status(500).json({ error: 'Failed to upload track' });
  }
});

// Get supported formats
app.get('/api/upload/formats', (req: Request, res: Response) => {
  res.json({
    audio: {
      mimeTypes: SUPPORTED_AUDIO_FORMATS,
      extensions: ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.opus', '.webm', '.aiff', '.wma'],
      maxSizeMB: 50
    },
    image: {
      mimeTypes: SUPPORTED_IMAGE_FORMATS,
      extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      maxSizeMB: 10
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

export default app;
