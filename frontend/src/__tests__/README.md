# UI Test Suite for Chat Application

Comprehensive test suite for validating markdown rendering, message styling, and user interactions in the Collège Saint-Louis chatbot application.

## Test Coverage

### Component Tests

#### MessageBubble Component (`MessageBubble.test.tsx`)
Tests for individual message rendering with markdown support:
- **User Message Styling**: Blue background, white text, right alignment
- **Assistant Message Styling**: White background, dark text, left alignment
- **Table Rendering**: Simple and complex tables with proper styling
- **List Rendering**: Ordered, unordered, and nested lists
- **Text Formatting**: Bold, italic, strikethrough, inline code
- **Header Rendering**: All levels (h1-h6) with correct styling
- **Code Blocks**: Multi-line code with syntax highlighting
- **Images**: Different sizes with lazy loading
- **Blockquotes**: Single and multi-line quotes
- **Links**: External and internal links with proper attributes
- **Mixed Content**: Multiple markdown types in one message
- **HTML Escaping**: Ensuring raw HTML is properly escaped
- **Special Characters**: French accents, mathematical symbols
- **Edge Cases**: Empty content, separator cleanup, long content

#### ChatContainer Component (`ChatContainer.test.tsx`)
Tests for chat interface and message flow:
- **Initial Render**: Default messages and input area
- **Message Flow**: User messages, assistant responses, loading states
- **Error Handling**: Network errors, API errors, user feedback
- **API Integration**: Correct request format, response handling
- **Input Area**: Clear after send, disable during loading
- **Multiple Messages**: Conversation history maintenance
- **Scrolling**: Auto-scroll to bottom on new messages

### Integration Tests (`chat-integration.test.tsx`)
End-to-end tests with mock NotebookLM service:
- **Table Responses**: Displaying tables from API responses
- **List Responses**: Ordered and nested lists from API
- **Formatted Text**: Bold, italic, code from API
- **Links**: Clickable external links from API
- **Conversation Flow**: Multi-turn conversations with context
- **Error Recovery**: Retry after failed requests
- **Special Content**: Mixed content, separators, colors
- **Color Contrast**: Proper styling throughout conversations

## Test Data

### Markdown Test Data (`test-data/markdown-test-data.ts`)
Comprehensive test cases covering all markdown types:

```typescript
import { markdownTestCases, testCategories } from './test-data/markdown-test-data';

// Access all test cases
console.log(markdownTestCases.length); // Total number of test cases

// Access specific categories
console.log(testCategories.tables);    // Table test cases
console.log(testCategories.lists);     // List test cases
console.log(testCategories.formatting); // Text formatting cases
// ... more categories
```

### Mock NotebookLM Service (`mocks/mockNotebookLM.ts`)
Realistic mock service for testing:

```typescript
import { mockNotebookLM } from './mocks/mockNotebookLM';

// Get response for a query
const response = mockNotebookLM.getResponse('programme');
console.log(response.answer); // Table response

// Simulate API call
const apiResponse = await mockNotebookLM.simulateAPI('inscription');
```

## Running Tests

### Install Dependencies

```bash
cd frontend
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

### Run Specific Test Suites

```bash
# MessageBubble tests only
npm test -- MessageBubble

# ChatContainer tests only
npm test -- ChatContainer

# Integration tests only
npm test -- integration
```

### Run Tests by Pattern

```bash
# Table-related tests only
npm test -- --testNamePattern="table"

# List-related tests only
npm test -- --testNamePattern="list"

# Color tests only
npm test -- --testNamePattern="color"
```

## Test Structure

```
src/__tests__/
├── components/
│   ├── MessageBubble.test.tsx    # MessageBubble component tests
│   └── ChatContainer.test.tsx    # ChatContainer component tests
├── integration/
│   └── chat-integration.test.tsx # Integration tests
├── mocks/
│   └── mockNotebookLM.ts         # Mock NotebookLM service
├── test-data/
│   └── markdown-test-data.ts     # Test data and scenarios
└── scripts/
    └── test-runner.ts            # Test runner utility
```

## Color Testing

### User Message Colors
- Background: `bg-blue-600`
- Text: `text-white`
- Max Width: `max-w-md`
- Alignment: `items-end` (right)

### Assistant Message Colors
- Background: `bg-white`
- Text: `text-gray-800`
- Max Width: `max-w-2xl`
- Alignment: `items-start` (left)
- Shadow: `shadow`

## Mock Service

The mock NotebookLM service (`mockNotebookLM.ts`) provides realistic responses for different query types:

| Query Pattern | Response Type |
|---------------|---------------|
| "programme" | Table with course information |
| "tarifs" | Table with fee structure |
| "horaires" | Table with schedule |
| "inscription" | Ordered list with steps |
| "documents" | Nested list with requirements |
| "presentation" | Headers, bold, italic, links |
| "code" | Code blocks (Python and JavaScript) |
| "complet" | Mixed content with all elements |

## CI/CD Integration

Add to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Run UI Tests
  working-directory: ./frontend
  run: |
    npm install
    npm test -- --coverage
    npm run build
```

## Troubleshooting

### Tests Fail to Run
- Ensure all dependencies are installed: `npm install`
- Check Jest configuration in `jest.config.js`
- Verify TypeScript configuration

### Mock Service Issues
- Clear Jest cache: `npm test -- --clearCache`
- Check mock responses in `mockNotebookLM.ts`

### Color Tests Failing
- Verify Tailwind CSS classes are correctly applied
- Check component props and role determination
- Ensure test environment supports CSS classes

## Contributing

When adding new features:
1. Add test cases to `markdown-test-data.ts`
2. Write component tests in `components/*.test.tsx`
3. Add integration tests in `integration/*.test.tsx`
4. Update mock service if needed
5. Run full test suite before committing

## License

Same as the main project.
