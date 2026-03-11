"""
Unit tests for TextFormatter.

This module provides comprehensive tests for the text formatting functionality,
including support for multiple languages and punctuation types.

Test Data Structure:
Each test case is added to TEST_CASES with the following structure:
{
    'name': 'descriptive test name',
    'input': 'input text to format',
    'expected': 'expected output after formatting',
    'description': 'explanation of what this test validates'
}

Easy to add new test cases!
"""
import pytest
from utils.text_formatter import TextFormatter


# Test data repository - easily extensible
TEST_CASES = [
    # Test 1: Remove standalone numbers
    {
        'name': 'remove_standalone_numbers',
        'input': 'Line one\n1\nLine two\n2\nLine three',
        'expected': 'Line one\nLine two\nLine three',
        'description': 'Should remove lines containing only numbers'
    },
    
    # Test 2: Remove standalone period
    {
        'name': 'remove_standalone_period',
        'input': 'Main text\n.\nNext line',
        'expected': 'Main text.\nNext line',
        'description': 'Should merge period with previous line'
    },
    
    # Test 3: Remove Chinese punctuation (。)
    {
        'name': 'remove_chinese_period',
        'input': '主文本\n。\n下一行',
        'expected': '主文本。\n下一行',
        'description': 'Should merge Chinese period with previous line'
    },
    
    # Test 4: Remove ellipsis (...)
    {
        'name': 'remove_ellipsis',
        'input': 'Some content\n...\nMore content',
        'expected': 'Some content...\nMore content',
        'description': 'Should merge ellipsis with previous line'
    },
    
    # Test 5: Handle multiple consecutive numbers
    {
        'name': 'remove_multiple_numbers',
        'input': 'Text line\n1\n2\n15\nAnother line',
        'expected': 'Text line\nAnother line',
        'description': 'Should remove multiple consecutive number lines'
    },
    
    # Test 6: Complex real-world example - Google NotebookLM output
    {
        'name': 'real_notebooklm_output',
        'input': '''圣路易斯学院（Collège Saint-Louis）为学生提供了丰富多样的课外活动
1
2
。
1. 学术与国际视野
模拟联合国 (SIMONU)：学生参与模拟联合国活动
2
...
。
伦理杯 (Coupe éthique)：学校成功的团队
4
...
。''',
        'expected': '''圣路易斯学院（Collège Saint-Louis）为学生提供了丰富多样的课外活动。
1. 学术与国际视野
模拟联合国 (SIMONU)：学生参与模拟联合国活动...。
伦理杯 (Coupe éthique)：学校成功的团队...。''',
        'description': 'Should clean up real NotebookLM response format'
    },
    
    # Test 7: French punctuation handling
    {
        'name': 'french_punctuation',
        'input': 'Texte français\n?\nAutre texte',
        'expected': 'Texte français?\nAutre texte',
        'description': 'Should merge French question mark with previous line'
    },
    
    # Test 8: Mixed English and Chinese
    {
        'name': 'mixed_english_chinese',
        'input': 'English text and 中文\n1\n2\nMore text\n。\nLast line',
        'expected': 'English text and 中文\nMore text。\nLast line',
        'description': 'Should handle mixed English and Chinese content'
    },
    
    # Test 9: Preserve intentional double punctuation
    {
        'name': 'preserve_intentional_spacing',
        'input': 'First paragraph.\n\nSecond paragraph.',
        'expected': 'First paragraph.\nSecond paragraph.',
        'description': 'Should preserve logical paragraph structure'
    },
    
    # Test 10: Empty lines and whitespace handling
    {
        'name': 'empty_lines_whitespace',
        'input': 'Text\n   \n\n  Text2  \n3\nText3',
        'expected': 'Text\nText2\nText3',
        'description': 'Should remove empty lines and trim whitespace from each line'
    },
    
    # Test 11: Citation numbers (like in NotebookLM output)
    {
        'name': 'citation_numbers',
        'input': 'Information provided by source\n1\n.\nMore information\n2\n3\nFinal text',
        'expected': 'Information provided by source.\nMore information\nFinal text',
        'description': 'Should remove citation number lines'
    },
    
    # Test 12: Complex punctuation sequences
    {
        'name': 'complex_punctuation_sequences',
        'input': '文本内容\n...\n。\n继续文本',
        'expected': '文本内容...。\n继续文本',
        'description': 'Should merge multiple consecutive punctuation lines'
    },
    
    # Test 13: Chinese guillemets («»)
    {
        'name': 'french_guillemets',
        'input': 'Text with quote\n«\nquoted text\n»\nMore text',
        'expected': 'Text with quote«\nquoted text»\nMore text',
        'description': 'Should handle French guillemets'
    },
    
    # Test 14: Only punctuation input - should merge all
    {
        'name': 'only_punctuation_input',
        'input': '。\n,\n...',
        'expected': '。,...',
        'description': 'Should handle lines with only punctuation by merging them'
    },
    
    # Test 15: Ellipsis in different formats (3 dots vs …)
    {
        'name': 'ellipsis_variants',
        'input': 'Text\n...\nMore text\n…\nContinued',
        'expected': 'Text...\nMore text…\nContinued',
        'description': 'Should handle both ... and … ellipsis formats'
    }
]


