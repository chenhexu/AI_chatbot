# Saint-Louis NotebookLM Chatbot Design Document

**Date**: 2026-03-09
**Author**: Design Team
**Status**: Approved

---

## Project Overview

**Name**: Saint-Louis NotebookLM Chatbot
**Type**: Web Chatbot
**Target Users**: Parents, School Staff, General Public
**Purpose**: Provide a question-answering system for Collège Saint-Louis information using Google NotebookLM as the knowledge base.

---

## System Architecture

```
┌─────────────────────────────────────────────┐
│             Internet (Users)                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Frontend (Next.js) - Port 3086            │  ← Public Access
│  - Chat UI with rich media support          │
│  - School themed design                     │
└──────────────────┬──────────────────────────┘
                   │ localhost/127.0.0.1
                   ▼
┌─────────────────────────────────────────────┐
│  Backend (FastAPI) - Port 8086             │  ← Internal Only
│  - NotebookLM integration                  │
│  - API endpoints                           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  NotebookLM Skill                          │
│  - Browser automation                      │
│  - Document query                          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Google NotebookLM                         │
│  - School knowledge base                   │
└─────────────────────────────────────────────┘
```

---

## Frontend Design

### Technology Stack

| Technology | Purpose |
|------------|---------|
| Next.js 14 | React framework with SSR |
| TypeScript | Type safety |
| Tailwind CSS | Styling framework |
| React Markdown | Rich text rendering |
| Recharts | Chart visualization |
| React Table | Table display |

### UI Components

| Component | Description |
|-----------|-------------|
| ChatContainer | Message list container with auto-scroll |
| MessageBubble | User/bot message styling |
| MarkdownRenderer | Rich text with support for tables/images |
| ChartView | Chart rendering from data |
| ImageView | Image display and lightbox |
| InputArea | Text input with send button |
| Header | School branding and navigation |
| LoadingIndicator | Query progress indicator |

### School Theme

Based on Collège Saint-Louis official website:

