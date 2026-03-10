"""
Constants for NotebookLM Chatbot Backend.

Centralizes string values to reduce stringly-typed code and improve maintainability.
"""


class ResponseKeys:
    """Keys used in API responses."""
    ANSWER = "answer"
    SOURCES = "sources"
    LANGUAGE = "language"


class NotebookLMStatus:
    """Status values for NotebookLM service."""
    MOCK_MODE = "mock_mode"
    CONNECTED = "connected"
    AUTHENTICATED = "authenticated"
    NOT_AUTHENTICATED = "not_authenticated"


class SourceLabels:
    """Source labels for responses."""
    MOCK_SERVICE = "Mock Service"


class HealthStatus:
    """Health check status values."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
