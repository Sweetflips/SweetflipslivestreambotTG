# SweetflipsStreamBot Deployment Guide

## 🚀 VPS Deployment Instructions

### Server Details

- **IP**: 173.212.207.42
- **OS**: Ubuntu 24.04
- **Username**: root
- **Password**: TheHype01

## 📋 Prerequisites

1. **Domain Setup** (Optional but recommended)

   - Point your domain to `173.212.207.42`
   - Set up SSL certificate (Let's Encrypt)

2. **Required Services**
   - PostgreSQL 15+
   - Redis 7+
   - Node.js 20+
   - Docker & Docker Compose
   - Nginx (for reverse proxy)

## 🔧 Step-by-Step Deployment

### 1. Connect to Your VPS

```bash
ssh root@173.212.207.42
# Password: TheHype01
```

### 2. Update System

```bash
apt update && apt upgrade -y
```

### 3. Install Required Software

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Install Nginx
apt install nginx -y

# Install PostgreSQL and Redis
apt install postgresql postgresql-contrib redis-server -y

# Install Git
apt install git -y
```

### 4. Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE sweetflips_bot;
CREATE USER sweetflips_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE sweetflips_bot TO sweetflips_user;
\q
```

### 5. Configure Redis

```bash
# Edit Redis config
nano /etc/redis/redis.conf

# Set password (uncomment and set)
requirepass your_redis_password

# Restart Redis
systemctl restart redis-server
systemctl enable redis-server
```

### 6. Clone and Setup Application

```bash
# Clone repository
git clone <your-repo-url> /opt/sweetflips-bot
cd /opt/sweetflips-bot

# Install dependencies
pnpm install

# Copy environment file
cp env.example .env
```

### 7. Configure Environment Variables

Edit the `.env` file with your actual values:

```bash
nano .env
```

**Required Configuration:**

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_actual_bot_token
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhook/telegram
TELEGRAM_MOD_GROUP_ID=-1001234567890
TELEGRAM_PAYOUT_GROUP_ID=-1001234567891
TREASURER_TELEGRAM_IDS=123456789,987654321

# Kick Chat Configuration
KICK_CHANNEL_ID=your_kick_channel_id
KICK_CHAT_WEBSOCKET_URL=wss://ws-us2.pusher.app/app/your_app_key
KICK_CHAT_WEBSOCKET_KEY=your_websocket_key
KICK_CHAT_WEBSOCKET_CLUSTER=us2

# Database Configuration
DATABASE_URL=postgresql://sweetflips_user:your_secure_password@localhost:5432/sweetflips_bot

# Redis Configuration
REDIS_URL=redis://:your_redis_password@localhost:6379

# Cwallet Configuration
CWALLET_API_KEY=your_cwallet_api_key
CWALLET_WEBHOOK_SECRET=your_webhook_secret
CWALLET_BASE_URL=https://api.cwallet.com

# Security Configuration
JWT_SECRET=your_32_character_jwt_secret_key_here
ENCRYPTION_KEY=your_32_character_encryption_key
RATE_LIMIT_REDIS_URL=redis://:your_redis_password@localhost:6379/1

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Overlay Configuration
OVERLAY_NAMESPACE=/overlay
OVERLAY_CORS_ORIGIN=https://yourdomain.com

# Game Configuration
BONUS_HUNT_MAX_GUESS=1000
TRIVIA_ANSWER_TIMEOUT=30000
LINK_CODE_EXPIRY=600000
```

### 8. Setup Database

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Seed database
pnpm prisma:seed
```

### 9. Build Application

```bash
pnpm build
```

### 10. Configure Nginx

Create Nginx configuration:

```bash
nano /etc/nginx/sites-available/sweetflips-bot
```

```nginx
server {
    listen 80;
    server_name yourdomain.com 173.212.207.42;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com 173.212.207.42;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy to application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/sweetflips-bot /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 11. Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d yourdomain.com

# Test auto-renewal
certbot renew --dry-run
```

### 12. Create Systemd Service

Create service file:

```bash
nano /etc/systemd/system/sweetflips-bot.service
```

```ini
[Unit]
Description=SweetflipsStreamBot API Service
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/sweetflips-bot
Environment=NODE_ENV=production
ExecStart=/usr/bin/node apps/api/dist/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=sweetflips-bot

[Install]
WantedBy=multi-user.target
```

Enable and start service:

```bash
systemctl daemon-reload
systemctl enable sweetflips-bot
systemctl start sweetflips-bot
systemctl status sweetflips-bot
```

### 13. Setup Log Rotation

```bash
nano /etc/logrotate.d/sweetflips-bot
```

```
/var/log/sweetflips-bot/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        systemctl reload sweetflips-bot
    endscript
}
```

### 14. Configure Firewall

```bash
# Install UFW
apt install ufw -y

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 15. Setup Monitoring (Optional)

```bash
# Install monitoring tools
apt install htop iotop nethogs -y

# Setup log monitoring
apt install fail2ban -y
```

## 🔍 Verification

### Check Services

```bash
# Check application status
systemctl status sweetflips-bot

# Check logs
journalctl -u sweetflips-bot -f

# Check database connection
sudo -u postgres psql -c "SELECT 1;" sweetflips_bot

# Check Redis connection
redis-cli -a your_redis_password ping
```

### Test Endpoints

```bash
# Health check
curl https://yourdomain.com/healthz

# Game state
curl https://yourdomain.com/state

# Overlay state
curl https://yourdomain.com/overlay/state
```

## 🚨 Troubleshooting

### Common Issues

1. **Service won't start**

   ```bash
   journalctl -u sweetflips-bot -n 50
   ```

2. **Database connection issues**

   ```bash
   sudo -u postgres psql -c "\l"
   ```

3. **Redis connection issues**

   ```bash
   redis-cli -a your_redis_password ping
   ```

4. **Nginx issues**
   ```bash
   nginx -t
   systemctl status nginx
   ```

### Log Locations

- Application logs: `journalctl -u sweetflips-bot`
- Nginx logs: `/var/log/nginx/`
- PostgreSQL logs: `/var/log/postgresql/`
- Redis logs: `/var/log/redis/`

## 🔄 Updates

To update the application:

```bash
cd /opt/sweetflips-bot
git pull
pnpm install
pnpm build
pnpm prisma:migrate
systemctl restart sweetflips-bot
```

## 📊 Monitoring

### Health Checks

- Application: `https://yourdomain.com/healthz`
- Database: Check PostgreSQL service
- Redis: Check Redis service
- Nginx: Check Nginx service

### Performance Monitoring

```bash
# System resources
htop

# Disk usage
df -h

# Memory usage
free -h

# Network usage
nethogs
```

Your SweetflipsStreamBot should now be running on your VPS! 🎉
