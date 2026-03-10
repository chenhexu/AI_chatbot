from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User message")

class ChatResponse(BaseModel):
    answer: str = Field(..., description="Answer from NotebookLM")
    language: str = Field(default="auto", description="Response language")
    sources: List[str] = Field(default_factory=list, description="Source documents")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HealthResponse(BaseModel):
    status: str = Field(default="healthy")
    notebooklm: str = Field(default="unknown")
    notebook_name: Optional[str] = None
    auth_status: str = Field(default="unknown")
