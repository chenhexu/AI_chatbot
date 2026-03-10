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
