# 🚀 SweetflipsStreamBot VPS Deployment Summary

## 📋 Your Server Details

- **IP Address**: 173.212.207.42
- **IPv6**: 2a02:c207:2281:4::1
- **OS**: Ubuntu 24.04
- **Username**: root
- **Password**: TheHype01
- **VNC**: 5.189.145.157:63118

## 🎯 Deployment Options

I've created **3 deployment methods** for you to choose from:

### 1. 🚀 **Quick Deploy (Recommended for beginners)**

**One-command deployment** - Just run this on your VPS:

```bash
# Connect to your VPS
ssh root@173.212.207.42
# Password: TheHype01

# Run the quick deployment script
curl -sSL https://raw.githubusercontent.com/your-repo/main/quick-deploy.sh | bash
```

**What it does:**

- ✅ Installs all required software (Node.js, Docker, PostgreSQL, Redis, Nginx)
- ✅ Configures databases with secure passwords
- ✅ Sets up firewall and security
- ✅ Clones your repository
- ✅ Creates environment file with generated secrets
- ✅ Builds and starts the application
- ✅ Configures Nginx reverse proxy
- ✅ Creates systemd service for auto-start

### 2. 🐳 **Docker Deploy (Recommended for production)**

**Containerized deployment** with Docker Compose:

```bash
# Connect to your VPS
ssh root@173.212.207.42

# Clone repository
git clone <your-repo-url> /opt/sweetflips-bot
cd /opt/sweetflips-bot

# Run Docker deployment script
chmod +x scripts/deploy-docker.sh
./scripts/deploy-docker.sh
```

**What it does:**

- ✅ Sets up Docker environment
- ✅ Creates production Docker Compose stack
- ✅ Configures SSL certificates
- ✅ Sets up Nginx with rate limiting
- ✅ Creates isolated containers for each service
- ✅ Includes health checks and auto-restart

### 3. 🔧 **Manual Deploy (For advanced users)**

**Step-by-step manual setup**:

```bash
# Connect to your VPS
ssh root@173.212.207.42

# Clone repository
git clone <your-repo-url> /opt/sweetflips-bot
cd /opt/sweetflips-bot

# Run manual deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## 📝 Pre-Deployment Checklist

Before deploying, make sure you have:

### 🔑 **Required API Keys & Tokens**

- [ ] **Telegram Bot Token** - Get from [@BotFather](https://t.me/botfather)
- [ ] **Telegram Group IDs** - Your mod and payout group IDs
- [ ] **Treasurer Telegram IDs** - Admin user IDs for payouts
- [ ] **Kick Channel ID** - Your Kick streaming channel
- [ ] **Kick WebSocket Credentials** - From Kick developer settings
- [ ] **Cwallet API Key** - From Cwallet developer portal
- [ ] **Domain Name** (optional) - For SSL certificates

### 🛠 **Technical Requirements**

- [ ] **Git Repository** - Your code repository URL
- [ ] **Domain DNS** (optional) - Point to 173.212.207.42
- [ ] **SSL Certificate** (optional) - Let's Encrypt setup

## 🚀 Recommended Deployment Steps

### **Step 1: Connect to Your VPS**

```bash
ssh root@173.212.207.42
# Password: TheHype01
```

### **Step 2: Choose Your Deployment Method**

#### **Option A: Quick Deploy (Easiest)**

```bash
# Upload and run the quick deployment script
curl -sSL https://raw.githubusercontent.com/your-repo/main/quick-deploy.sh | bash
```

#### **Option B: Docker Deploy (Most Robust)**

```bash
# Clone your repository
git clone <your-repo-url> /opt/sweetflips-bot
cd /opt/sweetflips-bot

# Run Docker deployment
chmod +x scripts/deploy-docker.sh
./scripts/deploy-docker.sh
```

### **Step 3: Configure Environment**

After deployment, edit the environment file:

```bash
nano /opt/sweetflips-bot/.env
```

**Update these values with your actual credentials:**

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_actual_bot_token_here
TELEGRAM_MOD_GROUP_ID=-1001234567890
TELEGRAM_PAYOUT_GROUP_ID=-1001234567891
TREASURER_TELEGRAM_IDS=123456789,987654321

# Kick Chat Configuration
KICK_CHANNEL_ID=your_actual_kick_channel_id
KICK_CHAT_WEBSOCKET_URL=wss://ws-us2.pusher.app/app/your_actual_key
KICK_CHAT_WEBSOCKET_KEY=your_actual_websocket_key

# Cwallet Configuration
CWALLET_API_KEY=your_actual_cwallet_api_key
CWALLET_WEBHOOK_SECRET=your_actual_webhook_secret
```

