#!/bin/bash

# SweetflipsStreamBot VPS Deployment Script
# Run this script on your Ubuntu 24.04 VPS

set -e

echo "🚀 SweetflipsStreamBot VPS Deployment Script"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/sweetflips-bot"
DOMAIN=""
DB_PASSWORD=""
REDIS_PASSWORD=""
JWT_SECRET=""
ENCRYPTION_KEY=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to generate random string
generate_random_string() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root"
    exit 1
fi

# Get configuration from user
echo "📋 Configuration Setup"
echo "======================"

read -p "Enter your domain name (or press Enter to use IP): " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN="173.212.207.42"
fi

read -p "Enter database password (or press Enter to generate): " DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD=$(generate_random_string)
    print_success "Generated database password: $DB_PASSWORD"
fi

read -p "Enter Redis password (or press Enter to generate): " REDIS_PASSWORD
if [ -z "$REDIS_PASSWORD" ]; then
    REDIS_PASSWORD=$(generate_random_string)
    print_success "Generated Redis password: $REDIS_PASSWORD"
fi

read -p "Enter JWT secret (or press Enter to generate): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(generate_random_string)
    print_success "Generated JWT secret: $JWT_SECRET"
fi

read -p "Enter encryption key (or press Enter to generate): " ENCRYPTION_KEY
if [ -z "$ENCRYPTION_KEY" ]; then
    ENCRYPTION_KEY=$(generate_random_string)
    print_success "Generated encryption key: $ENCRYPTION_KEY"
fi

echo ""
print_status "Starting deployment with the following configuration:"
echo "  Domain: $DOMAIN"
echo "  App Directory: $APP_DIR"
echo "  Database Password: [HIDDEN]"
echo "  Redis Password: [HIDDEN]"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Deployment cancelled"
    exit 1
fi

# Step 1: Update system
print_status "Updating system packages..."
apt update && apt upgrade -y
print_success "System updated"

# Step 2: Install required software
print_status "Installing required software..."

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

# Install Nginx
apt install nginx -y

# Install PostgreSQL and Redis
apt install postgresql postgresql-contrib redis-server -y

# Install Git
apt install git -y

# Install additional tools and process managers
apt install htop iotop nethogs fail2ban ufw -y

# Install PM2 and Forever for process management
npm install -g pm2 forever

print_success "Software installed"

# Step 3: Configure PostgreSQL
print_status "Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE sweetflips_bot;"
sudo -u postgres psql -c "CREATE USER sweetflips_user WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sweetflips_bot TO sweetflips_user;"
print_success "PostgreSQL configured"

# Step 4: Configure Redis
print_status "Configuring Redis..."
sed -i "s/# requirepass foobared/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server
print_success "Redis configured"

# Step 5: Clone repository (if not already present)
if [ ! -d "$APP_DIR" ]; then
    print_status "Cloning repository..."
    read -p "Enter your Git repository URL: " REPO_URL
    git clone "$REPO_URL" "$APP_DIR"
    print_success "Repository cloned"
else
    print_warning "App directory already exists, skipping clone"
fi

# Step 6: Setup application
print_status "Setting up application..."
cd "$APP_DIR"

# Install dependencies
pnpm install

# Create environment file
cat > .env << EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_WEBHOOK_URL=https://$DOMAIN/webhook/telegram
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
OVERLAY_CORS_ORIGIN=https://$DOMAIN

# Game Configuration
BONUS_HUNT_MAX_GUESS=1000
TRIVIA_ANSWER_TIMEOUT=30000
LINK_CODE_EXPIRY=600000
EOF

print_success "Environment file created"

# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Seed database
pnpm prisma:seed

# Build application
pnpm build

print_success "Application built"

# Step 7: Configure Nginx
print_status "Configuring Nginx..."
cat > /etc/nginx/sites-available/sweetflips-bot << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Proxy to application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/sweetflips-bot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx
systemctl enable nginx

