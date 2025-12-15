#!/bin/bash
# Simple local server for Rillation Analytics

echo "🚀 Starting local server for Rillation Revenue Analytics..."
echo ""
PORT=${1:-8080}

echo "📍 Server running at: http://localhost:${PORT}"
echo "📄 Open this URL in your browser: http://localhost:${PORT}/rillation-analyticsv2.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo "Usage: ./start-server.sh [port] (default: 8080)"
echo ""

cd "$(dirname "$0")"
python3 -m http.server ${PORT}

