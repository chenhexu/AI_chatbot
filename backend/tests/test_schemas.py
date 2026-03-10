import pytest
from backend.models.schemas import ChatRequest, ChatResponse

def test_chat_request_valid():
    request = ChatRequest(message="Hello")
    assert request.message == "Hello"

def test_chat_request_empty_message():
    with pytest.raises(ValueError):
        ChatRequest(message="")

def test_chat_response():
    response = ChatResponse(answer="Test answer")
    assert response.answer == "Test answer"
    assert response.language == "auto"
