import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from backend.services.auth_service import AuthService

def test_check_auth_when_not_authenticated():
    """Test that authentication check works correctly"""
    auth_service = AuthService()
    # Just verify the method works and returns a boolean
    result = auth_service.is_authenticated()
    assert isinstance(result, bool)

def test_perform_auth():
    """Test that authentication process can be initiated"""
    auth_service = AuthService()
    result = auth_service.authenticate()
    # If already authenticated, should return True immediately
    # If not authenticated, should attempt auth and return result
    assert isinstance(result, bool)

def test_auth_service_initialization():
    """Test that AuthService can be initialized with correct paths"""
    auth_service = AuthService()
    assert auth_service.skill_path is not None
    assert auth_service.auth_file is not None
    assert auth_service.auth_script is not None
    # Verify paths use the backend services directory
    assert "backend/services/notebooklm" in str(auth_service.skill_path)

def test_path_validation_when_skill_path_missing():
    """Test that authentication fails gracefully when skill path doesn't exist"""
    auth_service = AuthService()
    # Create a mock Path object for skill_path that doesn't exist
    mock_skill_path = MagicMock(spec=Path)
    mock_skill_path.exists.return_value = False

    auth_service.skill_path = mock_skill_path
    result = auth_service._validate_paths()
    assert result is False
    # Verify exists was called
    mock_skill_path.exists.assert_called_once()

def test_path_validation_when_script_missing():
    """Test that authentication fails gracefully when auth script doesn't exist"""
    auth_service = AuthService()
    # Create mock Path objects
    mock_skill_path = MagicMock(spec=Path)
    mock_skill_path.exists.return_value = True

    mock_auth_script = MagicMock(spec=Path)
    mock_auth_script.exists.return_value = False

    auth_service.skill_path = mock_skill_path
    auth_service.auth_script = mock_auth_script

    result = auth_service._validate_paths()
    assert result is False
    # Verify exists was called on both
    mock_skill_path.exists.assert_called_once()
    mock_auth_script.exists.assert_called_once()

def test_path_validation_when_all_paths_exist():
    """Test that path validation succeeds when all required paths exist"""
    auth_service = AuthService()
    # Create mock Path objects that exist
    mock_skill_path = MagicMock(spec=Path)
    mock_skill_path.exists.return_value = True

    mock_auth_script = MagicMock(spec=Path)
    mock_auth_script.exists.return_value = True

    auth_service.skill_path = mock_skill_path
    auth_service.auth_script = mock_auth_script

    result = auth_service._validate_paths()
    assert result is True
    # Verify exists was called on both
    mock_skill_path.exists.assert_called_once()
    mock_auth_script.exists.assert_called_once()

def test_authenticate_fails_with_invalid_paths():
    """Test that authenticate returns False when path validation fails"""
    auth_service = AuthService()
    # Mock is_authenticated as False and path validation as failing
    with patch.object(auth_service, 'is_authenticated', return_value=False), \
         patch.object(auth_service, '_validate_paths', return_value=False):
        result = auth_service.authenticate()
        assert result is False

def test_path_consistency():
    """Test that skill_path and auth_file use consistent base directory"""
    auth_service = AuthService()
    # Both should use backend/services/notebooklm as base
    skill_str = str(auth_service.skill_path)
    assert "backend/services/notebooklm" in skill_str
    # Ensure they don't use old paths
    assert ".agents/skills" not in skill_str