| Element | Design |
|---------|--------|
| **Title** | "Collège Saint-Louis" + "Une fenêtre ouverte sur le monde" |
| **Primary Color** | Deep Blue (#1e3a5f) |
| **Accent Color** | Gold/Orange (#d4a017) |
| **Background** | White (#ffffff) and Light Gray (#f5f5f5) |
| **Logo** | School logo from official website |

### Page Layout

```
┌───────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════╗ │
│  ║  [Logo]  Collège Saint-Louis              ║ │
│  ║         Une fenêtre ouverte sur le monde   ║ │
│  ╚═══════════════════════════════════════════╝ │
├───────────────────────────────────────────────┤
│  💬 Chat Area                                 │
│  ┌─────────────────────────────────────────┐ │
│  │ 👤 User: School holidays?               │ │
│  │ ┌─────────────────────────────────────┐ │ │
│  │ │ 🤖 Bot: According to the calendar... │ │ │
│  │ │ [📊 Chart] [📋 Table] [📷 Image]    │ │ │
│  │ └─────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │ [Ask a question...]            [Send ➤] │ │
│  └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

---

## Backend Design

### Technology Stack

| Technology | Purpose |
|------------|---------|
| uv | Python package management |
| FastAPI | Web framework |
| Uvicorn | ASGI server |
| Pydantic | Data validation |
| python-dotenv | Environment configuration |
| Patchright | Browser automation for NotebookLM |

### Configuration (.env)

```env
# NotebookLM Configuration
NOTEBOOKLM_URL=https://notebooklm.google.com/notebook/5d94a622-723a-40a2-87de-0b282f5c83c4

# Service Configuration (optional, has defaults)
BACKEND_PORT=8086
FRONTEND_URL=http://localhost:3086
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Send message, get answer |
| `/api/health` | GET | Health check + NotebookLM status |

#### POST /api/chat

**Request**:
```json
{
  "message": "Quand sont les vacances?"
}
```

**Response**:
```json
{
  "answer": "Selon le calendrier scolaire...",
  "language": "fr",
  "sources": ["Info-parents février 2026"],
  "timestamp": "2026-03-09T20:30:00Z"
}
```

#### GET /api/health

**Response**:
```json
{
  "status": "healthy",
  "notebooklm": "connected",
  "notebook_name": "College Saint-Louis",
  "auth_status": "authenticated"
}
```

### Startup Flow

```python
async def startup_check():
    """
    Automatic checks on service startup:
    1. Check Google authentication status
    2. Start authentication flow if not authenticated
    3. Validate NotebookLM availability
    4. Stop service on any error
    """

    # 1. Check authentication
    if not check_auth():
        print("🔐 No authentication found, starting auth flow...")
        if not perform_auth():
            print("❌ Authentication failed, service stopped")
            sys.exit(1)

    # 2. Validate NotebookLM
    notebook_url = os.getenv("NOTEBOOKLM_URL")
    if not validate_notebook(notebook_url):
        print(f"❌ NotebookLM unavailable: {notebook_url}")
        sys.exit(1)

    # 3. Fetch notebook metadata
    notebook_name = fetch_notebook_metadata()
    print(f"✅ Connected to: {notebook_name}")

    print("✅ All checks passed, service starting")
```

---

## Language Support

### Design Principle

**No translation needed** - NotebookLM automatically detects input language and responds in the same language.

### Flow

```
User Input (Any Language)
    ↓
Send to NotebookLM directly
    ↓
NotebookLM returns answer in same language
    ↓
Display to user
```

### Supported Languages

- French (default) - School's primary language
- English
- Chinese (Simplified/Traditional)

### Examples

| Input Language | Input | Output Language |
|----------------|-------|-----------------|
| French | "Quand sont les vacances?" | French |
| English | "When are the holidays?" | English |
| Chinese | "假期是什么时候?" | Chinese |

---

## Data Flow

```
User: "When are the holidays?"
    ↓
Frontend: POST /api/chat {message: "When are the holidays?"}
    ↓
Next.js API Route: Forward to FastAPI (localhost:8086)
    ↓
Backend: notebooklm_query("When are the holidays?")
    ↓
NotebookLM Skill:
  1. Launch browser
  2. Open notebook URL
  3. Input question
  4. Get answer
  5. Close browser
    ↓
Backend: Return answer to frontend
    ↓
Frontend: Display answer with rich media rendering
    ↓
User sees answer
```

---

## Error Handling

### Error Types

| Error Type | Scenario | Handling |
|------------|----------|----------|
| **Authentication Failed** | Google login failed | Stop service on startup, display error |
| **Notebook Unavailable** | Wrong URL / No permission | Stop service on startup, display error |
| **NotebookLM Timeout** | Query takes too long | Return timeout error with retry option |
| **Browser Crash** | Playwright process error | Restart browser + retry query |

### Frontend Error Display

```
┌─────────────────────────────────────────┐
│  🤖 Bot                                 │
│  ┌─────────────────────────────────┐   │
│  │ ⚠️ Désolé, une erreur s'est     │   │
│  │    produite. Veuillez réessayer. │   │
│  │                                 │   │
│  │ [🔄 Réessayer]                  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Deployment

### Server Configuration

```
Server (VPS/Cloud)
    │
    ├─ Nginx (Optional, for reverse proxy and SSL)
    │   └─ :443 (HTTPS) → :3086 (Frontend)
    │
    ├─ Frontend Service (Next.js)
    │   └─ :3086 (Public)
    │
    └─ Backend Service (FastAPI)
        └─ 127.0.0.1:8086 (Internal only)
```

### Port Configuration

| Service | Port | Access | Description |
|---------|------|--------|-------------|
| Frontend | 3086 | Public | User access entry point |
| Backend | 8086 | 127.0.0.1 | Frontend only |

---

## Project Structure

```
nblm-agent/
├── start.sh                    # Service starter script
├── stop.sh                     # Service stopper script
├── logs/                       # Log directory
│   ├── backend.log
│   ├── frontend.log
│   ├── error.log
│   ├── backend.pid
│   └── frontend.pid
├── README.md
├── docs/
│   └── plans/
│       └── 2026-03-09-saint-louis-chatbot-design.md
├── frontend/                   # Next.js Frontend
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Main page
│   │   │   ├── layout.tsx         # Root layout
│   │   │   └── api/
│   │   │       └── chat/
│   │   │           └── route.ts   # API proxy
│   │   ├── components/
│   │   │   ├── ChatContainer.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── InputArea.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── LoadingIndicator.tsx
│   │   │   └── RichContentView.tsx
│   │   ├── lib/
│   │   │   └── api.ts             # API client
│   │   └── styles/
│   │       └── globals.css
│   └── public/
│       └── images/
│           └── logo.png
├── backend/                     # FastAPI Backend
│   ├── pyproject.toml           # uv project config
│   ├── uv.lock                  # uv dependency lock
│   ├── .python-version          # Python version lock
│   ├── .env                     # Environment config
│   ├── main.py                  # FastAPI application
│   ├── services/
│   │   ├── notebooklm_service.py
│   │   └── auth_service.py
│   ├── models/
│   │   └── schemas.py
│   └── utils/
│       ├── config.py
│       └── logger.py
└── .gitignore
```

---

## Service Management Scripts

### start.sh

```bash
#!/bin/bash
# Start both frontend and backend services
# Usage: ./start.sh [dev|prod]

set -e

MODE="${1:-prod}"

# Create log directory
mkdir -p logs

# Install dependencies
cd backend && uv sync
cd ../frontend && npm install

# Stop existing services
./stop.sh

# Start services
if [ "$MODE" = "dev" ]; then
    # Development mode with reload
    cd backend && nohup uv run uvicorn main:app --host 127.0.0.1 --port 8086 --reload > ../logs/backend.log 2>&1 &
    echo $! > ../logs/backend.pid
    cd ../frontend && nohup npm run dev -- -p 3086 > ../logs/frontend.log 2>&1 &
else
    # Production mode
    cd backend && nohup uv run uvicorn main:app --host 127.0.0.1 --port 8086 > ../logs/backend.log 2>&1 &
    echo $! > ../logs/backend.pid
    cd ../frontend && nohup npm run start -- -p 3086 > ../logs/frontend.log 2>&1 &
fi
echo $! > ../logs/frontend.pid
```

### stop.sh

```bash
#!/bin/bash
# Stop all services

# Stop backend
if [ -f logs/backend.pid ]; then
    kill $(cat logs/backend.pid) 2>/dev/null || true
    rm logs/backend.pid
fi

# Stop frontend
if [ -f logs/frontend.pid ]; then
    kill $(cat logs/frontend.pid) 2>/dev/null || true
    rm logs/frontend.pid
fi

# Cleanup
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
```

---

## Usage

```bash
# Development mode
./start.sh dev

# Production mode
./start.sh

# Stop services
./stop.sh

# View logs
tail -f logs/backend.log
tail -f logs/frontend.log
```

Access at: `http://localhost:3086`

---

## Implementation Checklist

- [ ] Frontend chat UI with message bubbles
- [ ] School themed styling (blue/gold, logo)
- [ ] Frontend API proxy (`/api/chat`)
- [ ] Backend FastAPI service
- [ ] NotebookLM integration service
- [ ] Startup authentication check
- [ ] Startup notebook validation
- [ ] Error handling and retry logic
- [ ] Rich media rendering (tables, charts, images)
- [ ] Responsive design
- [ ] Service management scripts
- [ ] Deployment configuration

---

## Next Steps

1. Create detailed implementation plan
2. Set up project structure
3. Implement backend services
4. Implement frontend components
5. Integration testing
6. Deployment

---

**End of Design Document**
