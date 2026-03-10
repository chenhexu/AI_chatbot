# Saint-Louis NotebookLM Chatbot

A web chatbot for answering questions about Collège Saint-Louis using Google NotebookLM.

## Project Overview

This is a full-stack chatbot application that provides AI-powered Q&A using Google NotebookLM as the knowledge source. The application features a modern Next.js frontend with a FastAPI backend, designed specifically for Collège Saint-Louis.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14.2, React 18, TypeScript, Tailwind CSS |
| **UI Components** | React Markdown, Recharts, Remark GFM |
| **Backend** | Python FastAPI, Uvicorn |
| **Authentication** | Google NotebookLM (via CLI skill) |
| **Testing** | Pytest |
| **Package Management** | npm (frontend), uv (backend) |

## Project Structure

```
stl-chatbot-nblm/
├── frontend/              # Next.js frontend application
│   ├── src/
│   │   ├── app/          # Next.js App Router
│   │   │   ├── api/chat/ # Chat API proxy route
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/   # React components
│   │   │   ├── ChatContainer.tsx    # Main chat container
│   │   │   ├── Header.tsx           # App header
│   │   │   ├── InputArea.tsx        # Message input
│   │   │   ├── MessageBubble.tsx    # Message display with markdown
│   │   │   └── LoadingIndicator.tsx # Typing indicator
│   │   ├── __tests__/   # Frontend tests
│   │   │   ├── components/          # Component tests
│   │   │   ├── integration/         # Integration tests
│   │   │   ├── mocks/               # Test mocks
│   │   │   └── test-data/           # Test data fixtures
│   │   └── styles/
│   │       └── globals.css
│   ├── jest.config.js   # Jest testing configuration
│   ├── jest.setup.js    # Jest test setup
│   ├── package.json
│   └── tailwind.config.ts
├── backend/              # FastAPI backend
│   ├── backend/
│   │   ├── main.py       # FastAPI application entry point
│   │   ├── models/       # Pydantic models
│   │   │   └── schemas.py
│   │   ├── services/     # Business logic
│   │   │   ├── auth_service.py       # NotebookLM authentication
│   │   │   └── notebooklm_service.py # NotebookLM queries
│   │   └── utils/        # Utilities
│   │       ├── config.py
│   │       └── logger.py
│   ├── tests/            # Backend tests
│   └── .env.example
├── tests/                # Integration tests
├── docs/                 # Project documentation
│   ├── test-reports/     # UI test reports and findings
│   │   ├── UI_TEST_REPORT.md       # Comprehensive UI test report
│   │   ├── UI_TEST_FINDINGS.md     # Quick reference for test findings
│   │   └── screenshots/            # UI test screenshots
│   ├── TESTING.md        # UI testing documentation
│   ├── QUICK_TEST_REFERENCE.md  # Quick test reference guide
│   └── UI_TEST_SUITE_SUMMARY.md  # Test suite implementation summary
├── scripts/              # Utility scripts
│   └── test-runner.sh    # Test runner script
├── skills/               # Bundled NotebookLM skill (no Claude Code required)
│   └── notebooklm/       # NotebookLM CLI skill scripts
│       ├── scripts/      # Python scripts for NotebookLM interaction
│       ├── data/         # Browser state and authentication (auto-generated)
│       └── requirements.txt
├── logs/                 # Application logs
├── start.sh              # Start script
└── stop.sh               # Stop script
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Google account (for NotebookLM authentication)

**Note**: The NotebookLM skill is bundled with this project. No separate installation or Claude Code required.

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

**Mode Comparison:**

| Mode | Backend | Frontend | Use Case |
|------|---------|----------|----------|
| `prod` (default) | Real NotebookLM | Production build | Production deployment |
| `dev` | Real NotebookLM | Development server | Frontend/backend development |
| `mock` | Mock NotebookLM | Development server | Testing without Chrome/NotebookLM |

### Stopping Services

```bash
./stop.sh
```

### Viewing Logs

Application logs are stored in the `logs/` folder:

```bash
# View backend logs
tail -f logs/backend.log

