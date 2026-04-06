#!/bin/bash
# dev-start.sh — macOS equivalent of dev-start.ps1
# Starts both Vite frontend and Hono backend in parallel

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Kill mode
if [ "$1" = "--kill" ] || [ "$1" = "-k" ]; then
  echo -e "${YELLOW}Killing dev servers...${NC}"
  # Kill processes on known ports
  lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}Done.${NC}"
  exit 0
fi

echo -e "${GREEN}Starting Vorea Studio dev servers...${NC}"
echo -e "  Frontend: ${YELLOW}http://localhost:5173${NC}"
echo -e "  Backend:  ${YELLOW}http://localhost:3001${NC}"
echo ""

# Start backend in background
echo -e "${GREEN}[API]${NC} Starting backend..."
pnpm dev:api &
API_PID=$!

# Small delay to let backend start
sleep 2

# Start frontend in foreground
echo -e "${GREEN}[VITE]${NC} Starting frontend..."
pnpm dev &
VITE_PID=$!

# Trap Ctrl+C to kill both
cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  kill $API_PID 2>/dev/null || true
  kill $VITE_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for both
wait
