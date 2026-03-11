# Saint-Louis NotebookLM Chatbot

A web chatbot for answering questions about Collège Saint-Louis using Google NotebookLM.

## Overview

Full-stack chatbot application with a Next.js frontend and FastAPI backend. The application provides AI-powered Q&A using Google NotebookLM as the knowledge source, designed specifically for Collège Saint-Louis.

**Project Type**: Full-Stack Application
**Development Phase**: MVP
**Team Size**: Small (1-5 developers)
**Architecture**: Modular with context-specific CLAUDE.md files

## Quick Navigation

- [Backend Guidelines](backend/CLAUDE.md) - FastAPI services, NotebookLM integration
- [Frontend Guidelines](frontend/CLAUDE.md) - Next.js components, React patterns

## Project Structure

```
stl-chatbot/
├── frontend/              # Next.js frontend application
│   ├── src/
│   │   ├── app/          # Next.js App Router
│   │   ├── components/   # React components
│   │   └── __tests__/    # Frontend tests
│   └── CLAUDE.md         # Frontend-specific guidance
├── backend/              # FastAPI backend
│   ├── backend/
│   │   ├── main.py       # FastAPI application entry point
│   │   ├── models/       # Pydantic models
│   │   ├── services/     # Business logic
│   │   └── utils/        # Utilities
│   ├── tests/            # Backend tests
│   └── CLAUDE.md         # Backend-specific guidance
├── docs/                 # Project documentation
├── scripts/              # Utility scripts
├── logs/                 # Application logs
├── start.sh              # Start script
└── stop.sh               # Stop script
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14.2, React 18, TypeScript, Tailwind CSS |
| **UI Components** | React Markdown, Recharts, Remark GFM |
| **Backend** | Python FastAPI, Uvicorn |
| **Authentication** | Google NotebookLM (via patchright) |
| **Testing** | Jest (frontend), Pytest (backend) |
| **Package Management** | npm (frontend), uv (backend) |

## Architecture

### Request Flow

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Browser   │─────▶│ Next.js API  │─────▶│  FastAPI Backend│
│  (Frontend) │      │   Proxy      │      │   (Port 8086)   │
└─────────────┘      └──────────────┘      └────────┬────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │  NotebookLM Client  │
                                          │ (Direct Python +    │
                                          │   Patchright)       │
                                          └─────────────────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │  Google NotebookLM  │
                                          │     (via Chrome)    │
                                          └─────────────────────┘
```

**Component Details**:
- **Frontend**: React SPA with Next.js App Router, serves on port 3086
- **Backend**: FastAPI async server, runs on port 8086
- **NotebookLM Integration**: Direct Python calls via patchright (no subprocess)

## Core Principles

1. **Use Scripts**: Always use `./start.sh` and `./stop.sh` for service management
2. **Component Modularity**: Each major component has its own CLAUDE.md file
3. **Type Safety**: TypeScript strict mode (frontend), Pydantic validation (backend)
4. **Test First**: Write tests before implementation (TDD approach)
5. **Error Handling**: Structured error responses with proper logging
6. **Configuration**: All config via environment variables (no hardcoded values)

## Development Workflow

### Starting Services

**IMPORTANT**: Always use the provided scripts to manage services.

```bash
# Production mode: real notebooklm + prod frontend
./start.sh

# Development mode: real notebooklm + dev frontend (hot reload)
./start.sh dev

# Mock mode: mock notebooklm + dev frontend (for testing without Chrome)
./start.sh mock
```

**Mode Comparison**:

| Mode | Backend | Frontend | Use Case |
|------|---------|----------|----------|
| `prod` (default) | Real NotebookLM | Production build | Production deployment |
| `dev` | Real NotebookLM | Development server | Frontend/backend development |
| `mock` | Mock NotebookLM | Development server | Testing without Chrome/NotebookLM |

### Stopping Services

```bash
./stop.sh
```

### Development Process

1. **Feature Development**:
   - Create feature branch from `main`
   - Work in appropriate context (backend/ or frontend/)
   - Follow context-specific CLAUDE.md guidelines
   - Write tests first (TDD)
   - Run validation: `npm test` (frontend) or `uv run pytest` (backend)

2. **Individual Component Development**:

   **Backend** (Python/FastAPI):
   ```bash
   cd backend
   uv sync
   uv run uvicorn backend.main:app --host 127.0.0.1 --port 8086 --reload
   ```

   **Frontend** (Next.js):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Google account (for NotebookLM authentication)

### Installation

1. Clone the repository and configure environment:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your NotebookLM URL
```

2. The start/stop scripts handle all service management automatically, including:
   - Installing Python dependencies
   - Installing Node.js dependencies
   - Setting up Chrome for the NotebookLM skill (patchright)

## Configuration

### Backend Environment Variables

Located in `backend/.env`:

- `NOTEBOOKLM_URL`: Your Google NotebookLM notebook URL
- `BACKEND_PORT`: Backend server port (default: 8086)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:3086)
- `MOCK_NOTEBOOKLM`: Set to `true` to use mock responses (automatically managed by `./start.sh mock`)

## Testing

### Frontend Tests

```bash
cd frontend
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### Backend Tests

```bash
python3 -m pytest backend/tests/ -v
```

**Test Documentation**:
- `docs/TESTING.md` - Comprehensive testing guide
- `docs/QUICK_TEST_REFERENCE.md` - Quick reference

## Key Features

- **AI-Powered Q&A**: Uses Google NotebookLM as knowledge source
- **Multi-language Support**: French, English, Chinese
- **Rich Media Display**: Tables, charts, images via React Markdown
- **School-Themed Design**: Customized for Collège Saint-Louis
- **Fixed Layout**: Header and input stay fixed, only chat area scrolls
- **Auto-Expanding Input**: Textarea grows up to 5 lines, then scrolls

## Deployment Notes

For deployment, ensure:
1. Python 3.10+ and Node.js 18+ are installed
2. Chrome browser can be installed (required by patchright)
3. The `backend/.env` file is configured with the NotebookLM URL
4. Patchright dependency is available (specified in backend/pyproject.toml)

## Development Notes

- Frontend runs on port 3086 (development) or serves static files (production)
- Backend runs on port 8086
- NotebookLM authentication state is stored in `backend/data/notebooklm/` (auto-generated, excluded from git)
- User messages: white text on blue background
- Assistant messages: dark text on white background

---

**For detailed backend guidance, see [backend/CLAUDE.md](backend/CLAUDE.md)**
**For detailed frontend guidance, see [frontend/CLAUDE.md](frontend/CLAUDE.md)**