# View frontend logs
tail -f logs/frontend.log
```

### Individual Component Development

If you need to work on individual components:

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
                                          │   NotebookLM CLI    │
                                          │  (skills/notebooklm/)│
                                          └─────────────────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │  Google NotebookLM  │
                                          │     (via Chrome)    │
                                          └─────────────────────┘
```

### Frontend Components

- **ChatContainer**: Main chat interface with message list and input
- **MessageBubble**: Displays messages with rich markdown support (tables, images, code)
- **InputArea**: Auto-expanding textarea with fixed positioning
- **Header**: School-themed header with logo
- **LoadingIndicator**: Animated typing indicator

### Backend Services

- **AuthService**: Manages NotebookLM authentication via CLI skill
- **NotebookLMService**: Handles queries to NotebookLM via subprocess calls

## Testing

### Frontend Tests

The project includes a comprehensive UI test suite with 200+ test cases.

```bash
# From frontend directory
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test categories
npm test -- --testNamePattern="table"
npm test -- --testNamePattern="list"
npm test -- --testNamePattern="color"
```

**Test Documentation:**
- `docs/TESTING.md` - Comprehensive testing guide
- `docs/QUICK_TEST_REFERENCE.md` - Quick reference for testing
- `docs/UI_TEST_SUITE_SUMMARY.md` - Test suite implementation details
- `docs/test-reports/UI_TEST_REPORT.md` - Detailed UI test findings
- `docs/test-reports/UI_TEST_FINDINGS.md` - Quick reference for test findings

### Backend Tests

```bash
# From project root
python3 -m pytest backend/tests/ -v

# Run specific test file
python3 -m pytest tests/test_notebooklm_service.py -v
```

### Integration Tests

```bash
python3 -m pytest tests/integration/ -v
```

## Configuration

### Backend Environment Variables

Located in `backend/.env`:

- `NOTEBOOKLM_URL`: Your Google NotebookLM notebook URL
- `BACKEND_PORT`: Backend server port (default: 8086)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:3086)
- `MOCK_NOTEBOOKLM`: Set to `true` to use mock responses instead of real NotebookLM (automatically managed by `./start.sh mock`)

## Key Features

- **AI-Powered Q&A**: Uses Google NotebookLM as knowledge source
- **Multi-language Support**: French, English, Chinese
- **Rich Media Display**: Tables, charts, images via React Markdown
- **School-Themed Design**: Customized for Collège Saint-Louis
- **Fixed Layout**: Header and input stay fixed, only chat area scrolls
- **Auto-Expanding Input**: Textarea grows up to 5 lines, then scrolls

## Development Notes

- The frontend runs on port 3086 (development) or serves static files (production)
- The backend runs on port 8086
- The NotebookLM skill is **bundled** with the project at `skills/notebooklm/`
- No Claude Code installation required - the skill is self-contained
- NotebookLM authentication state is stored in `skills/notebooklm/data/` (auto-generated on first run)
- All NotebookLM queries go through the bundled `scripts/run.py`
- Chrome browser is installed automatically by patchright on first run
- User messages display with white text on blue background
- Assistant messages display with dark text on white background

## Deployment Notes

The project is designed to work without Claude Code. The bundled NotebookLM skill includes:

- `skills/notebooklm/scripts/` - Python scripts for NotebookLM interaction
- `skills/notebooklm/requirements.txt` - Skill dependencies (patchright, python-dotenv)
- `skills/notebooklm/data/` - Browser state (auto-generated, excluded from git)

For deployment, ensure:
1. Python 3.10+ and Node.js 18+ are installed
2. Chrome browser can be installed (required by patchright)
3. The `backend/.env` file is configured with the NotebookLM URL
