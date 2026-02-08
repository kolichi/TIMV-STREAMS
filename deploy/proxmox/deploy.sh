#!/bin/bash
# Izwei Music - Deploy Script
# Run this from your LOCAL machine to deploy to the Proxmox container

set -e

# Configuration
REMOTE_USER="root"
REMOTE_HOST="192.168.13.136"
REMOTE_PATH="/opt/izwei-music"
LOCAL_PATH="/home/collins/Desktop/Stream"

echo "🚀 Deploying Izwei Music Backend to Proxmox Container"
echo "====================================================="

# Build the server locally
echo "📦 Building server..."
cd "$LOCAL_PATH/packages/server"
npm run build

# Create deployment package
echo "📦 Creating deployment package..."
cd "$LOCAL_PATH"

# Create temp directory for deployment
rm -rf /tmp/izwei-deploy
mkdir -p /tmp/izwei-deploy

# Copy server files
cp -r packages/server/dist /tmp/izwei-deploy/
cp -r packages/server/prisma /tmp/izwei-deploy/
cp packages/server/package.json /tmp/izwei-deploy/
cp packages/server/package-lock.json /tmp/izwei-deploy/ 2>/dev/null || true

# Copy deployment configs
cp deploy/proxmox/ecosystem.config.js /tmp/izwei-deploy/

echo "📤 Uploading to server..."
# Create remote directory if it doesn't exist
ssh ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_PATH}"

# Sync files
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.env' \
    --exclude 'uploads/*' \
    /tmp/izwei-deploy/ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/

echo "📦 Installing dependencies on server..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && npm install --production"

echo "🗄️ Running database migrations..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && npx prisma migrate deploy"

echo "🔄 Restarting application..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && pm2 restart ecosystem.config.js --update-env || pm2 start ecosystem.config.js"

echo "💾 Saving PM2 process list..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "pm2 save"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Check status with: ssh ${REMOTE_USER}@${REMOTE_HOST} 'pm2 status'"
echo "View logs with: ssh ${REMOTE_USER}@${REMOTE_HOST} 'pm2 logs izwei-music-api'"
