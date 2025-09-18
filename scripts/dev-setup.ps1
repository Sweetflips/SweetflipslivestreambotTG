# SweetflipsStreamBot Development Setup Script (PowerShell)

Write-Host "🚀 Setting up SweetflipsStreamBot development environment..." -ForegroundColor Green

# Check if pnpm is installed
try {
    pnpm --version | Out-Null
    Write-Host "✅ pnpm is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ pnpm is not installed. Please install pnpm first:" -ForegroundColor Red
    Write-Host "npm install -g pnpm" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker first." -ForegroundColor Red
    exit 1
}

# Check if docker-compose is installed
try {
    docker-compose --version | Out-Null
    Write-Host "✅ docker-compose is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ docker-compose is not installed. Please install docker-compose first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
pnpm install

# Copy environment file
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Blue
    Copy-Item "env.example" ".env"
    Write-Host "⚠️  Please edit .env file with your configuration before continuing" -ForegroundColor Yellow
    Write-Host "   Required: Telegram bot token, Kick channel ID, database URLs, etc." -ForegroundColor Yellow
    Read-Host "Press Enter when you've configured .env file"
}

# Start Docker services
Write-Host "🐳 Starting Docker services..." -ForegroundColor Blue
docker-compose up -d postgres redis

# Wait for services to be ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Blue
Start-Sleep -Seconds 10

# Generate Prisma client
Write-Host "🔧 Generating Prisma client..." -ForegroundColor Blue
pnpm prisma:generate

# Run database migrations
Write-Host "🗄️  Running database migrations..." -ForegroundColor Blue
pnpm prisma:migrate

# Seed database
Write-Host "🌱 Seeding database..." -ForegroundColor Blue
pnpm prisma:seed

Write-Host "✅ Development environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Make sure your .env file is properly configured" -ForegroundColor White
Write-Host "2. Run 'pnpm dev' to start the development server" -ForegroundColor White
Write-Host "3. Run 'pnpm test' to run the test suite" -ForegroundColor White
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  pnpm dev          - Start development server" -ForegroundColor White
Write-Host "  pnpm test         - Run tests" -ForegroundColor White
Write-Host "  pnpm build        - Build for production" -ForegroundColor White
Write-Host "  pnpm lint         - Run linter" -ForegroundColor White
Write-Host "  pnpm docker:up    - Start all Docker services" -ForegroundColor White
Write-Host "  pnpm docker:down  - Stop all Docker services" -ForegroundColor White
Write-Host "  pnpm docker:logs  - View Docker logs" -ForegroundColor White

