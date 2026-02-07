# 🚀 Deploying Stream to Vercel

This guide will walk you through deploying the Stream music platform to Vercel with all required services.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel        │     │   Vercel        │     │   Neon/Vercel   │
│   (Frontend)    │────▶│   Serverless    │────▶│   PostgreSQL    │
│   React App     │     │   (Backend)     │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                ┌───────▼───────┐ ┌───────▼───────┐
                │   Upstash     │ │   Vercel Blob │
                │   Redis       │ │   (Storage)   │
                └───────────────┘ └───────────────┘
```

## Step 1: Set Up External Services

### 1.1 Database - Neon (Free PostgreSQL)

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project called "stream-db"
3. Copy the connection string (looks like: `postgresql://user:pass@host/db?sslmode=require`)

### 1.2 Redis - Upstash (Free)

1. Go to [upstash.com](https://upstash.com) and sign up
2. Create a new Redis database
3. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 1.3 File Storage - Vercel Blob

1. This will be set up automatically when you deploy to Vercel
2. Or use Cloudinary for audio files (free tier: 25GB)

---

## Step 2: Prepare Your Repository

### 2.1 Push to GitHub

```bash
cd /home/collins/Desktop/Stream
git init
git add .
git commit -m "Initial commit - Stream music platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stream-music.git
git push -u origin main
```

---

## Step 3: Deploy Backend to Vercel

### 3.1 Deploy via CLI

```bash
cd packages/server
npx vercel
```

### 3.2 Set Environment Variables

In your Vercel dashboard for the backend project, add these environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon PostgreSQL URL |
| `REDIS_URL` | Your Upstash Redis URL |
| `JWT_SECRET` | Generate: `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | Generate: `openssl rand -base64 64` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Your frontend Vercel URL |

### 3.3 Run Database Migration

After deployment, run migrations:
```bash
npx prisma db push
```

---

## Step 4: Deploy Frontend to Vercel

### 4.1 Update API URL

Edit `packages/client/src/lib/api.ts` and update the base URL:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-backend.vercel.app/api';
```

### 4.2 Deploy via CLI

```bash
cd packages/client
npx vercel
```

### 4.3 Set Environment Variables

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | Your backend URL (e.g., `https://stream-api.vercel.app/api`) |

---

## Step 5: Configure File Uploads for Production

For production, you'll need cloud storage. Here are two options:

### Option A: Vercel Blob (Recommended)

1. Install the package:
```bash
npm install @vercel/blob
```

2. The upload route will need modification to use Vercel Blob instead of local storage.

### Option B: Cloudinary (For Audio)

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Get your Cloud Name, API Key, and API Secret
3. Add to environment variables

---

## Quick Deploy Checklist

- [ ] Create Neon PostgreSQL database
- [ ] Create Upstash Redis instance  
- [ ] Push code to GitHub
- [ ] Deploy backend to Vercel
- [ ] Set backend environment variables
- [ ] Run `prisma db push`
- [ ] Deploy frontend to Vercel
- [ ] Set frontend environment variables
- [ ] Update CORS origins in backend
- [ ] Test the deployment!

---

## Environment Variables Summary

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@host/stream_db?sslmode=require
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
```

### Frontend
```
VITE_API_URL=https://your-backend.vercel.app/api
```

---

## Troubleshooting

### "Database connection failed"
- Check your DATABASE_URL is correct
- Ensure `?sslmode=require` is at the end for Neon

### "Redis connection error"  
- Verify REDIS_URL format for Upstash

### "CORS error"
- Update FRONTEND_URL in backend env vars
- Redeploy backend

### "File upload not working"
- Vercel has a 4.5MB limit for serverless functions
- Use Vercel Blob or Cloudinary for large files

---

## Alternative: Railway (Easier for Backend)

If Vercel serverless is too limiting, deploy the backend to [Railway](https://railway.app):

1. Connect your GitHub repo
2. Railway auto-detects Node.js
3. Add environment variables
4. Get your Railway URL
5. Update frontend to use Railway backend URL

Railway is better for:
- Long-running processes
- Larger file uploads
- Traditional server architecture
- WebSocket support (future features)

---

## Cost Estimate (Free Tiers)

| Service | Free Tier |
|---------|-----------|
| Vercel | 100GB bandwidth/month |
| Neon PostgreSQL | 0.5GB storage |
| Upstash Redis | 10,000 requests/day |
| Cloudinary | 25GB storage |

**Total: $0/month** for small projects!
