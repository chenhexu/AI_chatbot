"""
Authentication Service for Google NotebookLM

This service now uses direct Python integration instead of subprocess calls.
"""

import sys
from pathlib import Path
from utils.logger import logger
from services.notebooklm_skill.scripts.auth_manager import AuthManager
from services.notebooklm_skill.scripts.config import STATE_FILE


class AuthService:
    """
    Service for managing Google NotebookLM authentication

    This is a wrapper around the new AuthManager that provides
    the same interface for backward compatibility.
    """

    def __init__(self):
        """Initialize the authentication service"""
        self._auth_manager = AuthManager()
        # For backward compatibility with tests
        # Use the actual notebooklm_skill module path
        self.skill_path = Path(__file__).parent / "notebooklm_skill" / "scripts"
        self.auth_file = STATE_FILE
        self.auth_script = self.skill_path / "auth_manager.py"

    def _validate_paths(self) -> bool:
        """Validate that required paths exist"""
        if not self.skill_path.exists():
            logger.error(f"❌ Skill path does not exist: {self.skill_path}")
            return False
        if not self.auth_script.exists():
            logger.error(f"❌ Authentication script does not exist: {self.auth_script}")
            return False
        return True

    def is_authenticated(self) -> bool:
        """Check if Google authentication exists"""
        return self._auth_manager.is_authenticated()

    def authenticate(self) -> bool:
        """Perform Google authentication"""
        if self.is_authenticated():
            logger.info("✅ Already authenticated")
            return True

        # Validate paths before attempting authentication
        if not self._validate_paths():
            return False

        logger.info("🔐 Starting authentication...")
        logger.info("   Please run: python -m services.notebooklm_skill.scripts.auth_manager setup")
        logger.info("   Or set the NOTEBOOKLM_AUTH environment variable")

        # For production, authentication should be done via CLI
        # Return False to indicate authentication is needed
        return False
