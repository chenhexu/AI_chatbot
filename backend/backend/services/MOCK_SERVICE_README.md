# Mock NotebookLM Service

## Overview

The Mock NotebookLM Service (`mock_notebooklm_service.py`) is a testing utility that mimics Google NotebookLM responses with predefined markdown content. This allows comprehensive testing of the frontend's markdown rendering capabilities without requiring actual NotebookLM authentication.

## Configuration

To enable mock mode, add or modify the following environment variable in `backend/.env`:

```bash
MOCK_NOTEBOOKLM=true
```

When mock mode is enabled:
- No authentication is required
- The `NOTEBOOKLM_URL` configuration is not validated
- All requests are handled by the mock service
- Authentication checks are skipped

## Usage

The mock service returns different response types based on keywords in the user's question:

### 1. **Table Responses** (keyword: "table")

Returns formatted markdown tables to test table rendering.

**Example question:**
```
Show me the class schedule table
```

**Response includes:**
- Complex tables with multiple columns
- Bold and italic text within tables
- Notes below tables

### 2. **List Responses** (keyword: "list")

Returns ordered and unordered lists at various nesting levels.

**Example question:**
```
What documents do I need for registration list
```

**Response includes:**
- Bullet points (unordered lists)
- Numbered lists (ordered lists)
- Nested lists (up to 4 levels)
- Lists with formatting (bold, italic)

### 3. **Format Responses** (keyword: "format")

Returns text with various markdown formatting options.

**Example question:**
```
Show me different text formatting options
```

**Response includes:**
- **Bold text**
- *Italic text*
- `Inline code`
- ***Bold and italic***
- Blockquotes
- Horizontal rules (---)

### 4. **Image Responses** (keywords: "image" or "photo")

Returns markdown with embedded images.

**Example question:**
```
Show me photos of the campus
```

**Response includes:**
- Multiple images with markdown syntax
- Image captions
- Text between images
- Images from Unsplash (placeholder images)

### 5. **Quote Responses** (keyword: "quote")

Returns blockquotes and nested quotes.

**Example question:**
```
What are some inspirational quotes
```

**Response includes:**
- Single-level blockquotes
- Nested blockquotes (2 levels)
- Quotes with attribution
- Quotes in multiple sections

### 6. **Code Responses** (keyword: "code")

Returns code blocks in various languages.

**Example question:**
```
Show me code examples
```

**Response includes:**
- Shell scripts (bash)
- Python code with syntax highlighting
- Inline code within text
- LaTeX/math formulas

### 7. **Header Responses** (keyword: "header")

Returns nested headers at all levels (H1-H6).

**Example question:**
```
Show me the student guide with all headers
```

**Response includes:**
- All 6 header levels (H1 through H6)
- Proper header hierarchy
- Text between headers
- Formatted text within headers

### 8. **Default Responses** (no keyword match)

Returns a comprehensive default response with mixed formatting.

**Example question:**
```
Hello, how are you?
```

**Response includes:**
- Mixed markdown formatting
- Lists, headers, and quotes
- Instructions for testing other response types

## Benefits

### For Development
- **Fast iteration**: No need to wait for real NotebookLM queries
- **Offline development**: Work without network connection
- **Predictable responses**: Same input always produces same output

### For Testing
- **UI testing**: Test all markdown rendering features
- **Edge cases**: Test complex nested structures
- **Performance**: Test UI without network latency

### For Demonstrations
- **Reliable demos**: No authentication issues during presentations
- **Quick setup**: Start the backend immediately
- **Controlled content**: Showcase specific UI features

## Implementation Details

The mock service is integrated into the main FastAPI application:

1. **Config Module**: Added `MOCK_NOTEBOOKLM` boolean to `backend/utils/config.py`
2. **Main Module**: Modified `backend/main.py` to use mock service when enabled
3. **Health Check**: Updated to show "mock_mode" status when active
4. **Chat Endpoint**: Routes to mock or real service based on configuration

## Testing the Frontend

To test different UI components:

1. Enable mock mode in `.env`:
   ```bash
   MOCK_NOTEBOOKLM=true
   ```

2. Start the backend:
   ```bash
   ./start.sh dev
   ```

3. Send test messages through the chat UI:
   - "Show me the schedule table" → Test table rendering
   - "What are the requirements list" → Test list rendering
   - "Show me campus photos" → Test image rendering
   - "Give me code examples" → Test code block rendering
   - "Show me inspirational quotes" → Test blockquote rendering

## Service API

The mock service implements the same interface as `NotebookLMService`:

```python
class MockNotebookLMService:
    def query(self, question: str) -> Dict[str, Any]:
        """
        Returns: {
            "answer": str,      # Markdown formatted response
            "sources": List[str],  # ["Mock Service"]
            "language": str      # "fr" or "en"
        }
        """
```

## Language Support

All mock responses default to French ("fr") to match the Collège Saint-Louis context, but the service can easily be extended to support other languages by modifying the response methods.

## Extending the Mock Service

To add new response types:

1. Create a new method following the naming pattern `_keyword_response()`
2. Add the keyword check in the `query()` method
3. Return a dictionary with "answer", "sources", and "language" keys

Example:
```python
def _chart_response(self) -> Dict[str, Any]:
    """Return chart/data visualization"""
    answer = "```chart\n...\n```"
    return {"answer": answer, "sources": ["Mock Service"], "language": "fr"}
```

Then add to the query method:
```python
elif "chart" in question_lower:
    return self._chart_response()
```

## Notes

- The mock service uses placeholder images from Unsplash
- All responses are static and predefined
- No actual AI processing occurs
- The service is meant for development and testing only
- For production, always use the real NotebookLM service
