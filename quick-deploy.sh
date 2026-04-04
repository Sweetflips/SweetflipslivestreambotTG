#!/bin/bash

# Quick deployment script for SweetflipsStreamBot
# Run this directly on your VPS: curl -sSL https://raw.githubusercontent.com/your-repo/main/quick-deploy.sh | bash

set -e

echo "🚀 SweetflipsStreamBot Quick Deployment"
echo "======================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo bash $0"
    exit 1
fi

# Update system
echo "📦 Updating system..."
apt update && apt upgrade -y

# Install required software
echo "🔧 Installing software..."
apt install -y curl wget git

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Install PostgreSQL and Redis
apt install postgresql postgresql-contrib redis-server -y

# Install Nginx
apt install nginx -y

# Install additional tools
apt install htop ufw fail2ban -y

echo "✅ Software installed successfully!"

# Configure PostgreSQL
echo "🗄️ Configuring PostgreSQL..."
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
sudo -u postgres psql -c "CREATE DATABASE sweetflips_bot;"
sudo -u postgres psql -c "CREATE USER sweetflips_user WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sweetflips_bot TO sweetflips_user;"

# Configure Redis
echo "🔴 Configuring Redis..."
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
sed -i "s/# requirepass foobared/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

# Configure firewall
echo "🔥 Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "✅ System configured successfully!"

# Get repository URL
echo ""
echo "📋 Repository Setup"
echo "==================="
read -p "Enter your Git repository URL: " REPO_URL

# Clone repository
echo "📥 Cloning repository..."
git clone "$REPO_URL" /opt/sweetflips-bot
cd /opt/sweetflips-bot

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Create environment file
echo "⚙️ Creating environment file..."
JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

cat > .env << EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_WEBHOOK_URL=https://173.212.207.42/webhook/telegram
TELEGRAM_MOD_GROUP_ID=-1001234567890
TELEGRAM_PAYOUT_GROUP_ID=-1001234567891
TREASURER_TELEGRAM_IDS=123456789,987654321

# Kick Chat Configuration
KICK_CHANNEL_ID=your_kick_channel_id
KICK_CHAT_WEBSOCKET_URL=wss://ws-us2.pusher.app/app/your_app_key
KICK_CHAT_WEBSOCKET_KEY=your_websocket_key
KICK_CHAT_WEBSOCKET_CLUSTER=us2

# Database Configuration
DATABASE_URL=postgresql://sweetflips_user:$DB_PASSWORD@localhost:5432/sweetflips_bot

# Redis Configuration
REDIS_URL=redis://:$REDIS_PASSWORD@localhost:6379

# Cwallet Configuration
CWALLET_API_KEY=your_cwallet_api_key
CWALLET_WEBHOOK_SECRET=your_webhook_secret
CWALLET_BASE_URL=https://api.cwallet.com

# Security Configuration
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
RATE_LIMIT_REDIS_URL=redis://:$REDIS_PASSWORD@localhost:6379/1

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Overlay Configuration
OVERLAY_NAMESPACE=/overlay
OVERLAY_CORS_ORIGIN=https://173.212.207.42

# Game Configuration
BONUS_HUNT_MAX_GUESS=1000
TRIVIA_ANSWER_TIMEOUT=30000
LINK_CODE_EXPIRY=600000
EOF

# Setup database
echo "🗄️ Setting up database..."
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed

# Build application
echo "🔨 Building application..."
pnpm build

# Configure Nginx
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/sweetflips-bot << 'EOF'
server {
    listen 80;
    server_name 173.212.207.42;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

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
EOF

# Enable site
ln -sf /etc/nginx/sites-available/sweetflips-bot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl reload nginx
systemctl enable nginx

# Create systemd service
echo "⚙️ Creating systemd service..."
cat > /etc/systemd/system/sweetflips-bot.service << EOF
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
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable sweetflips-bot
systemctl start sweetflips-bot

# Wait for service to start
sleep 5

# Check service status
if systemctl is-active --quiet sweetflips-bot; then
    echo "✅ SweetflipsStreamBot is running!"
else
    echo "❌ Service failed to start. Check logs with: journalctl -u sweetflips-bot -f"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "📋 Configuration Summary:"
echo "  Server IP: 173.212.207.42"
echo "  App Directory: /opt/sweetflips-bot"
echo "  Database Password: $DB_PASSWORD"
echo "  Redis Password: $REDIS_PASSWORD"
echo "  JWT Secret: $JWT_SECRET"
echo "  Encryption Key: $ENCRYPTION_KEY"
echo ""
echo "🔧 Next Steps:"
echo "1. Edit /opt/sweetflips-bot/.env with your actual API keys and tokens"
echo "2. Restart the service: systemctl restart sweetflips-bot"
echo "3. Check logs: journalctl -u sweetflips-bot -f"
echo "4. Test endpoints: curl http://173.212.207.42/healthz"
echo ""
echo "📊 Useful Commands:"
echo "  Service status: systemctl status sweetflips-bot"
echo "  View logs: journalctl -u sweetflips-bot -f"
echo "  Restart service: systemctl restart sweetflips-bot"
echo "  Check Nginx: systemctl status nginx"
echo "  Check database: sudo -u postgres psql sweetflips_bot"
echo "  Check Redis: redis-cli -a $REDIS_PASSWORD ping"
echo ""
echo "🌐 Your bot should be accessible at: http://173.212.207.42"
echo ""

# Save configuration
cat > /opt/sweetflips-bot/deployment-config.txt << EOF
SweetflipsStreamBot Deployment Configuration
===========================================
Deployment Date: $(date)
Server IP: 173.212.207.42
App Directory: /opt/sweetflips-bot
Database Password: $DB_PASSWORD
Redis Password: $REDIS_PASSWORD
JWT Secret: $JWT_SECRET
Encryption Key: $ENCRYPTION_KEY

Next Steps:
1. Edit /opt/sweetflips-bot/.env with your actual API keys
2. Restart service: systemctl restart sweetflips-bot
3. Test: curl http://173.212.207.42/healthz
EOF

echo "✅ Configuration saved to /opt/sweetflips-bot/deployment-config.txt"
echo "✅ Quick deployment completed successfully! 🎉"

