import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { config } from '../config/index.js';
import { errors } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const authRoutes = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100).optional(),
  isArtist: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Generate tokens
const generateTokens = (userId: string, email: string) => {
  const accessToken = jwt.sign(
    { userId, email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
  
  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn }
  );
  
  return { accessToken, refreshToken };
};

// Register new user
authRoutes.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    
    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
        ],
      },
    });
    
    if (existing) {
      throw errors.conflict(
        existing.email === data.email
          ? 'Email already registered'
          : 'Username already taken'
      );
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        displayName: data.displayName || data.username,
        isArtist: data.isArtist || false,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        isArtist: true,
        isPremium: true,
        createdAt: true,
      },
    });
    
    // Generate tokens
    const tokens = generateTokens(user.id, user.email);
    
    // Save refresh token session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt,
      },
    });
    
    res.status(201).json({
      user,
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});

// Login
authRoutes.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });
    
    if (!user) {
      throw errors.unauthorized('Invalid credentials');
    }
    
    // Verify password
    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    
    if (!isValid) {
      throw errors.unauthorized('Invalid credentials');
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    // Generate tokens
    const tokens = generateTokens(user.id, user.email);
    
    // Save refresh token session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt,
      },
    });
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isArtist: user.isArtist,
        isPremium: user.isPremium,
      },
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});

// Refresh token
authRoutes.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw errors.badRequest('Refresh token required');
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as {
      userId: string;
      email: string;
      type: string;
    };
    
    if (decoded.type !== 'refresh') {
      throw errors.unauthorized('Invalid token type');
    }
    
    // Find session
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });
    
    if (!session || session.expiresAt < new Date()) {
      throw errors.unauthorized('Session expired');
    }
    
    // Generate new tokens
    const tokens = generateTokens(session.userId, session.user.email);
    
    // Update session with new refresh token
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);
    
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: newExpiresAt,
      },
    });
    
    res.json(tokens);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(errors.unauthorized('Invalid refresh token'));
    }
    next(error);
  }
});

// Logout
authRoutes.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await prisma.session.deleteMany({
        where: {
          userId: req.user!.id,
          refreshToken,
        },
      });
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Get current user
authRoutes.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isArtist: true,
        isVerified: true,
        isPremium: true,
        createdAt: true,
        _count: {
          select: {
            tracks: true,
            playlists: true,
            followers: true,
            following: true,
          },
        },
      },
    });
    
    res.json(user);
  } catch (error) {
    next(error);
  }
});