print_success "Nginx configured"

# Step 8: Create systemd service with auto-restart
print_status "Creating systemd service with auto-restart..."
cat > /etc/systemd/system/sweetflips-bot.service << EOF
[Unit]
Description=SweetflipsStreamBot Service
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=AUTO_RESTART_ENABLED=true
Environment=HEALTH_CHECK_INTERVAL=30000
Environment=MAX_RESTART_ATTEMPTS=10
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=5
StartLimitInterval=60s
StartLimitBurst=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=sweetflips-bot
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable sweetflips-bot

print_success "Systemd service created"

# Create PM2 ecosystem file for additional process management
print_status "Creating PM2 ecosystem configuration..."
cat > "$APP_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'sweetflips-bot',
    script: 'bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      AUTO_RESTART_ENABLED: 'true',
      HEALTH_CHECK_INTERVAL: '30000',
      MAX_RESTART_ATTEMPTS: '10'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

print_success "PM2 ecosystem configuration created"

# Step 9: Configure firewall
print_status "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

print_success "Firewall configured"

# Step 10: Setup log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/sweetflips-bot << EOF
/var/log/syslog {
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
EOF

print_success "Log rotation configured"

# Step 11: Setup SSL (if domain is provided and not IP)
if [[ "$DOMAIN" != *"."* ]] || [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_warning "Skipping SSL setup for IP address. Configure SSL manually if needed."
else
    print_status "Setting up SSL certificate..."
    apt install certbot python3-certbot-nginx -y

    # Get SSL certificate
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN

    print_success "SSL certificate configured"
fi

# Final steps
print_status "Finalizing deployment..."

# Start the application
systemctl start sweetflips-bot

# Wait a moment for the service to start
sleep 5

# Check service status
if systemctl is-active --quiet sweetflips-bot; then
    print_success "SweetflipsStreamBot is running!"
else
    print_error "Service failed to start. Check logs with: journalctl -u sweetflips-bot -f"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "📋 Configuration Summary:"
echo "  Domain: $DOMAIN"
echo "  App Directory: $APP_DIR"
echo "  Database Password: $DB_PASSWORD"
echo "  Redis Password: $REDIS_PASSWORD"
echo "  JWT Secret: $JWT_SECRET"
echo "  Encryption Key: $ENCRYPTION_KEY"
echo ""
echo "🔧 Next Steps:"
echo "1. Edit $APP_DIR/.env with your actual API keys and tokens"
echo "2. Restart the service: systemctl restart sweetflips-bot"
echo "3. Check logs: journalctl -u sweetflips-bot -f"
echo "4. Test endpoints: curl http://$DOMAIN/healthz"
echo ""
echo "📊 Useful Commands:"
echo "  Service status: systemctl status sweetflips-bot"
echo "  View logs: journalctl -u sweetflips-bot -f"
echo "  Restart service: systemctl restart sweetflips-bot"
echo "  Check Nginx: systemctl status nginx"
echo "  Check database: sudo -u postgres psql sweetflips_bot"
echo "  Check Redis: redis-cli -a $REDIS_PASSWORD ping"
echo ""
echo "🌐 Your bot should be accessible at: http://$DOMAIN"
echo ""

# Save configuration to file
cat > "$APP_DIR/deployment-config.txt" << EOF
SweetflipsStreamBot Deployment Configuration
===========================================
Deployment Date: $(date)
Domain: $DOMAIN
App Directory: $APP_DIR
Database Password: $DB_PASSWORD
Redis Password: $REDIS_PASSWORD
JWT Secret: $JWT_SECRET
Encryption Key: $ENCRYPTION_KEY

Next Steps:
1. Edit $APP_DIR/.env with your actual API keys
2. Restart service: systemctl restart sweetflips-bot
3. Test: curl http://$DOMAIN/healthz
EOF

print_success "Configuration saved to $APP_DIR/deployment-config.txt"
print_success "Deployment completed successfully! 🎉"
