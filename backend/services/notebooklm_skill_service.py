"""
NotebookLM Service using ORIGINAL skill code (copied from skills/notebooklm/)

This service imports and uses the EXACT original skill code without modifying
the core logic. Only the configuration paths are adjusted.

The original skill code is in:
  backend/backend/services/notebooklm_skill/scripts/
"""

import re
from typing import Dict, Any
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import sys
from pathlib import Path

# Add the skill module to path
_skill_path = Path(__file__).parent / "notebooklm_skill"
if str(_skill_path) not in sys.path:
    sys.path.insert(0, str(_skill_path))

from utils.logger import logger, QueryLogger
from utils.text_formatter import TextFormatter
from utils.notebooklm_formatter import format_notebooklm_response
from utils.config import config
from utils.constants import ResponseKeys, SourceLabels

# Import the EXACT original function from the skill
from services.notebooklm_skill import ask_notebooklm


# Security: Maximum question length to prevent DoS
MAX_QUESTION_LENGTH = 2000

# Security: Dangerous shell metacharacters that must be removed
DANGEROUS_CHARS_PATTERN = re.compile(r'[;&|`$()<>\\]')

# Thread pool for running synchronous Playwright code
_thread_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="notebooklm")


class NotebookLMOriginalSkillService:
    """
    Service for querying NotebookLM using the ORIGINAL skill code.

    This service imports and invokes the original ask_notebooklm function
    from skills/notebooklm/scripts/ask_question.py without modifications.
    """

    def __init__(self):
        """Initialize the NotebookLM service"""
        self.notebook_url = config.NOTEBOOKLM_URL

    def _sanitize_question(self, question: str) -> str:
        """
        Sanitize user input to prevent command injection while allowing international text.

        This function removes dangerous shell metacharacters while preserving
        text in multiple languages (Chinese, French, English, etc.)

        Args:
            question: Raw user question

        Returns:
            Sanitized question

        Raises:
            ValueError: If question exceeds max length or becomes empty after sanitization
        """
        # Check length first
        if len(question) > MAX_QUESTION_LENGTH:
            raise ValueError(f"Question exceeds maximum length of {MAX_QUESTION_LENGTH} characters")

        # Remove dangerous shell metacharacters that could enable command injection
        # This preserves all other characters including international text
        sanitized = DANGEROUS_CHARS_PATTERN.sub('', question.strip())

        # Verify we still have content after sanitization
        if not sanitized:
            raise ValueError("Question cannot be empty or contain only special characters")

        return sanitized

    def _run_query_in_thread(self, question: str, notebook_url: str) -> str:
        """
        Run the NotebookLM query in a separate thread to avoid asyncio conflicts

        This calls the EXACT original ask_notebooklm function from the skill.

        Args:
            question: Sanitized question
            notebook_url: NotebookLM notebook URL

        Returns:
            Answer text from NotebookLM
        """
        # Call the original skill function directly
        # Using headless=True for production
        return ask_notebooklm(question, notebook_url, headless=True)

    def query(self, question: str) -> Dict[str, Any]:
        """
        Query NotebookLM with a question

        Args:
            question: The question to ask

        Returns:
            Dict containing answer, sources, and language

        Raises:
            ValueError: If question is empty, whitespace, or contains invalid characters
            Exception: If query fails or times out
        """
        # Input validation and sanitization
        if not question or not question.strip():
            raise ValueError("Question cannot be empty or whitespace")

        question = self._sanitize_question(question)

        logger.info("Querying NotebookLM")

        # Build request body for logging with clear format
        request_body = f"""Timestamp: {datetime.now().isoformat()}
Notebook URL: {self.notebook_url}
Question:
  {question}"""

        # Log the query request
        query_num = QueryLogger.log_query(request_body)

        try:
            # Use the ORIGINAL skill code via thread pool to avoid asyncio conflicts
            answer_text = _thread_pool.submit(
                self._run_query_in_thread,
                question,
                self.notebook_url
            ).result(timeout=180)

            if answer_text is None:
                logger.error("Query returned no answer")
                QueryLogger.log_response(query_num, "Error: No answer returned from NotebookLM")
                raise Exception("NotebookLM query failed: No answer returned")

            # Log the successful response
            QueryLogger.log_response(query_num, answer_text)

            # Parse and format response
            return self._parse_response(answer_text)

        except Exception as e:
            logger.error(f"Query error: {e}")
            # Log unexpected error
            QueryLogger.log_response(query_num, f"Error: {str(e)}")
            raise

    def _parse_response(self, output: str) -> Dict[str, Any]:
        """
        Parse the response from NotebookLM

        Args:
            output: Raw output from NotebookLM

        Returns:
            Dict with answer, sources, and language
        """
        # The original skill returns the answer directly
        # Remove the follow-up reminder if present
        answer = output.strip()

        # Remove the FOLLOW_UP_REMINDER text that the skill adds
        follow_up_marker = "\n\nEXTREMELY IMPORTANT: Is that ALL you need to know?"
        if follow_up_marker in answer:
            answer = answer.split(follow_up_marker)[0].strip()

        # Use the new NotebookLM formatter to clean up:
        # 1. Remove citation number lines (lines with only numbers)
        # 2. Merge punctuation-only lines with previous line
        # 3. Ensure proper line breaks
        answer = format_notebooklm_response(answer)

        # Additional cleanup using TextFormatter for citation numbers in text
        answer = TextFormatter.format_response(answer)

        language = self._detect_language(answer)

        return {
            ResponseKeys.ANSWER: answer,
            ResponseKeys.SOURCES: [SourceLabels.NOTEBOOKLM],
            ResponseKeys.LANGUAGE: language,
        }

    def _detect_language(self, text: str) -> str:
        """
        Detect language of text (French, English, or Chinese)

        Args:
            text: Text to analyze

        Returns:
            "fr" for French, "en" for English, "zh" for Chinese
        """
        # Check for Chinese characters
        for char in text:
            if '\u4e00' <= char <= '\u9fff':
                return "zh"

        # Check for French characters
        french_chars = set("éèêëàâäùüûôöîïç")
        if french_chars & set(text.lower()):
            return "fr"

        return "en"

    def get_notebook_name(self) -> str:
        """
        Get the name of the notebook (cached from config)

        Returns:
            Notebook name from config or default
        """
        return "College Saint Louis"