### **Step 4: Restart Services**

```bash
# For systemd deployment
systemctl restart sweetflips-bot

# For Docker deployment
docker-compose -f docker-compose.prod.yml restart
```

### **Step 5: Verify Deployment**

```bash
# Test health endpoint
curl http://173.212.207.42/healthz

# Check service status
systemctl status sweetflips-bot

# View logs
journalctl -u sweetflips-bot -f
```

## 🔍 Post-Deployment Verification

### **Health Checks**

```bash
# Application health
curl http://173.212.207.42/healthz

# Game state
curl http://173.212.207.42/state

# Overlay state
curl http://173.212.207.42/overlay/state
```

### **Service Status**

```bash
# Check all services
systemctl status sweetflips-bot nginx postgresql redis-server

# Check Docker containers (if using Docker)
docker-compose -f docker-compose.prod.yml ps
```

### **Database Connection**

```bash
# Test PostgreSQL
sudo -u postgres psql -c "SELECT 1;" sweetflips_bot

# Test Redis
redis-cli -a <your_redis_password> ping
```

## 🛠 Management Commands

### **Service Management**

```bash
# Start/Stop/Restart service
systemctl start sweetflips-bot
systemctl stop sweetflips-bot
systemctl restart sweetflips-bot

# View logs
journalctl -u sweetflips-bot -f

# Check status
systemctl status sweetflips-bot
```

### **Docker Management (if using Docker)**

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Update services
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### **Database Management**

```bash
# Run migrations
cd /opt/sweetflips-bot
pnpm prisma:migrate

# Seed database
pnpm prisma:seed

# Access database
sudo -u postgres psql sweetflips_bot
```

## 🔒 Security Considerations

### **Firewall Configuration**

- ✅ SSH (port 22) - Restricted to your IP
- ✅ HTTP (port 80) - Open for web traffic
- ✅ HTTPS (port 443) - Open for secure web traffic
- ❌ All other ports - Blocked

### **SSL Certificate (Optional)**

If you have a domain name:

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d yourdomain.com
```

### **Regular Updates**

```bash
# Update system packages
apt update && apt upgrade -y

# Update application
cd /opt/sweetflips-bot
git pull
pnpm install
pnpm build
systemctl restart sweetflips-bot
```

## 📊 Monitoring & Logs

### **Log Locations**

- **Application logs**: `journalctl -u sweetflips-bot -f`
- **Nginx logs**: `/var/log/nginx/`
- **PostgreSQL logs**: `/var/log/postgresql/`
- **Redis logs**: `/var/log/redis/`
- **Docker logs**: `docker-compose -f docker-compose.prod.yml logs`

### **Performance Monitoring**

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

## 🚨 Troubleshooting

### **Common Issues**

1. **Service won't start**

   ```bash
   journalctl -u sweetflips-bot -n 50
   ```

2. **Database connection issues**

   ```bash
   sudo -u postgres psql -c "\l"
   systemctl status postgresql
   ```

3. **Redis connection issues**

   ```bash
   redis-cli -a <password> ping
   systemctl status redis-server
   ```

4. **Nginx issues**

   ```bash
   nginx -t
   systemctl status nginx
   ```

5. **Port conflicts**
   ```bash
   netstat -tlnp | grep :3000
   ```

## 🎉 Success Indicators

Your deployment is successful when:

- ✅ `curl http://173.212.207.42/healthz` returns `{"status":"ok"}`
- ✅ `systemctl status sweetflips-bot` shows "active (running)"
- ✅ Telegram webhook is set up and responding
- ✅ Database migrations completed successfully
- ✅ Redis is responding to ping
- ✅ Nginx is serving requests

## 📞 Support

If you encounter issues:

1. **Check logs**: `journalctl -u sweetflips-bot -f`
2. **Verify configuration**: Review `/opt/sweetflips-bot/.env`
3. **Test connectivity**: Check database and Redis connections
4. **Review deployment**: Ensure all services are running

## 🎯 Next Steps After Deployment

1. **Configure Telegram Bot**:

   - Set webhook URL: `https://173.212.207.42/webhook/telegram`
   - Add bot to your mod and payout groups
   - Make bot admin in groups

2. **Test Game Functionality**:

   - Start a bonus hunt via Telegram
   - Submit guesses via Kick chat
   - Verify real-time updates

3. **Setup Monitoring**:

   - Configure log rotation
   - Set up health check monitoring
   - Create backup procedures

4. **Security Hardening**:
   - Change default passwords
   - Setup SSL certificates
   - Configure fail2ban
   - Regular security updates

Your SweetflipsStreamBot should now be running on your VPS! 🎉

