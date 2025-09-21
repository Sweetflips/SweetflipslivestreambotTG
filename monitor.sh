#!/bin/bash

# SweetflipsStreamBot Monitoring Script
# This script monitors the bot and restarts it if needed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BOT_NAME="sweetflips-bot"
LOG_DIR="./logs"
MAX_RESTARTS=10
CHECK_INTERVAL=30
RESTART_DELAY=5

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR]${NC} $1"
}

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to check if bot is running
check_bot_status() {
    if command -v pm2 &> /dev/null; then
        pm2 list | grep -q "$BOT_NAME.*online" && return 0 || return 1
    elif command -v forever &> /dev/null; then
        forever list | grep -q "$BOT_NAME" && return 0 || return 1
    else
        pgrep -f "node.*bot.js" > /dev/null && return 0 || return 1
    fi
}

# Function to start the bot
start_bot() {
    print_status "Starting bot..."

    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js
        print_success "Bot started with PM2"
    elif command -v forever &> /dev/null; then
        forever start -c "node bot.js" --uid "$BOT_NAME" bot.js
        print_success "Bot started with Forever"
    else
        nohup node bot.js > "$LOG_DIR/bot.log" 2>&1 &
        print_success "Bot started with nohup"
    fi
}

# Function to restart the bot
restart_bot() {
    print_warning "Restarting bot..."

    if command -v pm2 &> /dev/null; then
        pm2 restart "$BOT_NAME"
    elif command -v forever &> /dev/null; then
        forever restart "$BOT_NAME"
    else
        pkill -f "node.*bot.js" || true
        sleep 2
        start_bot
    fi

    print_success "Bot restarted"
}

# Function to stop the bot
stop_bot() {
    print_status "Stopping bot..."

    if command -v pm2 &> /dev/null; then
        pm2 stop "$BOT_NAME" || true
    elif command -v forever &> /dev/null; then
        forever stop "$BOT_NAME" || true
    else
        pkill -f "node.*bot.js" || true
    fi

    print_success "Bot stopped"
}

# Function to get bot status
get_bot_status() {
    if command -v pm2 &> /dev/null; then
        pm2 list | grep "$BOT_NAME" || echo "Bot not found in PM2"
    elif command -v forever &> /dev/null; then
        forever list | grep "$BOT_NAME" || echo "Bot not found in Forever"
    else
        pgrep -f "node.*bot.js" && echo "Bot process found" || echo "Bot process not found"
    fi
}

# Main monitoring loop
monitor_loop() {
    local restart_count=0

    print_status "Starting bot monitoring..."
    print_status "Check interval: ${CHECK_INTERVAL}s"
    print_status "Max restarts: $MAX_RESTARTS"

    while true; do
        if check_bot_status; then
            print_success "Bot is running normally"
            restart_count=0  # Reset restart count on successful check
        else
            print_error "Bot is not running!"

            if [ $restart_count -lt $MAX_RESTARTS ]; then
                restart_count=$((restart_count + 1))
                print_warning "Restart attempt $restart_count/$MAX_RESTARTS"

                restart_bot
                sleep $RESTART_DELAY
            else
                print_error "Maximum restart attempts reached. Stopping monitoring."
                exit 1
            fi
        fi

        sleep $CHECK_INTERVAL
    done
}

# Handle command line arguments
case "${1:-monitor}" in
    "start")
        start_bot
        ;;
    "stop")
        stop_bot
        ;;
    "restart")
        restart_bot
        ;;
    "status")
        get_bot_status
        ;;
    "monitor")
        monitor_loop
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|monitor}"
        echo "  start   - Start the bot"
        echo "  stop    - Stop the bot"
        echo "  restart - Restart the bot"
        echo "  status  - Show bot status"
        echo "  monitor - Start monitoring loop (default)"
        exit 1
        ;;
esac
