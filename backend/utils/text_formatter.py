"""
Text formatter for cleaning up Google NotebookLM responses.

This module handles:
1. Removing lines that contain only numbers
2. Removing lines that contain only punctuation marks (English, French, Chinese)
3. Merging punctuation-only lines with previous lines
4. Properly formatting output with line breaks
"""
import re
from typing import List


class TextFormatter:
    """Formatter for cleaning and standardizing NotebookLM responses"""
    
    # Define punctuation patterns for different languages
    # English punctuation
    ENGLISH_PUNCTUATION = r'[.,;:?!\'"()\[\]{}]'
    
    # French punctuation (includes guillemets « »)
    FRENCH_PUNCTUATION = r'[.,;:?!\'"()\[\]{}«»]'
    
    # Chinese punctuation (。，；：？！…、·)
    CHINESE_PUNCTUATION = r'[。，；：？！…、·]'
    
    # Combined pattern for all punctuation including ellipsis
    ALL_PUNCTUATION_PATTERN = r'[.,;:?!\'"()\[\]{}«»。，；：？！…、·\-\s]+'
    
    # Pattern to match lines with only numbers (with optional spaces)
    NUMBERS_ONLY_PATTERN = r'^\s*\d+\s*$'
    
    @classmethod
    def is_number_only_line(cls, line: str) -> bool:
        """
        Check if a line contains only numbers and whitespace
        
        Args:
            line: The line to check
            
        Returns:
            True if line contains only numbers and whitespace, False otherwise
        """
        return bool(re.match(cls.NUMBERS_ONLY_PATTERN, line))
    
    @classmethod
    def is_punctuation_only_line(cls, line: str) -> bool:
        """
        Check if a line contains only punctuation marks and whitespace
        Considers English, French, and Chinese punctuation
        
        Args:
            line: The line to check
            
        Returns:
            True if line contains only punctuation and whitespace, False otherwise
        """
        # Remove leading/trailing whitespace for analysis
        stripped_line = line.strip()
        
        # Empty line after stripping is considered punctuation-only
        if not stripped_line:
            return False
        
        # Check if all remaining characters match punctuation pattern
        return bool(re.fullmatch(cls.ALL_PUNCTUATION_PATTERN, stripped_line))
    
    @classmethod
    def format_response(cls, text: str) -> str:
        """
        Format NotebookLM response by:
        1. Removing number-only lines
        2. Removing punctuation-only lines and merging with previous line
        3. Adding line breaks for better UI display
        
        Args:
            text: The raw response text from NotebookLM
            
        Returns:
            Formatted text with cleaned content and proper line breaks
        """
        if not text or not text.strip():
            return ''
        
        lines = text.split('\n')
        formatted_lines = []
        
        for line in lines:
            # Skip number-only lines
            if cls.is_number_only_line(line):
                continue
            
            # Handle punctuation-only lines
            if cls.is_punctuation_only_line(line):
                punctuation = line.strip()
                # Merge with previous line if it exists
                if formatted_lines:
                    # Append punctuation to previous line (merging)
                    formatted_lines[-1] = formatted_lines[-1].rstrip() + punctuation
                else:
                    # If no previous line, just add the punctuation
                    formatted_lines.append(punctuation)
                continue
            
            # Add non-empty lines (also strip whitespace)
            stripped_line = line.strip()
            if stripped_line:
                formatted_lines.append(stripped_line)
        
        # Join lines with proper line breaks
        # Each line ends with \n for better UI display
        result = '\n'.join(formatted_lines)
        
        return result
    
    @classmethod
    def format_response_with_emphasis(cls, text: str) -> str:
        """
        Format response and ensure proper spacing around formatted text
        (bold, italic, etc.)
        
        Args:
            text: The raw response text
            
        Returns:
            Formatted text with better spacing
        """
        formatted = cls.format_response(text)
        
        # Ensure spaces around bold and italic markers in some cases
        # This is optional but can improve markdown rendering
        return formatted
