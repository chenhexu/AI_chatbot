import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.utils.config import config
from backend.utils.logger import logger
from backend.models.schemas import ChatRequest, ChatResponse, HealthResponse
from backend.services.auth_service import AuthService
from backend.services.notebooklm_service import NotebookLMService

# Initialize services
auth_service = AuthService()
notebooklm_service = NotebookLMService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    logger.info("=== Starting NotebookLM Chatbot Backend ===")

    try:
        config.validate()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)

    # Check authentication status
    if not auth_service.is_authenticated():
        logger.info("No authentication found, starting auth flow...")
        if not auth_service.authenticate():
            logger.error("Authentication failed")
            sys.exit(1)
    else:
        logger.info("✅ Authentication found")

    # Validate NotebookLM connection
    logger.info("Validating NotebookLM...")
    if not notebooklm_service.validate_notebook():
        logger.error("NotebookLM validation failed")
        sys.exit(1)

    notebook_name = notebooklm_service.get_notebook_name()
    logger.info(f"✅ Connected to: {notebook_name}")

    yield

    logger.info("=== Shutting down ===")


# Create FastAPI application
app = FastAPI(
    title="NotebookLM Chatbot API",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns the status of the application and its services
    """
    return HealthResponse(
        status="healthy",
        notebooklm="connected" if notebooklm_service.validate_notebook() else "disconnected",
        notebook_name=notebooklm_service.get_notebook_name(),
        auth_status="authenticated" if auth_service.is_authenticated() else "not_authenticated"
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint
    Processes user messages and returns responses from NotebookLM
    """
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
