import pytest
import time
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_full_chat_flow():
    """Test complete chat flow"""
    async with AsyncClient(base_url="http://127.0.0.1:8086") as client:
        # Health check
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

        # Chat request
        response = await client.post(
            "/api/chat",
            json={"message": "What is this notebook about?"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert len(data["answer"]) > 0


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test health check endpoint"""
    async with AsyncClient(base_url="http://127.0.0.1:8086") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        assert "notebooklm" in data
        assert "auth_status" in data


@pytest.mark.asyncio
async def test_chat_endpoint():
    """Test chat endpoint"""
    async with AsyncClient(base_url="http://127.0.0.1:8086") as client:
        response = await client.post(
            "/api/chat",
            json={"message": "Hello, can you help me?"}
        )
        assert response.status_code == 200

        data = response.json()
        assert "answer" in data
        assert "language" in data
        assert "sources" in data
        assert isinstance(data["sources"], list)
        assert len(data["answer"]) > 0


@pytest.mark.asyncio
async def test_chat_empty_message():
    """Test chat endpoint with empty message"""
    async with AsyncClient(base_url="http://127.0.0.1:8086") as client:
        response = await client.post(
            "/api/chat",
            json={"message": ""}
        )
        # Should return validation error
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_consecutive_requests():
    """Test multiple consecutive chat requests"""
    async with AsyncClient(base_url="http://127.0.0.1:8086") as client:
        messages = [
            "What is this about?",
            "Can you summarize?",
            "Thank you"
        ]

        for msg in messages:
            response = await client.post(
                "/api/chat",
                json={"message": msg}
            )
            assert response.status_code == 200
            data = response.json()
            assert "answer" in data
            assert len(data["answer"]) > 0
