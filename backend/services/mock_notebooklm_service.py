"""
Mock NotebookLM Service for testing UI rendering with various response types.

This service loads mock responses from a JSON file, allowing easy testing
with real Google NotebookLM output format.
"""
import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

from utils.logger import logger, QueryLogger
from utils.notebooklm_formatter import format_notebooklm_response
from utils.constants import ResponseKeys, SourceLabels


class MockNotebookLMService:
    """Mock service that loads responses from a JSON file"""

    _responses_cache: List[Dict[str, Any]] = None

    def __init__(self):
        """Initialize the mock service and load responses"""
        logger.info("🎭 Mock NotebookLM Service initialized")
        self._load_responses()

    def _load_responses(self) -> None:
        """Load mock responses from the JSON file"""
        if MockNotebookLMService._responses_cache is not None:
            return

        try:
            # Get the path to mock_responses.json
            current_file = Path(__file__)
            responses_file = current_file.parent / "mock_responses.json"

            if not responses_file.exists():
                logger.warning(f"Mock responses file not found: {responses_file}")
                MockNotebookLMService._responses_cache = []
                return

            with open(responses_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                MockNotebookLMService._responses_cache = data.get('responses', [])

            logger.info(f"Loaded {len(MockNotebookLMService._responses_cache)} mock responses")

        except Exception as e:
            logger.error(f"Error loading mock responses: {e}")
            MockNotebookLMService._responses_cache = []

    def _find_matching_response(self, question: str) -> Optional[Dict[str, Any]]:
        """
        Find a matching mock response based on trigger keywords

        Args:
            question: The user's question

        Returns:
            Matching response dict or None
        """
        question_lower = question.lower()

        for response in MockNotebookLMService._responses_cache:
            triggers = response.get('triggers', [])
            for trigger in triggers:
                if trigger.lower() in question_lower:
                    logger.info(f"Mock response triggered by keyword: '{trigger}'")
                    logger.info(f"Response name: {response.get('name', 'Unknown')}")
                    return response

        return None

    def _default_response(self, question: str) -> Dict[str, Any]:
        """Default response when no keyword matches"""
        answer = f"""# Bienvenue au Collège Saint-Louis !

Merci pour votre question : **{question}**

Je suis là pour vous aider à trouver des informations sur notre établissement.

## Que puis-je faire pour vous ?
- Répondre à vos questions sur les programmes
- Fournir des informations sur l'admission
- Expliquer les horaires et les cours
- Donner des détails sur les activités extrascolaires

**N'hésitez pas à poser vos questions !**

---

> Le Collège Saint-Louis, un établissement d'excellence depuis 1950.

*Pour tester différents types de réponses, essayez d'inclure des mots-clés comme :*
*   **"活动"** ou **"activity"** - pour les activités extrascolaires*
*   **"subject"** ou **"课程"** - pour les programmes d'études*
*   **"table"** - pour voir un tableau*
*   **"list"** - pour voir une liste*
"""

        return {
            ResponseKeys.ANSWER: answer,
            ResponseKeys.SOURCES: [SourceLabels.MOCK_SERVICE],
            ResponseKeys.LANGUAGE: "fr",
        }

    def query(self, question: str) -> Dict[str, Any]:
        """
        Return mock responses based on keywords in the question

        Args:
            question: The question to ask (used for keyword detection)

        Returns:
            Dict containing answer, sources, and language
        """
        from datetime import datetime

        # Build request body for logging
        request_body = f"""[MOCK MODE - Not sending to Google]
Timestamp: {datetime.now().isoformat()}
Question:
  {question}"""

        # Log the query request
        query_num = QueryLogger.log_query(request_body)

        # Try to find matching response
        matched_response = self._find_matching_response(question)

        if matched_response:
            # Get the raw response from Google NotebookLM
            raw_response = matched_response.get('raw_response', '')
            response_name = matched_response.get('name', 'Unknown')
            response_language = matched_response.get('language', 'en')

            # Log the raw response for debugging
            logger.info(f"[MOCK RESPONSE - {response_name}]")
            logger.info(f"Language detected: {response_language}")

            # Apply the same formatting as real NotebookLM service
            formatted_answer = format_notebooklm_response(raw_response)

            # Log the formatted response
            QueryLogger.log_response(query_num, formatted_answer)

            return {
                ResponseKeys.ANSWER: formatted_answer,
                ResponseKeys.SOURCES: [SourceLabels.MOCK_SERVICE],
                ResponseKeys.LANGUAGE: response_language,
            }

        # No match - use default response
        response = self._default_response(question)
        formatted_answer = format_notebooklm_response(response.get(ResponseKeys.ANSWER, ''))

        QueryLogger.log_response(query_num, formatted_answer)

        return {
            ResponseKeys.ANSWER: formatted_answer,
            ResponseKeys.SOURCES: [SourceLabels.MOCK_SERVICE],
            ResponseKeys.LANGUAGE: "fr",
        }
