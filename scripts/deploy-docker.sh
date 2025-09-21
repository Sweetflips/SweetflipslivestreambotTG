#!/bin/bash

# SweetflipsStreamBot Docker Deployment Script
# Run this script on your Ubuntu 24.04 VPS

set -e

echo "🐳 SweetflipsStreamBot Docker Deployment Script"
echo "==============================================="

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
print_status "Starting Docker deployment with the following configuration:"
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

# Step 2: Install Docker
print_status "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    print_success "Docker installed"
else
    print_warning "Docker already installed"
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    apt install docker-compose-plugin -y
    print_success "Docker Compose installed"
else
    print_warning "Docker Compose already installed"
fi

# Install Node.js and process managers for monitoring
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2 forever
print_success "Node.js and process managers installed"

# Step 3: Clone repository (if not already present)
if [ ! -d "$APP_DIR" ]; then
    print_status "Cloning repository..."
    apt install git -y
    read -p "Enter your Git repository URL: " REPO_URL
    git clone "$REPO_URL" "$APP_DIR"
    print_success "Repository cloned"
else
    print_warning "App directory already exists, skipping clone"
fi

# Step 4: Setup application
print_status "Setting up application..."
cd "$APP_DIR"

# Create environment file
cat > .env << EOF
# Database Configuration
DB_PASSWORD=$DB_PASSWORD

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASSWORD

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

# Cwallet Configuration
CWALLET_API_KEY=your_cwallet_api_key
CWALLET_WEBHOOK_SECRET=your_webhook_secret
CWALLET_BASE_URL=https://api.cwallet.com

# Security Configuration
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Server Configuration
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

# Create SSL directory and self-signed certificate (for testing)
print_status "Creating SSL certificate..."
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"

print_success "SSL certificate created"

# Step 5: Build and start services
print_status "Building and starting services..."
docker-compose -f docker-compose.prod.yml down --remove-orphans
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

print_success "Services started"

# Step 6: Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 30

# Step 7: Run database migrations
print_status "Running database migrations..."
docker-compose -f docker-compose.prod.yml exec api pnpm prisma:migrate
docker-compose -f docker-compose.prod.yml exec api pnpm prisma:seed

print_success "Database setup completed"

# Step 8: Configure firewall
print_status "Configuring firewall..."
apt install ufw -y
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

print_success "Firewall configured"

# Step 9: Setup log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/docker-containers << EOF
/var/lib/docker/containers/*/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 root root
}
EOF

print_success "Log rotation configured"

# Final verification
print_status "Verifying deployment..."

# Check if services are running
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    print_success "Services are running!"
else
    print_error "Some services failed to start. Check logs with: docker-compose -f docker-compose.prod.yml logs"
fi

# Test health endpoint
if curl -f -s http://localhost/healthz > /dev/null; then
    print_success "Health check passed!"
else
    print_warning "Health check failed. Service may still be starting up."
fi

echo ""
echo "🎉 Docker Deployment Complete!"
echo "=============================="
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
echo "2. Restart services: docker-compose -f docker-compose.prod.yml restart"
echo "3. Check logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "4. Test endpoints: curl https://$DOMAIN/healthz"
echo ""
echo "📊 Useful Commands:"
echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  Restart services: docker-compose -f docker-compose.prod.yml restart"
echo "  Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  Update services: docker-compose -f docker-compose.prod.yml pull && docker-compose -f docker-compose.prod.yml up -d"
echo "  Check status: docker-compose -f docker-compose.prod.yml ps"
echo ""
echo "🌐 Your bot should be accessible at: https://$DOMAIN"
echo ""

# Save configuration to file
cat > "$APP_DIR/docker-deployment-config.txt" << EOF
SweetflipsStreamBot Docker Deployment Configuration
==================================================
Deployment Date: $(date)
Domain: $DOMAIN
App Directory: $APP_DIR
Database Password: $DB_PASSWORD
Redis Password: $REDIS_PASSWORD
JWT Secret: $JWT_SECRET
Encryption Key: $ENCRYPTION_KEY

Next Steps:
1. Edit $APP_DIR/.env with your actual API keys
2. Restart services: docker-compose -f docker-compose.prod.yml restart
3. Test: curl https://$DOMAIN/healthz
EOF

print_success "Configuration saved to $APP_DIR/docker-deployment-config.txt"
print_success "Docker deployment completed successfully! 🎉"
