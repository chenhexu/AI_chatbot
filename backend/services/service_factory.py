"""
Service factory for creating appropriate NotebookLM service based on configuration.

This factory encapsulates the mode selection logic, providing a clean abstraction
for service instantiation.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

from utils.config import config
from utils.constants import ResponseKeys


class NotebookLMServiceInterface(ABC):
    """Interface for NotebookLM services"""

    @abstractmethod
    def query(self, message: str) -> Dict[str, Any]:
        """
        Query the NotebookLM service

        Args:
            message: The message to send

        Returns:
            Dict with keys: answer, sources, language
        """
        pass


class NotebookLMServiceFactory:
    """
    Factory for creating NotebookLM service instances.

    This factory encapsulates the logic for selecting between
    real and mock services based on configuration.
    """

    @staticmethod
    def create_service(use_mock: Optional[bool] = None) -> NotebookLMServiceInterface:
        """
        Create a NotebookLM service instance.

        Args:
            use_mock: If None, uses config.MOCK_NOTEBOOKLM.
                     If True/False, overrides config.

        Returns:
            A NotebookLM service instance
        """
        if use_mock is None:
            use_mock = config.MOCK_NOTEBOOKLM

        if use_mock:
            from services.mock_notebooklm_service import MockNotebookLMService
            return MockNotebookLMService()
        else:
            # Use the ORIGINAL skill code (copied from skills/notebooklm/)
            from services.notebooklm_skill_service import NotebookLMOriginalSkillService
            return NotebookLMOriginalSkillService()


# Convenience function for quick access
def get_notebooklm_service() -> NotebookLMServiceInterface:
    """Get the appropriate NotebookLM service based on current configuration."""
    return NotebookLMServiceFactory.create_service()
