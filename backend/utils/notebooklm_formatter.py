"""
NotebookLM Response Formatter

This module handles formatting of raw Google NotebookLM responses for better UI display.

It performs the following cleaning operations:
1. Removes lines containing only numbers (citation numbers)
2. Merges lines containing only punctuation with the previous line
3. Ensures proper line breaks for UI rendering
"""

import re
from typing import List


# Punctuation patterns for English, French, and Chinese
# Includes ellipsis (three dots or single ellipsis character)
PUNCTUATION_ONLY_PATTERN = re.compile(r'^[\s\.\,\;\:\!\?\、\，\。\；\：\！\？\…]+$|^[\s\.]+$|^[\s…]{1,3}$')

# Lines containing only digits (citation numbers like "1", "2", "123", etc.)
DIGITS_ONLY_PATTERN = re.compile(r'^[\d\s]+$')

# Pattern for lines that START with punctuation (these should be merged with previous line)
STARTS_WITH_PUNCTUATION_PATTERN = re.compile(r'^[\s\.\,\;\:\!\?\、\，\。\；\：\！\？\…]+')


def format_notebooklm_response(raw_response: str) -> str:
    """
    Format raw Google NotebookLM response for better UI display.

    Operations performed:
    1. Remove lines with only numbers (citation markers)
    2. Merge lines with only punctuation to previous line
    3. Clean up excessive whitespace
    4. Ensure proper line breaks

    Args:
        raw_response: Raw text from Google NotebookLM

    Returns:
        Cleaned and formatted text for UI display
    """
    if not raw_response:
        return ""

    # Split into lines
    lines: List[str] = raw_response.split('\n')

    # Step 1: Remove lines with only numbers (citation numbers)
    lines = [line for line in lines if not DIGITS_ONLY_PATTERN.match(line)]

    # Step 2: Merge lines with only punctuation or starting with punctuation to previous line
    cleaned_lines: List[str] = []
    i = 0

    while i < len(lines):
        current_line = lines[i].rstrip()

        # Check if current line is only punctuation/whitespace
        if current_line and PUNCTUATION_ONLY_PATTERN.match(current_line):
            # Merge with previous line if exists
            if cleaned_lines:
                # Remove trailing whitespace from previous line and append punctuation
                cleaned_lines[-1] = cleaned_lines[-1].rstrip() + current_line.strip()
            # Skip this line as we've merged it
        elif current_line and STARTS_WITH_PUNCTUATION_PATTERN.match(current_line):
            # Line starts with punctuation - merge with previous line
            if cleaned_lines:
                # Remove trailing whitespace from previous line and append this line
                # Remove leading punctuation from current line since we're merging
                cleaned_lines[-1] = cleaned_lines[-1].rstrip() + current_line.lstrip()
            else:
                # No previous line, keep as is
                cleaned_lines.append(current_line)
        elif current_line == "..." or current_line.strip() == "...":
            # Special handling for ellipsis
            if cleaned_lines:
                cleaned_lines[-1] = cleaned_lines[-1].rstrip() + "..."
        else:
            # Normal line - add as is (with trailing spaces removed)
            cleaned_lines.append(current_line)

        i += 1

    # Step 3: Join lines with single newlines
    # This preserves the structure and lets Markdown render properly
    # Empty lines in cleaned_lines become paragraph breaks (double newlines)
    result_lines: List[str] = []
    prev_was_empty = False

    for line in cleaned_lines:
        if line.strip() == "":
            # Empty line becomes paragraph break
            if not prev_was_empty:
                result_lines.append("")
                prev_was_empty = True
        else:
            result_lines.append(line)
            prev_was_empty = False

    # Join lines, preserving empty lines for paragraph breaks
    formatted_text = '\n'.join(result_lines)

    # Clean up any remaining issues
    # Remove multiple consecutive spaces (but preserve single spaces)
    formatted_text = re.sub(r' {2,}', ' ', formatted_text)

    # Ensure no trailing whitespace on lines
    formatted_text = '\n'.join(line.rstrip() for line in formatted_text.split('\n'))

    # Remove leading/trailing whitespace
    formatted_text = formatted_text.strip()

    return formatted_text


# For backward compatibility, also export as GoogleNotebookLMFormatter
class GoogleNotebookLMFormatter:
    """Formatter class for Google NotebookLM responses"""

    @staticmethod
    def format(raw_response: str) -> str:
        """Format raw NotebookLM response"""
        return format_notebooklm_response(raw_response)
