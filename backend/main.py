import sys
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from utils.config import config
from utils.logger import logger
from utils.constants import (
    ResponseKeys,
    NotebookLMStatus,
    HealthStatus,
)
from models.schemas import ChatRequest, ChatResponse, HealthResponse
from services.auth_service import AuthService
from services.service_factory import get_notebooklm_service, NotebookLMServiceInterface

# Lazy initialization - services will be created when needed
_auth_service: Optional[AuthService] = None
_notebooklm_service: Optional[NotebookLMServiceInterface] = None

# Cache for authentication status (updated at startup)
# Type: Optional[NotebookLMStatus] - None indicates not yet initialized
_auth_status_cache: Optional[str] = NotebookLMStatus.MOCK_MODE if config.MOCK_NOTEBOOKLM else None


def get_auth_service() -> AuthService:
    """Lazy initialization of AuthService (only in non-mock mode)"""
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service


def get_notebooklm() -> NotebookLMServiceInterface:
    """Lazy initialization of NotebookLM service"""
    global _notebooklm_service
    if _notebooklm_service is None:
        _notebooklm_service = get_notebooklm_service()
    return _notebooklm_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    global _auth_status_cache
    logger.info("=== Starting NotebookLM Chatbot Backend ===")

    try:
        config.validate()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)

    # Skip authentication in mock mode
    if config.MOCK_NOTEBOOKLM:
        logger.info("🎭 MOCK MODE: Using MockNotebookLMService (authentication skipped)")
    else:
        # Initialize auth service only in non-mock mode
        auth = get_auth_service()

        # Check authentication status
        if not auth.is_authenticated():
            logger.info("No authentication found, starting auth flow...")
            if not auth.authenticate():
                logger.error("Authentication failed")
                sys.exit(1)
        else:
            logger.info("✅ Authentication found")

        # Cache authentication status for health checks
        _auth_status_cache = (
            NotebookLMStatus.AUTHENTICATED
            if auth.is_authenticated()
            else NotebookLMStatus.NOT_AUTHENTICATED
        )

        # When authenticated, assume NotebookLM is connected (no extra query)
        logger.info("✅ Connected to NotebookLM")

    yield

    logger.info("=== Shutting down ===")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns the status of the application and its services
    """
    global _auth_status_cache

    # Determine auth status (use cache if available)
    if config.MOCK_NOTEBOOKLM:
        auth_status = NotebookLMStatus.MOCK_MODE
    elif _auth_status_cache is not None:
        auth_status = _auth_status_cache
    else:
        auth_status = (
            NotebookLMStatus.AUTHENTICATED
            if get_auth_service().is_authenticated()
            else NotebookLMStatus.NOT_AUTHENTICATED
        )

    return HealthResponse(
        status=HealthStatus.HEALTHY,
        notebooklm=(
            NotebookLMStatus.MOCK_MODE
            if config.MOCK_NOTEBOOKLM
            else NotebookLMStatus.CONNECTED
        ),
        notebook_name=(
            "College Saint Louis (Mock)" if config.MOCK_NOTEBOOKLM else "College Saint Louis"
        ),
        auth_status=auth_status,
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint
    Processes user messages and returns responses from NotebookLM (or mock service)
    """
    try:
        service = get_notebooklm()
        result = service.query(request.message)

        return ChatResponse(
            answer=result[ResponseKeys.ANSWER],
            language=result[ResponseKeys.LANGUAGE],
            sources=result[ResponseKeys.SOURCES],
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your request. Please try again later."
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=config.BACKEND_PORT)
