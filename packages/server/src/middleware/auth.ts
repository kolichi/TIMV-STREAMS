import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../db/client.js';
import { errors } from './errorHandler.js';
import '../types/express.js';

// Use Express.Request directly since we've augmented it globally
export type AuthRequest = Request;

// Verify JWT token
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw errors.unauthorized('No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
    };
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        isArtist: true,
        isPremium: true,
      },
    });
    
    if (!user) {
      throw errors.unauthorized('User not found');
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(errors.unauthorized('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(errors.unauthorized('Token expired'));
    } else {
      next(error);
    }
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
    };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        isArtist: true,
        isPremium: true,
      },
    });
    
    if (user) {
      req.user = user;
    }
    
    next();
  } catch {
    // Silently fail for optional auth
    next();
  }
};

// Require artist role
export const requireArtist = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.isArtist) {
    return next(errors.forbidden('Artist account required'));
  }
  next();
};

// Require premium subscription
export const requirePremium = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.isPremium) {
    return next(errors.forbidden('Premium subscription required'));
  }
  next();
};
