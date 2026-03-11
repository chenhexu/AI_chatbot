"""
NotebookLM Skill - Original Code Wrapper

This module contains the EXACT original skill code for querying Google NotebookLM.
The code is copied from skills/notebooklm/ without modifications to core logic.

Only path configuration is updated to work from the backend.
"""

import sys
from pathlib import Path

# Add scripts directory to path
_scripts_dir = Path(__file__).parent / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

# Import the main function from the original skill
from ask_question import ask_notebooklm

__all__ = ["ask_notebooklm"]
