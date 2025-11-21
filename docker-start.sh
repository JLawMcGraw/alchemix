#!/bin/bash

# AlcheMix Docker Compose Quick Start Script

echo "🧪 AlcheMix Docker Setup"
echo "========================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found"
    echo "Copying .env.docker to .env..."
    cp .env.docker .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your API keys:"
    echo "   - OPENAI_API_KEY"
    echo "   - ANTHROPIC_API_KEY"
    echo "   - JWT_SECRET"
    echo ""
    read -p "Press Enter after updating .env to continue..."
fi

# Check if MemMachine directory exists
if [ ! -d "../memmachine" ]; then
    echo "❌ Error: MemMachine directory not found"
    echo "Expected: ../memmachine"
    echo ""
    echo "Please clone MemMachine:"
    echo "  cd .."
    echo "  git clone https://github.com/MemMachine/MemMachine.git memmachine"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""
echo "Starting services..."
echo "This may take 5-10 minutes on first run (downloading images)..."
echo ""

# Start services
docker-compose up

# If user cancels with Ctrl+C
echo ""
echo "Stopping services..."
docker-compose down
