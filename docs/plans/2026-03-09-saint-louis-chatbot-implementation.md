# Saint-Louis NotebookLM Chatbot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web chatbot that answers questions about Collège Saint-Louis using Google NotebookLM as the knowledge base.

**Architecture:** Two-tier web application with Next.js frontend (public port 3086) and FastAPI backend (internal port 8086). Backend communicates with NotebookLM skill for document queries. Frontend handles rich media display (tables, charts, images) with school-themed styling.

**Tech Stack:**
- Frontend: Next.js 14, TypeScript, Tailwind CSS, React Markdown, Recharts
- Backend: FastAPI, uv, Patchright, Pydantic
- Integration: NotebookLM skill for browser automation

---

## Task 1: Project Structure Setup

**Files:**
- Create: `frontend/`, `backend/`, `logs/`, `docs/plans/` directories
- Create: `frontend/package.json`
- Create: `backend/pyproject.toml`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Create project directories**

```bash
mkdir -p frontend/src/{app/{api/chat},components,lib,styles}
mkdir -p backend/{services,models,utils}
mkdir -p logs docs/plans
```

**Step 2: Create frontend package.json**

```json
{
  "name": "nblm-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-markdown": "^9.0.0",
    "react-table": "^7.8.0",
    "recharts": "^2.12.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 3: Create backend pyproject.toml**

```toml
[project]
name = "nblm-backend"
version = "0.1.0"
description = "NotebookLM Chatbot Backend"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.23.0",
    "pydantic>=2.0.0",
    "python-dotenv>=1.0.0",
    "patchright>=1.40.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=7.0.0",
    "httpx>=0.27.0",
]
```

**Step 4: Create .gitignore**

```
# Dependencies
frontend/node_modules/
backend/.venv/
backend/uv.lock

# Environment
backend/.env

