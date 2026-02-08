import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { prisma } from '../db/client.js';
import { config } from '../config/index.js';
import { errors } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import '../types/express.js';

export const authRoutes = Router();

// Email transporter
const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpPort === 465,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPass,
  },
});

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

const magicLinkSchema = z.object({
  email: z.string().email('Invalid email'),
});

// Generate tokens
const generateTokens = (userId: string, email: string) => {
  const accessToken = jwt.sign(
    { userId, email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
  );
  
  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'] }
  );
  
  return { accessToken, refreshToken };
};

// Generate username from email or name
const generateUsername = (base: string): string => {
  const clean = base.toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${clean}${suffix}`;
};

// Create session helper
const createSession = async (userId: string, refreshToken: string, req: any) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  await prisma.session.create({
    data: {
      userId,
      refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      expiresAt,
    },
  });
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
        avatarUrl: true,
        isArtist: true,
        isPremium: true,
        createdAt: true,
      },
    });
    
    // Generate tokens
    const tokens = generateTokens(user.id, user.email);
    await createSession(user.id, tokens.refreshToken, req);
    
    res.status(201).json({ user, ...tokens });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});

// Login with email/password
authRoutes.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });
    
    if (!user || !user.passwordHash) {
      throw errors.unauthorized('Invalid credentials');
    }
    
    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw errors.unauthorized('Invalid credentials');
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    const tokens = generateTokens(user.id, user.email);
    await createSession(user.id, tokens.refreshToken, req);
    
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

// ============ MAGIC LINK (EMAIL) AUTH ============

// Request magic link
authRoutes.post('/magic-link', async (req, res, next) => {
  try {
    const { email } = magicLinkSchema.parse(req.body);
    
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Find or prepare user
    let user = await prisma.user.findUnique({ where: { email } });
    
    // Create magic link
    await prisma.magicLink.create({
      data: {
        token,
        email,
        userId: user?.id,
        expiresAt,
      },
    });
    
    // Send email
    const magicUrl = `${config.appUrl}/auth/verify?token=${token}`;
    
    if (config.smtpUser && config.smtpPass) {
      await transporter.sendMail({
        from: `"${config.appName}" <${config.emailFrom}>`,
        to: email,
        subject: `Sign in to ${config.appName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8B5CF6;">🎵 ${config.appName}</h1>
            <p>Click the button below to sign in to your account:</p>
            <a href="${magicUrl}" style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Sign In
            </a>
            <p style="color: #666; margin-top: 20px; font-size: 14px;">
              This link expires in 15 minutes.<br>
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    } else {
      // Dev mode - log the link
      console.log(`\n🔗 Magic link for ${email}: ${magicUrl}\n`);
    }
    
    res.json({ 
      message: 'Magic link sent! Check your email.',
      // In dev mode, include token for testing
      ...(config.nodeEnv === 'development' && { token })
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(errors.badRequest(error.errors[0].message));
    }
    next(error);
  }
});

// Verify magic link
authRoutes.get('/magic-link/verify', async (req, res, next) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      throw errors.badRequest('Invalid token');
    }
    
    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
    });
    
    if (!magicLink || magicLink.usedAt || magicLink.expiresAt < new Date()) {
      throw errors.unauthorized('Invalid or expired link');
    }
    
    // Mark as used
    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() },
    });
    
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: magicLink.email },
    });
    
    if (!user) {
      // Create new user
      const username = generateUsername(magicLink.email.split('@')[0]);
      user = await prisma.user.create({
        data: {
          email: magicLink.email,
          username,
          displayName: magicLink.email.split('@')[0],
          emailVerified: true,
        },
      });
    } else {
      // Mark email as verified
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, lastLoginAt: new Date() },
      });
    }
    
    const tokens = generateTokens(user.id, user.email);
    await createSession(user.id, tokens.refreshToken, req);
    
    // Redirect to frontend with tokens
    res.redirect(`${config.appUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
  } catch (error) {
    next(error);
  }
});

// ============ FACEBOOK OAUTH ============

// Initiate Facebook login
authRoutes.get('/facebook', (req, res) => {
  const params = new URLSearchParams({
    client_id: config.facebookAppId,
    redirect_uri: config.facebookCallbackUrl,
    scope: 'email,public_profile',
    response_type: 'code',
    state: crypto.randomBytes(16).toString('hex'),
  });
  
  res.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params}`);
});

