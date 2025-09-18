#!/bin/bash

# SweetflipsStreamBot Development Setup Script

set -e

echo "🚀 Setting up SweetflipsStreamBot development environment..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first:"
    echo "npm install -g pnpm"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing"
    echo "   Required: Telegram bot token, Kick channel ID, database URLs, etc."
    read -p "Press Enter when you've configured .env file..."
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Generate Prisma client
echo "🔧 Generating Prisma client..."
pnpm prisma:generate

# Run database migrations
echo "🗄️  Running database migrations..."
pnpm prisma:migrate

# Seed database
echo "🌱 Seeding database..."
pnpm prisma:seed

echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure your .env file is properly configured"
echo "2. Run 'pnpm dev' to start the development server"
echo "3. Run 'pnpm test' to run the test suite"
echo ""
echo "Available commands:"
echo "  pnpm dev          - Start development server"
echo "  pnpm test         - Run tests"
echo "  pnpm build        - Build for production"
echo "  pnpm lint         - Run linter"
echo "  pnpm docker:up    - Start all Docker services"
echo "  pnpm docker:down  - Stop all Docker services"
echo "  pnpm docker:logs  - View Docker logs"

