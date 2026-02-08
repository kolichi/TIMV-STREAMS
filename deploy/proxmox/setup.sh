#!/bin/bash
# Izwei Music Backend - Proxmox Container Setup Script
# Run this script on your Proxmox container (192.168.13.136)

set -e

echo "🎵 Izwei Music Backend Setup"
echo "============================"

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node.js installation
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# Install build essentials (needed for some npm packages)
echo "📦 Installing build tools..."
apt install -y build-essential python3 git

# Install FFmpeg for audio processing
echo "📦 Installing FFmpeg..."
apt install -y ffmpeg

# Install Redis (for caching and sessions)
echo "📦 Installing Redis..."
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# Install PM2 globally for process management
echo "📦 Installing PM2..."
npm install -g pm2

# Create app directory
echo "📁 Creating application directory..."
mkdir -p /opt/izwei-music
mkdir -p /opt/izwei-music/uploads
mkdir -p /opt/izwei-music/logs

# Set permissions
chown -R www-data:www-data /opt/izwei-music

echo ""
echo "✅ Base setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy the application files to /opt/izwei-music"
echo "2. Configure the .env file"
echo "3. Run: cd /opt/izwei-music && npm install"
echo "4. Run: npx prisma migrate deploy"
echo "5. Run: pm2 start ecosystem.config.js"
echo ""
