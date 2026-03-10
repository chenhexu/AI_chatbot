import os
import subprocess
from pathlib import Path
from backend.utils.logger import logger

class AuthService:
    def __init__(self):
        self.skill_path = Path.home() / ".claude/skills/notebooklm"
        self.auth_file = Path.home() / ".claude/skills/notebooklm/data/browser_state/state.json"
        self.auth_script = self.skill_path / "scripts/run.py"

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
        return self.auth_file.exists()

    def authenticate(self) -> bool:
        """Perform Google authentication"""
        if self.is_authenticated():
            logger.info("✅ Already authenticated")
            return True

        # Validate paths before attempting authentication
        if not self._validate_paths():
            return False

        logger.info("🔐 Starting authentication...")
        try:
            result = subprocess.run(
                ["python3", "scripts/run.py", "auth_manager.py", "setup"],
                cwd=self.skill_path,
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes
            )
            if result.returncode == 0:
                logger.info("✅ Authentication successful")
                return True
            else:
                logger.error(f"❌ Authentication failed: {result.stderr}")
                return False
        except subprocess.TimeoutExpired:
            logger.error("❌ Authentication timeout")
            return False
        except Exception as e:
            logger.error(f"❌ Authentication error: {e}")
            return False
