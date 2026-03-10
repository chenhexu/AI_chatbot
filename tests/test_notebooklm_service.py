import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from backend.services.notebooklm_service import NotebookLMService


def test_query_notebook():
    """Test that querying NotebookLM returns a valid response"""
    service = NotebookLMService()
    result = service.query("What is this notebook about?")
    assert "answer" in result
    assert isinstance(result["answer"], str)
    assert len(result["answer"]) > 0


def test_notebooklm_service_initialization():
    """Test that NotebookLMService can be initialized with correct paths"""
    service = NotebookLMService()
    assert service.skill_path is not None
    assert service.notebook_url is not None
    # Verify paths use the local skills directory
    assert "skills/notebooklm" in str(service.skill_path)


def test_query_with_mocked_subprocess():
    """Test query method with mocked subprocess"""
    service = NotebookLMService()
    mock_output = "Question: What is this?\nThis is a test notebook about AI.\nEXTREMELY IMPORTANT"

    with patch('subprocess.run') as mock_run:
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = mock_output
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        result = service.query("What is this?")
        assert result["answer"] == "This is a test notebook about AI."
        assert "sources" in result
        assert "language" in result


def test_query_subprocess_failure():
    """Test that query handles subprocess failures gracefully"""
    service = NotebookLMService()

    with patch('subprocess.run') as mock_run:
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "Error occurred"
        mock_run.return_value = mock_result

        with pytest.raises(Exception) as exc_info:
            service.query("What is this?")
        assert "NotebookLM query failed" in str(exc_info.value)


def test_query_timeout():
    """Test that query handles timeout gracefully"""
    service = NotebookLMService()

    with patch('subprocess.run') as mock_run:
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired("cmd", 120)

        with pytest.raises(Exception) as exc_info:
            service.query("What is this?")
        assert "timeout" in str(exc_info.value).lower()


def test_parse_response_with_standard_format():
    """Test parsing response with standard format"""
    service = NotebookLMService()
    output = """Question: What is this notebook?
This is a test notebook about artificial intelligence.
EXTREMELY IMPORTANT"""

    result = service._parse_response(output)
    assert result["answer"] == "This is a test notebook about artificial intelligence."
    assert "sources" in result
    assert "language" in result


def test_parse_response_without_format():
    """Test parsing response without standard format"""
    service = NotebookLMService()
    output = "Simple answer"

    result = service._parse_response(output)
    assert result["answer"] == "Simple answer"


def test_detect_french_language():
    """Test French language detection"""
    service = NotebookLMService()
    french_text = "C'est un cahier sur l'intelligence artificielle et l'apprentissage automatique avec des caractères français"
    language = service._detect_language(french_text)
    assert language == "fr"


def test_detect_english_language():
    """Test English language detection"""
    service = NotebookLMService()
    english_text = "This is a notebook about artificial intelligence"
    language = service._detect_language(english_text)
    assert language == "en"


def test_validate_notebook_success():
    """Test notebook validation when subprocess succeeds"""
    service = NotebookLMService()

    with patch('subprocess.run') as mock_run:
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "test response"
        mock_run.return_value = mock_result

        result = service.validate_notebook()
        assert result is True


def test_validate_notebook_failure():
    """Test notebook validation when subprocess fails"""
    service = NotebookLMService()

    with patch('subprocess.run') as mock_run:
        import subprocess
        mock_run.side_effect = Exception("Command failed")

        result = service.validate_notebook()
        assert result is False


def test_get_notebook_name():
    """Test getting notebook name returns cached value"""
    service = NotebookLMService()
    name = service.get_notebook_name()
    assert name == "College Saint Louis"


def test_query_with_empty_string():
    """Test that query raises ValueError for empty string"""
    service = NotebookLMService()

    with pytest.raises(ValueError) as exc_info:
        service.query("")
    assert "Question cannot be empty or whitespace" in str(exc_info.value)


def test_query_with_whitespace_only():
    """Test that query raises ValueError for whitespace-only string"""
    service = NotebookLMService()

    with pytest.raises(ValueError) as exc_info:
        service.query("   \t\n  ")
    assert "Question cannot be empty or whitespace" in str(exc_info.value)
