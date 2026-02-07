# 🎵 Stream - Music Streaming Platform

A modern, high-performance music streaming platform built with React, Node.js, and PostgreSQL. Designed to be user-friendly, optimized for low bandwidth, and feature-rich like Spotify.

![Stream Platform](https://img.shields.io/badge/Stream-Music%20Platform-8B5CF6?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

## ✨ Features

### 🎧 Core Features
- **Seamless Audio Streaming** - Optimized chunked streaming with range requests
- **Multi-Quality Support** - 64/128/256 kbps options for data saving
- **Adaptive Streaming** - Automatically adjusts quality based on connection
- **Offline Support** - PWA with service worker caching
- **Queue Management** - Full playlist controls with shuffle/repeat

### 👤 User Features
- **Artist & Listener Accounts** - Different account types for different needs
- **Easy Upload** - Drag-and-drop with multi-file support
- **Playlists** - Create and manage personal playlists
- **Like System** - Save favorite tracks
- **Follow Artists** - Stay updated with favorite artists
- **Play History** - Track what you've been listening to

### ⚡ Performance Optimizations
- **Redis Caching** - Fast data retrieval
- **Efficient Streaming** - 64KB chunk size for smooth playback
- **Image Optimization** - Compressed thumbnails with Sharp
- **Gzip Compression** - Reduced payload sizes
- **Connection Pooling** - Efficient database connections
- **Rate Limiting** - Protection against abuse

### 🎨 User Experience
- **Modern UI** - Clean, Spotify-inspired dark theme
- **Mobile Responsive** - Full-screen mobile player
- **Smooth Animations** - Framer Motion transitions
- **Search** - Real-time search across tracks, artists, albums
- **Waveform Display** - Visual audio representation

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **PostgreSQL** 14 or higher
- **Redis** 6 or higher
- **FFmpeg** (for audio processing)

### Installation

1. **Clone and install dependencies:**

```bash
cd Stream
npm install
```

2. **Set up the database:**

```bash
# Start PostgreSQL and Redis
sudo systemctl start postgresql redis

# Create database
createdb stream_db
```

3. **Configure environment:**

```bash
cd packages/server
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/stream_db"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secrets (generate strong secrets!)
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
```

4. **Initialize database:**

```bash
cd packages/server
npx prisma db push
npx prisma generate
```

5. **Start development servers:**

```bash
# From root directory
npm run dev
```

This starts both:
- **Backend** at `http://localhost:3001`
- **Frontend** at `http://localhost:5173`

## 📁 Project Structure

```
Stream/
├── packages/
│   ├── server/             # Backend API
│   │   ├── src/
│   │   │   ├── config/     # Configuration
│   │   │   ├── db/         # Database clients
│   │   │   ├── middleware/ # Express middleware
│   │   │   └── routes/     # API routes
│   │   └── prisma/
│   │       └── schema.prisma
│   │
│   └── client/             # Frontend React App
│       ├── src/
│       │   ├── components/ # Reusable components
│       │   ├── pages/      # Page components
│       │   ├── store/      # Zustand state
│       │   └── lib/        # Utilities & API client
│       └── public/
│
└── uploads/                # User uploaded files
```

## 🔧 Configuration

### Audio Quality Settings

The platform supports three quality levels:

| Quality | Bitrate | File Size (3min) | Best For |
|---------|---------|------------------|----------|
| Low     | 64 kbps | ~1.4 MB         | Data saving |
| Medium  | 128 kbps| ~2.9 MB         | Balanced |
| High    | 256 kbps| ~5.8 MB         | Best quality |

Users can switch quality in the player settings.

### Rate Limiting

Default limits (configurable):
- **General**: 100 requests/15 min
- **Auth**: 5 attempts/15 min
- **Uploads**: 10 files/hour

## 🛠️ API Endpoints

### Authentication
```
POST /api/auth/register    # Create account
POST /api/auth/login       # Sign in
POST /api/auth/refresh     # Refresh token
POST /api/auth/logout      # Sign out
```

### Tracks
```
GET  /api/tracks           # List tracks
GET  /api/tracks/:id       # Get track
POST /api/tracks/:id/like  # Like/unlike
GET  /api/tracks/liked     # Get liked tracks
```

### Streaming
```
GET /api/stream/:id        # Stream audio (supports range)
GET /api/stream/:id?quality=low|medium|high
```

### Upload
```
POST /api/upload           # Upload track(s)
POST /api/upload/cover     # Upload cover image
```

### Users
```
GET  /api/users/:username         # Get profile
GET  /api/users/:username/tracks  # Get user tracks
POST /api/users/:username/follow  # Follow/unfollow
```

### Search
```
GET /api/search?q=query&type=all|tracks|artists|albums|playlists
```

## 📱 Mobile Experience

The app is designed mobile-first with:
- Bottom navigation bar on mobile
- Full-screen player experience
- Swipe gestures for navigation
- Optimized touch targets
- PWA support for installation

## 🎨 Theming

The app uses a custom Tailwind theme with CSS variables:

```css
:root {
  --primary: #8B5CF6;     /* Violet */
  --accent: #EC4899;       /* Pink */
  --surface-50: #FAFAFA;   /* Lightest */
  --surface-950: #0A0A0A;  /* Darkest */
}
```

## 🔐 Security

- **Bcrypt** password hashing (12 rounds)
- **JWT** with refresh token rotation
- **Helmet** security headers
- **CORS** with whitelist
- **Rate limiting** per endpoint
- **Input validation** on all routes

## 📊 Database Schema

Key models:
- **User** - Account info, profile, settings
- **Track** - Audio files, metadata, waveform
- **Album** - Track collections
- **Playlist** - User-created collections
- **PlayHistory** - Listening analytics
- **Follow** - Social connections

## 🚢 Deployment

### Production Build

```bash
# Build both packages
npm run build

# Server builds to packages/server/dist
# Client builds to packages/client/dist
```

### Environment Variables (Production)

```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
JWT_SECRET="strong-secret-here"
JWT_REFRESH_SECRET="another-strong-secret"
FRONTEND_URL="https://your-domain.com"
```

### Docker (Optional)

```dockerfile
# Dockerfile example
FROM node:18-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3001
CMD ["npm", "run", "start:server"]
```

## 🧪 Development Tips

### Adding a New Route

1. Create route file in `packages/server/src/routes/`
2. Add to `packages/server/src/index.ts`
3. Add types if needed in client

### Adding a New Page

1. Create page in `packages/client/src/pages/`
2. Add route in `packages/client/src/App.tsx`
3. Update navigation if needed

### Database Changes

```bash
# Edit schema.prisma, then:
cd packages/server
npx prisma db push
npx prisma generate
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📝 License

MIT License - feel free to use this project for learning or building your own music platform!

---

Built with ❤️ for music lovers everywhere