# Logs
logs/*.log
logs/*.pid

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Next.js
frontend/.next/
frontend/out/
```

**Step 5: Create README.md**

```markdown
# Saint-Louis NotebookLM Chatbot

A web chatbot for answering questions about Collège Saint-Louis using Google NotebookLM.

## Quick Start

```bash
# Development
./start.sh dev

# Production
./start.sh

# Stop
./stop.sh
```

Access at: http://localhost:3086

## Project Structure

- `frontend/` - Next.js frontend
- `backend/` - FastAPI backend
- `logs/` - Application logs
- `docs/plans/` - Design and implementation docs
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: initialize project structure"
```

---

## Task 2: Backend Configuration and Utilities

**Files:**
- Create: `backend/.env.example`
- Create: `backend/utils/config.py`
- Create: `backend/utils/logger.py`
- Create: `backend/models/schemas.py`

**Step 1: Create .env.example**

```env
# NotebookLM Configuration
NOTEBOOKLM_URL=https://notebooklm.google.com/notebook/5d94a622-723a-40a2-87de-0b282f5c83c4

# Service Configuration
BACKEND_PORT=8086
FRONTEND_URL=http://localhost:3086
```

**Step 2: Create config.py**

```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    NOTEBOOKLM_URL: str = os.getenv("NOTEBOOKLM_URL", "")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8086"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3086")

    @classmethod
    def validate(cls) -> bool:
        if not cls.NOTEBOOKLM_URL:
            raise ValueError("NOTEBOOKLM_URL is required")
        return True

config = Config()
```

**Step 3: Create logger.py**

```python
import logging
import sys
from pathlib import Path

def setup_logger(name: str = "nblm-backend") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger

logger = setup_logger()
```

**Step 4: Create schemas.py**

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User message")

class ChatResponse(BaseModel):
    answer: str = Field(..., description="Answer from NotebookLM")
    language: str = Field(default="auto", description="Response language")
    sources: List[str] = Field(default_factory=list, description="Source documents")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class HealthResponse(BaseModel):
    status: str = Field(default="healthy")
    notebooklm: str = Field(default="unknown")
    notebook_name: Optional[str] = None
    auth_status: str = Field(default="unknown")
```

**Step 5: Write tests for schemas**

```python
# tests/test_schemas.py
import pytest
from backend.models.schemas import ChatRequest, ChatResponse

def test_chat_request_valid():
    request = ChatRequest(message="Hello")
    assert request.message == "Hello"

def test_chat_request_empty_message():
    with pytest.raises(ValueError):
        ChatRequest(message="")

def test_chat_response():
    response = ChatResponse(answer="Test answer")
    assert response.answer == "Test answer"
    assert response.language == "auto"
```

**Step 6: Run tests**

```bash
cd backend
uv run pytest tests/test_schemas.py -v
```

Expected: All tests pass

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: add backend config, logger, and schemas"
```

---

## Task 3: NotebookLM Authentication Service

**Files:**
- Create: `backend/services/auth_service.py`
- Create: `tests/test_auth_service.py`

**Step 1: Write failing test for auth check**

```python
# tests/test_auth_service.py
import pytest
from backend.services.auth_service import AuthService

def test_check_auth_when_not_authenticated():
    auth_service = AuthService()
    assert auth_service.is_authenticated() == False

def test_perform_auth():
    auth_service = AuthService()
    result = auth_service.authenticate()
    assert result == True
```

**Step 2: Run test to verify it fails**

```bash
cd backend
uv run pytest tests/test_auth_service.py -v
```

Expected: FAIL - AuthService not defined

**Step 3: Implement auth service**

```python
# backend/services/auth_service.py
import os
import subprocess
import sys
from pathlib import Path
from backend.utils.logger import logger

class AuthService:
    def __init__(self):
        self.skill_path = Path.home() / ".claude/skills/notebooklm"
        self.auth_file = Path.home() / ".agents/skills/notebooklm/data/browser_state/state.json"

    def is_authenticated(self) -> bool:
        """Check if Google authentication exists"""
        return self.auth_file.exists()

    def authenticate(self) -> bool:
        """Perform Google authentication"""
        if self.is_authenticated():
            logger.info("✅ Already authenticated")
            return True

        logger.info("🔐 Starting authentication...")
        try:
            result = subprocess.run(
                ["python3", "scripts/run.py", "auth_manager.py", "setup"],
                cwd=self.skill_path,
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes
            )
            if result.returncode == 0:
                logger.info("✅ Authentication successful")
                return True
            else:
                logger.error(f"❌ Authentication failed: {result.stderr}")
                return False
        except subprocess.TimeoutExpired:
            logger.error("❌ Authentication timeout")
            return False
        except Exception as e:
            logger.error(f"❌ Authentication error: {e}")
            return False
```

**Step 4: Run tests to verify they pass**

```bash
cd backend
uv run pytest tests/test_auth_service.py -v
```

Expected: Tests pass (or skip auth test if no real Google account)

**Step 5: Commit**

```bash
git add backend/services/ tests/
git commit -m "feat: add NotebookLM authentication service"
```

---

## Task 4: NotebookLM Query Service

**Files:**
- Create: `backend/services/notebooklm_service.py`
- Create: `tests/test_notebooklm_service.py`

**Step 1: Write failing test for query**

```python
# tests/test_notebooklm_service.py
import pytest
from backend.services.notebooklm_service import NotebookLMService

def test_query_notebook():
    service = NotebookLMService()
    result = service.query("What is this notebook about?")
    assert "answer" in result
    assert isinstance(result["answer"], str)
    assert len(result["answer"]) > 0
```

**Step 2: Run test to verify it fails**

```bash
cd backend
uv run pytest tests/test_notebooklm_service.py -v
```

Expected: FAIL - NotebookLMService not defined

**Step 3: Implement NotebookLM service**

```python
# backend/services/notebooklm_service.py
import subprocess
import json
import re
from pathlib import Path
from typing import Dict, Any
from backend.utils.logger import logger
from backend.utils.config import config

class NotebookLMService:
    def __init__(self):
        self.skill_path = Path.home() / ".claude/skills/notebooklm"
        self.notebook_url = config.NOTEBOOKLM_URL

    def query(self, question: str) -> Dict[str, Any]:
        """
        Query NotebookLM with a question

        Args:
            question: The question to ask

        Returns:
            Dict with 'answer', 'sources', 'language'
        """
        logger.info(f"Querying NotebookLM: {question}")

        try:
            result = subprocess.run(
                [
                    "python3", "scripts/run.py", "ask_question.py",
                    "--question", question,
                    "--notebook-url", self.notebook_url
                ],
                cwd=self.skill_path,
                capture_output=True,
                text=True,
                timeout=120  # 2 minutes
            )

            if result.returncode != 0:
                logger.error(f"Query failed: {result.stderr}")
                raise Exception(f"NotebookLM query failed: {result.stderr}")

            return self._parse_response(result.stdout)

        except subprocess.TimeoutExpired:
            logger.error("Query timeout")
            raise Exception("NotebookLM query timeout")
        except Exception as e:
            logger.error(f"Query error: {e}")
            raise

    def _parse_response(self, output: str) -> Dict[str, Any]:
        """Parse NotebookLM response"""
        # Extract answer from output
        match = re.search(r"Question:.*?\n(.+?)EXTREMELY IMPORTANT", output, re.DOTALL)
        if match:
            answer = match.group(1).strip()
        else:
            answer = output.strip()

        # Detect language (simple heuristic)
        language = self._detect_language(answer)

        return {
            "answer": answer,
            "sources": ["NotebookLM"],
            "language": language
        }

    def _detect_language(self, text: str) -> str:
        """Simple language detection"""
        french_chars = set("éèêëàâäùüûôöîïç")
        if french_chars & set(text.lower()):
            return "fr"
        # Add more sophisticated detection if needed
        return "en"

    def validate_notebook(self) -> bool:
        """Validate that the notebook is accessible"""
        try:
            result = self.query("What is the name of this notebook?")
            return bool(result.get("answer"))
        except Exception as e:
            logger.error(f"Notebook validation failed: {e}")
            return False

    def get_notebook_name(self) -> str:
        """Get the notebook name"""
        try:
            result = self.query("What is the name of this notebook? Answer with only the name.")
            return result.get("answer", "Unknown Notebook")
        except:
            return "Unknown Notebook"
```

**Step 4: Run tests to verify they pass**

```bash
cd backend
uv run pytest tests/test_notebooklm_service.py -v
```

Expected: Tests pass

**Step 5: Commit**

```bash
git add backend/services/ tests/
git commit -m "feat: add NotebookLM query service"
```

---

## Task 5: FastAPI Main Application

**Files:**
- Create: `backend/main.py`
- Create: `tests/test_main.py`

**Step 1: Write failing test for health endpoint**

```python
# tests/test_main.py
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
```

**Step 2: Run test to verify it fails**

```bash
cd backend
uv run pytest tests/test_main.py -v
```

Expected: FAIL - main.py not defined

**Step 3: Implement main.py**

```python
# backend/main.py
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.utils.config import config
from backend.utils.logger import logger
from backend.models.schemas import ChatRequest, ChatResponse, HealthResponse
from backend.services.auth_service import AuthService
from backend.services.notebooklm_service import NotebookLMService

# Global services
auth_service = AuthService()
notebooklm_service = NotebookLMService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("=== Starting NotebookLM Chatbot Backend ===")

    # Validate config
    try:
        config.validate()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)

    # Check authentication
    if not auth_service.is_authenticated():
        logger.info("No authentication found, starting auth flow...")
        if not auth_service.authenticate():
            logger.error("Authentication failed")
            sys.exit(1)

    # Validate notebook
    logger.info("Validating NotebookLM...")
    if not notebooklm_service.validate_notebook():
        logger.error("NotebookLM validation failed")
        sys.exit(1)

    notebook_name = notebooklm_service.get_notebook_name()
    logger.info(f"✅ Connected to: {notebook_name}")

    yield

    # Shutdown
    logger.info("=== Shutting down ===")

# Create FastAPI app
app = FastAPI(
    title="NotebookLM Chatbot API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoints
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        notebooklm="connected" if notebooklm_service.validate_notebook() else "disconnected",
        notebook_name=notebooklm_service.get_notebook_name(),
        auth_status="authenticated" if auth_service.is_authenticated() else "not_authenticated"
    )

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat endpoint"""
    try:
        result = notebooklm_service.query(request.message)
        return ChatResponse(
            answer=result["answer"],
            language=result["language"],
            sources=result["sources"]
        )
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=config.BACKEND_PORT)
```

**Step 4: Run tests to verify they pass**

```bash
cd backend
uv run pytest tests/test_main.py -v
```

Expected: Tests pass

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add FastAPI main application with endpoints"
```

---

## Task 6: Service Management Scripts

**Files:**
- Create: `start.sh`
- Create: `stop.sh`

**Step 1: Create start.sh**

```bash
#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

# Create log directory
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

# Install backend dependencies
echo -e "${GREEN}[1/4] Installing backend dependencies...${NC}"
cd "$PROJECT_ROOT/backend"
uv sync
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Install frontend dependencies
echo -e "${GREEN}[2/4] Installing frontend dependencies...${NC}"
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# Stop existing services
echo -e "${GREEN}[3/4] Stopping existing services...${NC}"
cd "$PROJECT_ROOT"
./stop.sh 2>/dev/null || true
echo -e "${GREEN}✓ Existing services stopped${NC}"

# Start services
echo -e "${GREEN}[4/4] Starting services...${NC}"

if [ "$MODE" = "dev" ]; then
    # Development mode
    echo -e "${YELLOW}Starting backend (dev mode with reload)...${NC}"
    cd backend
    nohup uv run uvicorn main:app --host 127.0.0.1 --port 8086 --reload \
        > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$LOG_DIR/backend.pid"

    cd "$PROJECT_ROOT/frontend"
    echo -e "${YELLOW}Starting frontend (dev mode)...${NC}"
    nohup npm run dev -- -p 3086 > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
else
    # Production mode
    echo -e "${YELLOW}Starting backend (production mode)...${NC}"
    cd backend
    nohup uv run uvicorn main:app --host 127.0.0.1 --port 8086 \
        > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$LOG_DIR/backend.pid"

    cd "$PROJECT_ROOT/frontend"
    echo -e "${YELLOW}Starting frontend (production mode)...${NC}"
    nohup npm run start -- -p 3086 > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
fi

cd "$PROJECT_ROOT"
sleep 3

# Check status
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
```

**Step 2: Create stop.sh**

```bash
#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

echo -e "${YELLOW}=== Stopping Services ===${NC}"
echo ""

# Stop backend
if [ -f "$LOG_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$LOG_DIR/backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping backend (PID: $BACKEND_PID)...${NC}"
        kill $BACKEND_PID
        echo -e "${GREEN}✓ Backend stopped${NC}"
    else
        echo -e "${YELLOW}Backend already stopped${NC}"
    fi
    rm -f "$LOG_DIR/backend.pid"
fi

# Stop frontend
if [ -f "$LOG_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$LOG_DIR/frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID
        echo -e "${GREEN}✓ Frontend stopped${NC}"
    else
        echo -e "${YELLOW}Frontend already stopped${NC}"
    fi
    rm -f "$LOG_DIR/frontend.pid"
fi

# Cleanup
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true

echo ""
echo -e "${GREEN}=== All Services Stopped ===${NC}"
```

**Step 3: Make scripts executable**

```bash
chmod +x start.sh stop.sh
```

**Step 4: Commit**

```bash
git add start.sh stop.sh
git commit -m "feat: add service management scripts"
```

---

## Task 7: Frontend Tailwind Configuration

**Files:**
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Modify: `frontend/package.json` (add tailwind dependencies)

**Step 1: Update package.json with Tailwind**

```json
{
  "name": "nblm-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-markdown": "^9.0.0",
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

**Step 2: Create tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1e3a5f",  // Deep blue
          dark: "#0f1f33",
        },
        accent: {
          DEFAULT: "#d4a017",  // Gold
          light: "#e8c047",
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 3: Create postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: add Tailwind CSS configuration"
```

---

## Task 8: Frontend Global Styles and Layout

**Files:**
- Create: `frontend/src/styles/globals.css`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`

**Step 1: Create globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #1e3a5f;
  --accent: #d4a017;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Droid Sans", "Helvetica Neue", Arial, sans-serif;
  background-color: #f5f5f5;
}

@layer components {
  .btn-primary {
    @apply bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors;
  }

  .btn-accent {
    @apply bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-light transition-colors;
  }
}
```

**Step 2: Create layout.tsx**

```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collège Saint-Louis - Chatbot",
  description: "Une fenêtre ouverte sur le monde",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
```

**Step 3: Create page.tsx**

```typescript
import ChatContainer from "@/components/ChatContainer";
import Header from "@/components/Header";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <ChatContainer />
    </main>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add frontend layout and global styles"
```

---

## Task 9: Frontend Header Component

**Files:**
- Create: `frontend/src/components/Header.tsx`

**Step 1: Create Header component**

```typescript
export default function Header() {
  return (
    <header className="bg-primary text-white shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          {/* Logo placeholder */}
          <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
            <span className="text-2xl">🏫</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold">Collège Saint-Louis</h1>
            <p className="text-sm text-gray-300">
              Une fenêtre ouverte sur le monde
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/Header.tsx
git commit -m "feat: add Header component with school branding"
```

---

## Task 10: Frontend Chat Container Component

**Files:**
- Create: `frontend/src/components/ChatContainer.tsx`
- Create: `frontend/src/components/MessageBubble.tsx`
- Create: `frontend/src/components/InputArea.tsx`
- Create: `frontend/src/components/LoadingIndicator.tsx`

**Step 1: Create MessageBubble component**

```typescript
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-primary text-white"
            : "bg-white text-gray-800 shadow"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">
            {isUser ? "👤 Vous" : "🤖 Assistant"}
          </span>
        </div>
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create LoadingIndicator component**