// Facebook callback
authRoutes.get('/facebook/callback', async (req, res, next) => {
  try {
    const { code, error: fbError } = req.query;
    
    if (fbError || !code) {
      return res.redirect(`${config.appUrl}/login?error=facebook_denied`);
    }
    
    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      client_id: config.facebookAppId,
      client_secret: config.facebookAppSecret,
      redirect_uri: config.facebookCallbackUrl,
      code: code as string,
    });
    
    const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${tokenParams}`);
    const tokenData = await tokenRes.json() as any;
    
    if (tokenData.error) {
      console.error('Facebook token error:', tokenData.error);
      return res.redirect(`${config.appUrl}/login?error=facebook_token`);
    }
    
    // Get user profile
    const profileRes = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture.width(200)&access_token=${tokenData.access_token}`
    );
    const profile = await profileRes.json() as any;
    
    if (!profile.id) {
      return res.redirect(`${config.appUrl}/login?error=facebook_profile`);
    }
    
    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { facebookId: profile.id },
          ...(profile.email ? [{ email: profile.email }] : []),
        ],
      },
    });
    
    if (user) {
      // Update existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          facebookId: profile.id,
          lastLoginAt: new Date(),
          ...(profile.picture?.data?.url && !user.avatarUrl && { avatarUrl: profile.picture.data.url }),
        },
      });
    } else {
      // Create new user
      const username = generateUsername(profile.name || 'user');
      user = await prisma.user.create({
        data: {
          email: profile.email || `fb_${profile.id}@izwei.music`,
          username,
          displayName: profile.name,
          avatarUrl: profile.picture?.data?.url,
          facebookId: profile.id,
          emailVerified: !!profile.email,
        },
      });
    }
    
    const tokens = generateTokens(user.id, user.email);
    await createSession(user.id, tokens.refreshToken, req);
    
    // Redirect to frontend
    res.redirect(`${config.appUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
  } catch (error) {
    console.error('Facebook auth error:', error);
    res.redirect(`${config.appUrl}/login?error=facebook_error`);
  }
});

// ============ GOOGLE OAUTH (Optional) ============

// Initiate Google login
authRoutes.get('/google', (req, res) => {
  if (!config.googleClientId) {
    return res.status(501).json({ error: 'Google auth not configured' });
  }
  
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleCallbackUrl,
    scope: 'email profile',
    response_type: 'code',
    access_type: 'offline',
    state: crypto.randomBytes(16).toString('hex'),
  });
  
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Google callback
authRoutes.get('/google/callback', async (req, res, next) => {
  try {
    const { code, error: googleError } = req.query;
    
    if (googleError || !code) {
      return res.redirect(`${config.appUrl}/login?error=google_denied`);
    }
    
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleCallbackUrl,
        code: code as string,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as any;
    
    if (tokenData.error) {
      return res.redirect(`${config.appUrl}/login?error=google_token`);
    }
    
    // Get user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json() as any;
    
    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: profile.id },
          { email: profile.email },
        ],
      },
    });
    
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.id,
          lastLoginAt: new Date(),
          ...(!user.avatarUrl && profile.picture && { avatarUrl: profile.picture }),
        },
      });
    } else {
      const username = generateUsername(profile.name || profile.email.split('@')[0]);
      user = await prisma.user.create({
        data: {
          email: profile.email,
          username,
          displayName: profile.name,
          avatarUrl: profile.picture,
          googleId: profile.id,
          emailVerified: profile.verified_email,
        },
      });
    }
    
    const tokens = generateTokens(user.id, user.email);
    await createSession(user.id, tokens.refreshToken, req);
    
    res.redirect(`${config.appUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
  } catch (error) {
    console.error('Google auth error:', error);
    res.redirect(`${config.appUrl}/login?error=google_error`);
  }
});

// ============ STANDARD AUTH ENDPOINTS ============

// Refresh token
authRoutes.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw errors.badRequest('Refresh token required');
    }
    
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as {
      userId: string;
      email: string;
      type: string;
    };
    
    if (decoded.type !== 'refresh') {
      throw errors.unauthorized('Invalid token type');
    }
    
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });
    
    if (!session || session.expiresAt < new Date()) {
      throw errors.unauthorized('Session expired');
    }
    
    const tokens = generateTokens(session.userId, session.user.email);
    
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);
    
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: tokens.refreshToken, expiresAt: newExpiresAt },
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
authRoutes.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await prisma.session.deleteMany({
        where: { userId: req.user!.id, refreshToken },
      });
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Get current user
authRoutes.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
        emailVerified: true,
        facebookId: true,
        googleId: true,
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

// Get auth providers status
authRoutes.get('/providers', (req, res) => {
  res.json({
    email: true,
    magicLink: !!(config.smtpUser && config.smtpPass) || config.nodeEnv === 'development',
    facebook: !!config.facebookAppId,
    google: !!config.googleClientId,
  });
});
