import { User as PrismaUser } from '@prisma/client';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      username: string;
      isArtist: boolean;
      isPremium: boolean;
      role?: string;
    }
    
    interface Request {
      user?: User;
    }
  }
}

// Type for authenticated user (subset of Prisma User)
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  isArtist: boolean;
  isPremium: boolean;
  role?: string;
}

export {};
