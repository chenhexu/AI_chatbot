#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

mkdir -p "$LOG_DIR"

echo -e "${GREEN}=== NotebookLM Chatbot Starter ===${NC}"
echo ""

MODE="${1:-prod}"
if [ "$MODE" = "dev" ]; then
    echo -e "${YELLOW}Mode: DEVELOPMENT${NC}"
else
    echo -e "${YELLOW}Mode: PRODUCTION${NC}"
fi
echo ""

echo -e "${GREEN}[1/4] Installing backend dependencies...${NC}"
cd "$PROJECT_ROOT/backend"
uv sync
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

echo -e "${GREEN}[2/4] Installing frontend dependencies...${NC}"
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

echo -e "${GREEN}[3/4] Stopping existing services...${NC}"
cd "$PROJECT_ROOT"
./stop.sh 2>/dev/null || true
echo -e "${GREEN}✓ Existing services stopped${NC}"

echo -e "${GREEN}[4/4] Starting services...${NC}"

if [ "$MODE" = "dev" ]; then
    cd "$PROJECT_ROOT/backend"
    nohup uv run uvicorn backend.main:app --host 127.0.0.1 --port 8086 --reload > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$LOG_DIR/backend.pid"

    cd "$PROJECT_ROOT/frontend"
    nohup npm run dev -- -p 3086 > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
else
    cd "$PROJECT_ROOT/backend"
    nohup uv run uvicorn backend.main:app --host 127.0.0.1 --port 8086 > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$LOG_DIR/backend.pid"

    cd "$PROJECT_ROOT/frontend"
    nohup npm run build > "$LOG_DIR/frontend-build.log" 2>&1
    nohup npm run start -- -p 3086 > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
fi

cd "$PROJECT_ROOT"
sleep 3

echo ""
echo -e "${GREEN}=== Services Started ===${NC}"
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Backend running (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}✗ Backend failed to start${NC}"
    tail -n 20 "$LOG_DIR/backend.log"
fi

if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Frontend running (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}✗ Frontend failed to start${NC}"
    tail -n 20 "$LOG_DIR/frontend.log"
fi

echo ""
echo -e "${GREEN}Frontend: http://localhost:3086${NC}"
echo -e "${YELLOW}Logs: $LOG_DIR${NC}"
echo ""
echo -e "${YELLOW}Use './stop.sh' to stop all services${NC}"
