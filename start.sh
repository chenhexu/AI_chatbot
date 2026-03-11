#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
BACKEND_ENV="$PROJECT_ROOT/backend/.env"

mkdir -p "$LOG_DIR"

echo -e "${GREEN}=== NotebookLM Chatbot Starter ===${NC}"
echo ""

MODE="${1:-prod}"

# Parse mode argument
case "$MODE" in
    "dev")
        echo -e "${YELLOW}Mode: DEVELOPMENT${NC}"
        echo -e "${BLUE}  - Real NotebookLM backend${NC}"
        echo -e "${BLUE}  - Dev frontend (hot reload)${NC}"
        USE_MOCK=false
        ;;
    "mock")
        echo -e "${YELLOW}Mode: MOCK${NC}"
        echo -e "${BLUE}  - Mock NotebookLM backend${NC}"
        echo -e "${BLUE}  - Dev frontend (hot reload)${NC}"
        USE_MOCK=true
        ;;
    "prod"|"")
        echo -e "${YELLOW}Mode: PRODUCTION${NC}"
        echo -e "${BLUE}  - Real NotebookLM backend${NC}"
        echo -e "${BLUE}  - Production frontend${NC}"
        USE_MOCK=false
        ;;
    *)
        echo -e "${RED}Error: Invalid mode '$MODE'${NC}"
        echo ""
        echo "Usage: $0 [mode]"
        echo "  Modes:"
        echo "    (empty) - Production: real notebooklm + prod frontend"
        echo "    dev     - Development: real notebooklm + dev frontend"
        echo "    mock    - Mock: mock notebooklm + dev frontend"
        exit 1
        ;;
esac

# Derive mode-specific booleans
IS_DEV_MODE=$([ "$MODE" = "dev" ] || [ "$MODE" = "mock" ] && echo true || echo false)
echo ""

echo -e "${GREEN}[1/6] Installing backend dependencies...${NC}"
cd "$PROJECT_ROOT/backend"
uv sync
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Export mode-specific environment variables for child processes
export MOCK_NOTEBOOKLM="$USE_MOCK"
export DEBUG="$([ "$IS_DEV_MODE" = true ] && echo "1" || echo "0")"
echo -e "${GREEN}✓ Backend mode configured${NC}"

echo -e "${GREEN}[3/6] Checking Chrome for Patchright...${NC}"
cd "$PROJECT_ROOT/backend"
# Install Chrome browser for patchright (required for browser automation)
if ! uv run python -m patchright install chrome 2>/dev/null; then
    echo -e "${YELLOW}Installing Chrome for Patchright...${NC}"
    uv run python -m patchright install chrome
fi
echo -e "${GREEN}✓ Chrome ready for Patchright${NC}"

echo -e "${GREEN}[4/6] Installing frontend dependencies...${NC}"
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

echo -e "${GREEN}[5/6] Stopping existing services...${NC}"
cd "$PROJECT_ROOT"
./stop.sh 2>/dev/null || true
echo -e "${GREEN}✓ Existing services stopped${NC}"

echo -e "${GREEN}[6/6] Starting services...${NC}"

# Start backend with appropriate mode
cd "$PROJECT_ROOT/backend"
if [ "$IS_DEV_MODE" = true ]; then
    nohup uv run python -m uvicorn main:app --host 127.0.0.1 --port 8086 --reload > "$LOG_DIR/backend.log" 2>&1 &
else
    nohup uv run python -m uvicorn main:app --host 127.0.0.1 --port 8086 > "$LOG_DIR/backend.log" 2>&1 &
fi
BACKEND_PID=$!
echo $BACKEND_PID > "$LOG_DIR/backend.pid"

# Start frontend
cd "$PROJECT_ROOT/frontend"
if [ "$IS_DEV_MODE" = true ]; then
    nohup npm run dev -- -p 3086 > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
else
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
