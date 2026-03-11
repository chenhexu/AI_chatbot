# Backend CLAUDE.md

This file provides backend-specific guidance for the Saint-Louis NotebookLM Chatbot.

## Overview

FastAPI backend service that integrates with Google NotebookLM via direct Python calls using patchright. Handles authentication, query processing, and API proxying for the frontend.

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | FastAPI | 0.100+ |
| **Server** | Uvicorn | 0.23+ |
| **Python** | Python | 3.10+ |
| **Validation** | Pydantic | 2.0+ |
| **Browser Automation** | Patchright | 1.55.2 |
| **Package Manager** | uv | Latest |
| **Testing** | Pytest | 7.0+ |

## Project Structure

```
backend/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── models/              # Pydantic models
│   │   └── schemas.py       # Request/response schemas
│   ├── services/            # Business logic
│   │   ├── auth_service.py        # NotebookLM authentication
│   │   └── notebooklm_service.py  # NotebookLM queries
│   └── utils/               # Utilities
│       ├── config.py        # Configuration management
│       └── logger.py        # Logging setup
├── tests/                   # Backend tests
├── data/                    # Runtime data (auth state, logs)
│   └── notebooklm/          # NotebookLM authentication state
├── .env                     # Environment configuration
├── .env.example             # Environment template
└── pyproject.toml           # Python project configuration
```

## Core Principles

1. **Service Layer Pattern**: Business logic lives in `services/`, not in route handlers
2. **Async First**: Use async/await throughout for better performance
3. **Type Safety**: Use Pydantic models for all request/response validation
4. **Error Handling**: Return structured error responses with proper HTTP status codes
5. **Configuration**: All configuration via environment variables (no hardcoded values)

## Development Workflow

### Local Development

```bash
# Install dependencies
uv sync

# Run development server (with hot reload)
uv run uvicorn backend.main:app --host 127.0.0.1 --port 8086 --reload

# Run with log level
uv run uvicorn backend.main:app --host 127.0.0.1 --port 8086 --reload --log-level debug
```

### Testing

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=backend

# Run specific test file
uv run pytest tests/test_notebooklm_service.py -v

# Run in watch mode
uv run pytest -f
```

## Architecture

### Request Flow

```
Frontend → Next.js API Proxy → FastAPI Backend → NotebookLM Service → Google NotebookLM
```

### Services

**AuthService** (`services/auth_service.py`):
- Manages NotebookLM authentication state
- Handles Chrome browser session via patchright
- Stores authentication cookies in `data/notebooklm/`

**NotebookLMService** (`services/notebooklm_service.py`):
- Executes queries against Google NotebookLM
- Handles page navigation and response extraction
- Manages browser lifecycle

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Health check endpoint |
| `/api/chat` | POST | Chat endpoint for NotebookLM queries |

## Environment Variables

Located in `backend/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `NOTEBOOKLM_URL` | Google NotebookLM notebook URL | Required |
| `BACKEND_PORT` | Backend server port | `8086` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3086` |
| `MOCK_NOTEBOOKLM` | Use mock responses | `false` |

## Error Handling

```python
from fastapi import HTTPException

# Return structured errors
raise HTTPException(
    status_code=500,
    detail={
        "error": "Authentication failed",
        "message": "Could not authenticate with NotebookLM"
    }
)
```

## Code Style

### Pydantic Models

```python
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None

class ChatResponse(BaseModel):
    response: str
    timestamp: str
```

### Service Pattern

```python
class MyService:
    def __init__(self):
        self.config = get_config()

    async def execute(self, params: dict) -> Result:
        # Business logic here
        pass
```

## Testing Guidelines

### Unit Tests

```python
import pytest
from backend.services.my_service import MyService

@pytest.mark.asyncio
async def test_service_execution():
    service = MyService()
    result = await service.execute({"param": "value"})
    assert result.success is True
```

### Integration Tests

```python
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_chat_endpoint():
    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 200
```

## Common Issues

### Patchright Chrome Issues

If Chrome fails to install:
```bash
# Remove existing Chrome data
rm -rf backend/data/notebooklm/

# Restart backend (will reinstall Chrome)
./start.sh
```

### Authentication State Issues

If authentication fails:
```bash
# Clear authentication state
rm -rf backend/data/notebooklm/

# Restart to re-authenticate
./stop.sh && ./start.sh
```

## Deployment Notes

- Requires Python 3.10+
- Chrome browser must be installable (patchright requirement)
- `backend/data/` is excluded from git (contains auth state)
- Use `./start.sh` for production deployments

---

**For project-level guidance, see [CLAUDE.md](../CLAUDE.md)**
