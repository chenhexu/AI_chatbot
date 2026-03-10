#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

# Default ports
BACKEND_PORT=8086
FRONTEND_PORT=3086

# Read ports from .env if exists
if [ -f "$PROJECT_ROOT/backend/.env" ]; then
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue

        # Remove surrounding whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)

        # Remove quotes if present
        value="${value%\"}"
        value="${value%\'}"
        value="${value#\"}"
        value="${value#\'}"

        case "$key" in
            BACKEND_PORT)
                BACKEND_PORT="$value"
                ;;
            FRONTEND_URL)
                # Extract port from URL like http://localhost:3086
                if [[ "$value" =~ :([0-9]+) ]]; then
                    FRONTEND_PORT="${BASH_REMATCH[1]}"
                fi
                ;;
        esac
    done < "$PROJECT_ROOT/backend/.env"
fi

echo -e "${YELLOW}=== Stopping Services ===${NC}"
echo -e "${YELLOW}Backend Port: $BACKEND_PORT${NC}"
echo -e "${YELLOW}Frontend Port: $FRONTEND_PORT${NC}"
echo ""

# Function to kill process by port (only LISTENING state)
kill_by_port() {
    local port=$1
    local service_name=$2

    # Find PID LISTENING on the port (not just connections)
    local pid=$(lsof -ti:$port -sTCP:LISTEN -sTCP:CLOSED 2>/dev/null || true)

    if [ -n "$pid" ]; then
        echo -e "${YELLOW}Stopping $service_name (PID: $pid, Port: $port)...${NC}"
        kill $pid 2>/dev/null || true
        # Wait a bit for graceful shutdown
        sleep 1
        # Force kill if still running
        if ps -p $pid > /dev/null 2>&1; then
            kill -9 $pid 2>/dev/null || true
        fi
        echo -e "${GREEN}✓ $service_name stopped${NC}"
        return 0
    else
        echo -e "${YELLOW}No process listening on port $port${NC}"
        return 1
    fi
}

# Stop services by port (continue even if one fails)
kill_by_port $BACKEND_PORT "Backend" || true
kill_by_port $FRONTEND_PORT "Frontend" || true

# Clean up PID files
rm -f "$LOG_DIR/backend.pid" "$LOG_DIR/frontend.pid" 2>/dev/null || true

echo ""
echo -e "${GREEN}=== All Services Stopped ===${NC}"
