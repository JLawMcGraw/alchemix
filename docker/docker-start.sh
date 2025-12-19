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
    echo "Copying .env.example to .env..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your API keys:"
    echo "   - OPENAI_API_KEY"
    echo "   - GEMINI_API_KEY"
    echo "   - JWT_SECRET"
    echo ""
    read -p "Press Enter after updating .env to continue..."
fi

# Check if memmachine directory exists (sibling repo)
if [ ! -d "../../memmachine" ]; then
    echo "❌ Error: memmachine directory not found"
    echo "Expected: ../../memmachine (sibling to alchemix)"
    echo ""
    echo "Please clone memmachine fork:"
    echo "  cd ../.."
    echo "  git clone https://github.com/JLawMcGraw/memmachine.git memmachine"
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
