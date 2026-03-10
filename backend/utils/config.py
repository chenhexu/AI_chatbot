import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    NOTEBOOKLM_URL: str = os.getenv("NOTEBOOKLM_URL", "")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8086"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3086")

    @classmethod
    def validate(cls) -> bool:
        if not cls.NOTEBOOKLM_URL:
            raise ValueError("NOTEBOOKLM_URL is required")
        return True

config = Config()