```typescript
export default function LoadingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-white rounded-lg px-4 py-3 shadow">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create InputArea component**

```typescript
"use client";

import { useState, FormEvent } from "react";

interface InputAreaProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function InputArea({ onSend, disabled }: InputAreaProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  return (
    <div className="border-t bg-white p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Posez votre question..."
            className="flex-1 border rounded-lg px-4 py-2 resize-none"
            rows={2}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className="btn-primary self-end"
          >
            Envoyer ➤
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 4: Create ChatContainer component**

```typescript
"use client";

import { useState } from "react";
import MessageBubble from "./MessageBubble";
import InputArea from "./InputArea";
import LoadingIndicator from "./LoadingIndicator";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Bonjour! Je suis l'assistant du Collège Saint-Louis. Comment puis-je vous aider?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (message: string) => {
    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsLoading(true);

    try {
      // Call API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Désolé, une erreur s'est produite. Veuillez réessayer.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <MessageBubble key={index} role={msg.role} content={msg.content} />
        ))}
        {isLoading && <LoadingIndicator />}
      </div>

      {/* Input */}
      <InputArea onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add chat container with messaging UI"
```

---

## Task 11: Frontend API Proxy

**Files:**
- Create: `frontend/src/app/api/chat/route.ts`

**Step 1: Create API route**

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Forward to backend
    const response = await fetch("http://127.0.0.1:8086/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error("Backend request failed");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
```

**Step 2: Update ChatContainer to use correct API path**

The ChatContainer already uses `/api/chat` which will resolve to this route.

**Step 3: Commit**

```bash
git add frontend/src/app/api/
git commit -m "feat: add API proxy route for backend communication"
```

---

## Task 12: Frontend Configuration Files

**Files:**
- Create: `frontend/next.config.js`
- Create: `frontend/tsconfig.json`

**Step 1: Create next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Commit**

```bash
git add frontend/next.config.js frontend/tsconfig.json
git commit -m "feat: add Next.js and TypeScript configuration"
```

---

## Task 13: Testing and Integration

**Files:**
- Create: `tests/integration/test_e2e.py`

**Step 1: Create integration test**

```python
# tests/integration/test_e2e.py
import pytest
import time
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_full_chat_flow():
    """Test complete chat flow"""
    async with AsyncClient(base_url="http://127.0.0.1:8086") as client:
        # Health check
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

        # Chat request
        response = await client.post(
            "/api/chat",
            json={"message": "What is this notebook about?"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert len(data["answer"]) > 0
```

**Step 2: Run integration test**

```bash
# Start backend first
cd backend && uv run uvicorn main:app --host 127.0.0.1 --port 8086 &

# Run tests
cd backend
uv run pytest tests/integration/test_e2e.py -v
```

**Step 3: Commit**

```bash
git add tests/integration/
git commit -m "test: add end-to-end integration tests"
```

---

## Task 14: Documentation and Final Setup

**Files:**
- Update: `README.md`
- Create: `backend/.env`

**Step 1: Update README.md**

```markdown
# Saint-Louis NotebookLM Chatbot

A web chatbot for answering questions about Collège Saint-Louis using Google NotebookLM.

## Features

- 🤖 AI-powered Q&A using Google NotebookLM
- 🌍 Multi-language support (French, English, Chinese)
- 📊 Rich media display (tables, charts, images)
- 🎨 School-themed design
- 🔒 Secure backend (internal only)

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Google account (for NotebookLM authentication)

### Setup

1. Configure backend environment:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your NotebookLM URL
```

2. Start services:
```bash
# Development
./start.sh dev

# Production
./start.sh
```

3. Access at: http://localhost:3086

### Stop Services

```bash
./stop.sh
```

### View Logs

```bash
tail -f logs/backend.log
tail -f logs/frontend.log
```

## Project Structure

```
nblm-agent/
├── frontend/       # Next.js frontend
├── backend/        # FastAPI backend
├── logs/           # Application logs
├── start.sh        # Start script
└── stop.sh         # Stop script
```

## Development

### Backend

```bash
cd backend
uv sync
uv run uvicorn main:app --host 127.0.0.1 --port 8086 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## License

MIT
```

**Step 2: Create .env file**

```bash
cp backend/.env.example backend/.env
# Edit .env with actual NotebookLM URL
```

**Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: update README with setup instructions"
```

---

## Task 15: Initial Deployment Test

**Files:**
- None (testing task)

**Step 1: Run initial deployment**

```bash
# Ensure .env is configured
cat backend/.env

# Start in development mode
./start.sh dev
```

**Step 2: Verify services**

```bash
# Check backend health
curl http://localhost:3086/api/health

# Check frontend
open http://localhost:3086
```

**Step 3: Test chat functionality**

1. Open browser to http://localhost:3086
2. Ask a question: "Quand sont les vacances?"
3. Verify response appears

**Step 4: Stop services**

```bash
./stop.sh
```

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from initial deployment test"
```

---

## Implementation Complete

All tasks have been defined. The implementation plan covers:

1. ✅ Project structure setup
2. ✅ Backend configuration and utilities
3. ✅ NotebookLM authentication service
4. ✅ NotebookLM query service
5. ✅ FastAPI main application
6. ✅ Service management scripts
7. ✅ Frontend Tailwind configuration
8. ✅ Frontend global styles and layout
9. ✅ Frontend header component
10. ✅ Frontend chat components
11. ✅ Frontend API proxy
12. ✅ Frontend configuration files
13. ✅ Testing and integration
14. ✅ Documentation
15. ✅ Initial deployment test

**Total estimated time**: 3-4 hours

**Next**: Choose execution method
