import Redis from 'ioredis';
import { config } from '../config/index.js';

// Redis client for caching
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('📦 Redis connected');
});

// Cache helper functions
export const cache = {
  // Get cached data
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  // Set cached data with TTL (seconds)
  async set(key: string, value: unknown, ttl = 3600): Promise<void> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  // Delete cached data
  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },

  // Delete by pattern
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  },

  // Increment counter (for play counts, etc.)
  async incr(key: string): Promise<number> {
    try {
      return await redis.incr(key);
    } catch (error) {
      console.error('Cache incr error:', error);
      return 0;
    }
  },
};

// Cache keys
export const cacheKeys = {
  track: (id: string) => `track:${id}`,
  trackMeta: (id: string) => `track:meta:${id}`,
  user: (id: string) => `user:${id}`,
  playlist: (id: string) => `playlist:${id}`,
  trending: () => 'trending:tracks',
  newReleases: () => 'new:releases',
  search: (query: string) => `search:${query.toLowerCase().replace(/\s+/g, ':')}`,
};
