"""
Configuration for NotebookLM Skill
Centralizes constants, selectors, and paths
"""

from pathlib import Path

# Paths
# When running from backend, point to backend/data/notebooklm/
# __file__ is backend/services/notebooklm_skill/scripts/config.py
# We need to go up 4 levels to reach backend/, then data/notebooklm/
_SKILL_SCRIPTS_DIR = Path(__file__).parent
_SKILL_MODULE_DIR = _SKILL_SCRIPTS_DIR.parent  # services/notebooklm_skill/
_BACKEND_DIR = _SKILL_MODULE_DIR.parent.parent  # backend/
DATA_DIR = _BACKEND_DIR / "data" / "notebooklm"
BROWSER_STATE_DIR = DATA_DIR / "browser_state"
BROWSER_PROFILE_DIR = BROWSER_STATE_DIR / "browser_profile"
STATE_FILE = BROWSER_STATE_DIR / "state.json"
AUTH_INFO_FILE = DATA_DIR / "auth_info.json"
LIBRARY_FILE = DATA_DIR / "library.json"

# NotebookLM Selectors
QUERY_INPUT_SELECTORS = [
    "textarea.query-box-input",  # Primary
    'textarea[aria-label="Feld für Anfragen"]',  # Fallback German
    'textarea[aria-label="Input for queries"]',  # Fallback English
]

RESPONSE_SELECTORS = [
    ".to-user-container .message-text-content",  # Primary
    "[data-message-author='bot']",
    "[data-message-author='assistant']",
]

# Browser Configuration
BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled',  # Patches navigator.webdriver
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--allow-read-from-clipboard',  # Allow reading clipboard for copy button extraction
    '--allow-write-to-clipboard'   # Allow writing to clipboard
]

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

# Timeouts
LOGIN_TIMEOUT_MINUTES = 10
QUERY_TIMEOUT_SECONDS = 120
PAGE_LOAD_TIMEOUT = 30000
