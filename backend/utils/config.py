import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    NOTEBOOKLM_URL: str = os.getenv("NOTEBOOKLM_URL", "")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8086"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3086")
    MOCK_NOTEBOOKLM: bool = os.getenv("MOCK_NOTEBOOKLM", "false").lower() in ("true", "1", "yes", "on")

    @classmethod
    def _validate_url(cls, url: str, name: str) -> bool:
        """Validate URL format."""
        if not url:
            return True  # Empty URLs are checked elsewhere

        if not url.startswith(("http://", "https://")):
            raise ValueError(f"{name} must start with http:// or https://")

        return True

    @classmethod
    def validate(cls) -> bool:
        # Skip NOTEBOOKLM_URL validation in mock mode
        if not cls.MOCK_NOTEBOOKLM:
            if not cls.NOTEBOOKLM_URL:
                raise ValueError("NOTEBOOKLM_URL is required")
            cls._validate_url(cls.NOTEBOOKLM_URL, "NOTEBOOKLM_URL")

        cls._validate_url(cls.FRONTEND_URL, "FRONTEND_URL")

        return True

config = Config()
