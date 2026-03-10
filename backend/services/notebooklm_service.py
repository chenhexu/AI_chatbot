import subprocess
import re
from pathlib import Path
from typing import Dict, Any
from backend.utils.logger import logger
from backend.utils.config import config


class NotebookLMService:
    """Service for querying NotebookLM via CLI skill"""

    def __init__(self):
        self.skill_path = Path.home() / ".claude/skills/notebooklm"
        self.notebook_url = config.NOTEBOOKLM_URL

    def query(self, question: str) -> Dict[str, Any]:
        """
        Query NotebookLM with a question

        Args:
            question: The question to ask

        Returns:
            Dict containing answer, sources, and language

        Raises:
            ValueError: If question is empty or whitespace
            Exception: If query fails or times out
        """
        # Input validation
        if not question or not question.strip():
            raise ValueError("Question cannot be empty or whitespace")

        logger.info(f"Querying NotebookLM: {question}")
        try:
            result = subprocess.run(
                ["python3", "scripts/run.py", "ask_question.py",
                 "--question", question,
                 "--notebook-url", self.notebook_url],
                cwd=self.skill_path,
                capture_output=True,
                text=True,
                timeout=120
            )
            if result.returncode != 0:
                logger.error(f"Query failed: {result.stderr}")
                raise Exception(f"NotebookLM query failed: {result.stderr}")
            return self._parse_response(result.stdout)
        except subprocess.TimeoutExpired:
            logger.error("Query timeout")
            raise Exception("NotebookLM query timeout")
        except Exception as e:
            logger.error(f"Query error: {e}")
            raise

    def _parse_response(self, output: str) -> Dict[str, Any]:
        """
        Parse the response from NotebookLM

        Args:
            output: Raw output from subprocess

        Returns:
            Dict with answer, sources, and language
        """
        match = re.search(r"Question:.*?\n(.+?)EXTREMELY IMPORTANT", output, re.DOTALL)
        if match:
            answer = match.group(1).strip()
        else:
            answer = output.strip()
        language = self._detect_language(answer)
        return {"answer": answer, "sources": ["NotebookLM"], "language": language}

    def _detect_language(self, text: str) -> str:
        """
        Detect language of text (French or English)

        Args:
            text: Text to analyze

        Returns:
            "fr" for French, "en" for English
        """
        french_chars = set("éèêëàâäùüûôöîïç")
        if french_chars & set(text.lower()):
            return "fr"
        return "en"

    def validate_notebook(self) -> bool:
        """
        Validate that the notebook is accessible

        Returns:
            True if notebook is accessible, False otherwise
        """
        try:
            result = self.query("What is the name of this notebook?")
            return bool(result.get("answer"))
        except Exception as e:
            logger.error(f"Notebook validation failed: {e}")
            return False

    def get_notebook_name(self) -> str:
        """
        Get the name of the notebook

        Returns:
            Notebook name or "Unknown Notebook" if unable to retrieve
        """
        try:
            result = self.query("What is the name of this notebook? Answer with only the name.")
            return result.get("answer", "Unknown Notebook")
        except Exception:
            return "Unknown Notebook"
