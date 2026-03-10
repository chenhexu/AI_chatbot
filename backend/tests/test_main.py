import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def mock_services():
    """Mock auth and notebooklm services"""
    with patch('backend.main.auth_service') as mock_auth, \
         patch('backend.main.notebooklm_service') as mock_notebooklm:

        # Mock auth service
        mock_auth.is_authenticated.return_value = True
        mock_auth.authenticate.return_value = True

        # Mock notebooklm service
        mock_notebooklm.validate_notebook.return_value = True
        mock_notebooklm.get_notebook_name.return_value = "Test Notebook"
        mock_notebooklm.query.return_value = {
            "answer": "Test answer",
            "language": "en",
            "sources": ["source1", "source2"]
        }

        yield mock_auth, mock_notebooklm


@pytest.fixture
def client(mock_services):
    """Create test client with mocked services"""
    # Import after patching to ensure mocks are applied
    from backend.main import app
    return TestClient(app)


def test_health_endpoint(client, mock_services):
    """Test health check endpoint"""
    mock_auth, mock_notebooklm = mock_services

    response = client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"
    assert "notebooklm" in data
    assert "notebook_name" in data
    assert "auth_status" in data


def test_chat_endpoint(client, mock_services):
    """Test chat endpoint"""
    mock_auth, mock_notebooklm = mock_services

    response = client.post(
        "/api/chat",
        json={"message": "Hello"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert data["answer"] == "Test answer"
    assert "language" in data
    assert "sources" in data

    # Verify service was called correctly
    mock_notebooklm.query.assert_called_once_with("Hello")


def test_chat_endpoint_error(client, mock_services):
    """Test chat endpoint with error"""
    mock_auth, mock_notebooklm = mock_services

    # Mock service to raise an error
    mock_notebooklm.query.side_effect = Exception("Service error")

    response = client.post(
        "/api/chat",
        json={"message": "Hello"}
    )

    assert response.status_code == 500
    data = response.json()
    assert "detail" in data


def test_cors_middleware(client):
    """Test CORS middleware is configured"""
    # Test that health endpoint works (CORS is properly configured)
    response = client.get(
        "/api/health",
        headers={"Origin": "http://localhost:5173"}
    )

    # The health endpoint should work
    assert response.status_code == 200

    # Verify CORS middleware is present by checking the app configuration
    from backend.main import app
    from starlette.middleware.cors import CORSMiddleware

    # Check that CORS middleware is in the middleware stack
    has_cors = any(
        middleware.cls == CORSMiddleware
        for middleware in app.user_middleware
    )
    assert has_cors, "CORS middleware not found in app middleware stack"