class TestTextFormatter:
    """Test suite for TextFormatter class"""
    
    @pytest.mark.parametrize('test_case', TEST_CASES, ids=[tc['name'] for tc in TEST_CASES])
    def test_format_response(self, test_case):
        """
        Parametrized test for all test cases.
        
        This tests the format_response method against various inputs,
        making it easy to add new test cases.
        
        Args:
            test_case: Dictionary containing test input, expected output, and description
        """
        input_text = test_case['input']
        expected_output = test_case['expected']
        
        result = TextFormatter.format_response(input_text)
        
        assert result == expected_output, (
            f"\nTest: {test_case['name']}\n"
            f"Description: {test_case['description']}\n"
            f"Input:\n{repr(input_text)}\n"
            f"Expected:\n{repr(expected_output)}\n"
            f"Got:\n{repr(result)}"
        )
    
    def test_is_number_only_line(self):
        """Test number detection"""
        assert TextFormatter.is_number_only_line('123')
        assert TextFormatter.is_number_only_line('  42  ')
        assert TextFormatter.is_number_only_line('1')
        assert not TextFormatter.is_number_only_line('1a')
        assert not TextFormatter.is_number_only_line('text')
        assert not TextFormatter.is_number_only_line('')
    
    def test_is_punctuation_only_line(self):
        """Test punctuation detection"""
        # English punctuation
        assert TextFormatter.is_punctuation_only_line('.')
        assert TextFormatter.is_punctuation_only_line('...')
        assert TextFormatter.is_punctuation_only_line('?!')
        
        # Chinese punctuation
        assert TextFormatter.is_punctuation_only_line('。')
        assert TextFormatter.is_punctuation_only_line('，')
        assert TextFormatter.is_punctuation_only_line('…')
        
        # French punctuation
        assert TextFormatter.is_punctuation_only_line('«')
        assert TextFormatter.is_punctuation_only_line('»')
        
        # Should not match text
        assert not TextFormatter.is_punctuation_only_line('text')
        assert not TextFormatter.is_punctuation_only_line('1')
        assert not TextFormatter.is_punctuation_only_line('')
        assert not TextFormatter.is_punctuation_only_line('text.')
    
    def test_empty_input(self):
        """Test with empty input"""
        assert TextFormatter.format_response('') == ''
        assert TextFormatter.format_response('   ') == ''
    
    def test_single_line_no_changes(self):
        """Test single line that needs no formatting"""
        text = 'This is a single line'
        assert TextFormatter.format_response(text) == text
    
    def test_preserve_markdown_formatting(self):
        """Test that markdown formatting is preserved"""
        text = '**Bold text**\n1\n*Italic text*'
        expected = '**Bold text**\n*Italic text*'
        assert TextFormatter.format_response(text) == expected


def get_test_case_by_name(name: str):
    """
    Utility function to retrieve a specific test case by name.
    Useful for debugging or running specific test scenarios.
    
    Args:
        name: The name of the test case
        
    Returns:
        The test case dictionary or None if not found
    """
    for test_case in TEST_CASES:
        if test_case['name'] == name:
            return test_case
    return None


def get_all_test_case_names():
    """
    Get all available test case names.
    
    Returns:
        List of test case names
    """
    return [tc['name'] for tc in TEST_CASES]


def add_test_case(name: str, input_text: str, expected_output: str, description: str):
    """
    Add a new test case to the test suite.
    
    This function allows for dynamic addition of test cases, making it easy
    to extend the test suite with new scenarios.
    
    Args:
        name: Unique name for the test case
        input_text: Input text to format
        expected_output: Expected output after formatting
        description: Description of what this test validates
        
    Raises:
        ValueError: If a test case with the same name already exists
    """
    if get_test_case_by_name(name):
        raise ValueError(f"Test case '{name}' already exists")
    
    TEST_CASES.append({
        'name': name,
        'input': input_text,
        'expected': expected_output,
        'description': description
    })
