# Izwei Music - Proxmox Container Deployment Guide

## Prerequisites

Your container at `192.168.13.136` should have:
- ✅ PostgreSQL installed
- Nginx (for reverse proxy from `backend-development.iswe.co.zm`)

---

## Step 1: Run Initial Setup on Container

SSH into your container and run:

```bash
# Download and run setup script
curl -sSL https://raw.githubusercontent.com/kolichi/TIMV-STREAMS/main/deploy/proxmox/setup.sh | bash

# Or manually copy and run:
chmod +x setup.sh
./setup.sh
```

This installs:
- Node.js 20.x
- Redis
- FFmpeg
- PM2

---

## Step 2: Setup PostgreSQL Database

On the container:

```bash
# Edit the script first to set your password!
nano setup-database.sh

# Then run it
chmod +x setup-database.sh
./setup-database.sh
```

---

## Step 3: Configure Environment Variables

On the container:

```bash
# Copy the template
cp /path/to/.env.production /opt/izwei-music/.env

# Edit with your values
nano /opt/izwei-music/.env
```

**Required values to set:**
- `DATABASE_URL` - Your PostgreSQL connection string
- `JWT_SECRET` - Generate with: `openssl rand -base64 64`
- `JWT_REFRESH_SECRET` - Generate another one
- `FACEBOOK_APP_ID` & `FACEBOOK_APP_SECRET` - From Facebook Developer Console
- `SMTP_USER` & `SMTP_PASS` - For magic link emails

---

## Step 4: Configure Nginx

On your reverse proxy server:

```bash
# Copy the nginx config
sudo cp nginx-backend.conf /etc/nginx/sites-available/izwei-backend

# Create symlink
sudo ln -s /etc/nginx/sites-available/izwei-backend /etc/nginx/sites-enabled/

# Update SSL certificate paths in the config
sudo nano /etc/nginx/sites-available/izwei-backend

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 5: Deploy the Application

From your LOCAL machine:

```bash
cd /home/collins/Desktop/Stream

# Make deploy script executable
chmod +x deploy/proxmox/deploy.sh

# Deploy!
./deploy/proxmox/deploy.sh
```

---

## Step 6: Setup PM2 Startup

On the container (ensures app starts on reboot):

```bash
pm2 startup
pm2 save
```

---

## Useful Commands

```bash
# Check app status
pm2 status

# View logs
pm2 logs izwei-music-api

# Restart app
pm2 restart izwei-music-api

# View real-time metrics
pm2 monit

# Check nginx status
systemctl status nginx

# Check Redis status
systemctl status redis-server
```

---

## Update Frontend to Use New Backend

Update your frontend environment variable:

```env
VITE_API_URL=https://backend-development.iswe.co.zm/api
```

---

## Troubleshooting

### Database connection issues
```bash
# Test PostgreSQL connection
psql -U izwei -d izwei_music -h localhost

# Check PostgreSQL is running
systemctl status postgresql
```

### App won't start
```bash
# Check logs
pm2 logs izwei-music-api --lines 100

# Check if port is in use
lsof -i :3001
```

### Nginx 502 Bad Gateway
```bash
# Check if app is running
pm2 status

# Check nginx error logs
tail -f /var/log/nginx/izwei-backend-error.log
```

### Upload issues
```bash
# Check upload directory permissions
ls -la /opt/izwei-music/uploads

# Fix permissions if needed
chown -R www-data:www-data /opt/izwei-music/uploads
chmod 755 /opt/izwei-music/uploads
```

---

## Security Checklist

- [ ] Change default database password
- [ ] Generate strong JWT secrets
- [ ] Configure SSL certificates
- [ ] Set up firewall (only allow 80, 443, 22)
- [ ] Configure fail2ban
- [ ] Enable automatic security updates
