# Saint-Louis NotebookLM Chatbot

A web chatbot for answering questions about Collège Saint-Louis using Google NotebookLM.

**Author:** Tony Xu

## Introduction

This is a full-stack chatbot that provides AI-powered Q&A using Google NotebookLM as the knowledge source. It includes a Next.js frontend and a FastAPI backend, with direct Python integration to NotebookLM (via patchright). The app supports multiple languages and rich content (tables, charts, markdown).

## Prerequisites

- Python 3.10+
- Node.js 18+
- Google account (for NotebookLM authentication)

## Installation

1. Clone the repository.

2. Configure the backend environment:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit `backend/.env` and set your NotebookLM notebook URL (`NOTEBOOKLM_URL`).

3. The start script installs dependencies automatically (Python with uv, Node.js, and Chrome for the NotebookLM skill). No manual install step is required if you use `./start.sh`.

## How to Use

### Start the application

Use the provided script (recommended):

```bash
# Production: real NotebookLM + production frontend
./start.sh

# Development: real NotebookLM + dev server (hot reload)
./start.sh dev

# Mock: mock responses + dev frontend (no Chrome/NotebookLM needed)
./start.sh mock
```

| Mode   | Command       | Use case                          |
|--------|---------------|-----------------------------------|
| prod   | `./start.sh`  | Normal use and deployment         |
| dev    | `./start.sh dev` | Frontend/backend development   |
| mock   | `./start.sh mock` | Testing without NotebookLM     |

Open the app at **http://localhost:3086**.

### Stop the application

```bash
./stop.sh
```

### View logs

```bash
tail -f logs/backend.log
tail -f logs/frontend.log
```

### Run backend or frontend alone (optional)

**Backend only:**
```bash
cd backend
uv sync
uv run uvicorn backend.main:app --host 127.0.0.1 --port 8086 --reload
```

**Frontend only:**
```bash
cd frontend
npm install
npm run dev
```

## Project structure

```
stl-chatbot-nblm/
├── frontend/    # Next.js frontend
├── backend/     # FastAPI backend + NotebookLM integration
├── logs/        # Application logs
├── start.sh     # Start script
└── stop.sh      # Stop script
```

## License

MIT
