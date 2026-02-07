import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// Security & CORS
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
