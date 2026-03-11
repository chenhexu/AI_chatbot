# Frontend CLAUDE.md

This file provides frontend-specific guidance for the Saint-Louis NotebookLM Chatbot.

## Overview

Next.js 14 frontend application with React 18, TypeScript, and Tailwind CSS. Provides a modern chat interface for interacting with the NotebookLM backend API.

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | Next.js | 14.2 |
| **UI Library** | React | 18.3 |
| **Language** | TypeScript | 5.4 |
| **Styling** | Tailwind CSS | 3.4 |
| **Markdown** | React Markdown | 9.0 |
| **Charts** | Recharts | 2.12 |
| **Testing** | Jest + React Testing Library | Latest |
| **Package Manager** | npm | Latest |

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/chat/           # Chat API proxy route
│   │   │   └── route.ts        # Proxy to backend
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/             # React components
│   │   ├── ChatContainer.tsx   # Main chat interface
│   │   ├── Header.tsx          # App header
│   │   ├── InputArea.tsx       # Message input
│   │   ├── MessageBubble.tsx   # Message display
│   │   └── LoadingIndicator.tsx # Typing indicator
│   ├── __tests__/              # Frontend tests
│   │   ├── components/         # Component tests
│   │   ├── integration/        # Integration tests
│   │   ├── mocks/              # Test mocks
│   │   └── test-data/          # Test data fixtures
│   └── styles/
│       └── globals.css         # Global styles
├── public/                     # Static assets
├── jest.config.js              # Jest configuration
├── jest.setup.js               # Jest setup
├── next.config.js              # Next.js configuration
├── tailwind.config.ts          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies
```

## Core Principles

1. **Component-First**: Build small, reusable components
2. **Type Safety**: Use TypeScript strict mode, avoid `any`
3. **App Router**: Use Next.js 14 App Router conventions
4. **Server Actions**: Use API routes for backend communication
5. **Responsive Design**: Mobile-first with Tailwind CSS
6. **Accessibility**: Use semantic HTML and ARIA labels

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Run development server (port 3086)
npm run dev

# Run with debug
NODE_OPTIONS='--inspect' npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test pattern
npm test -- --testNamePattern="MessageBubble"
```

### Building

```bash
# Production build
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

## Component Architecture

### Component Hierarchy

```
layout.tsx (Root Layout)
└── page.tsx (Main Page)
    └── ChatContainer (Main Container)
        ├── Header (School Header)
        ├── MessageList (Scrollable Area)
        │   └── MessageBubble (Individual Messages)
        │       ├── User Message
        │       └── Assistant Message (with markdown)
        ├── LoadingIndicator (Typing Animation)
        └── InputArea (Fixed Bottom Input)
```

### Component Patterns

**MessageBubble** - Displays messages with markdown support:
```tsx
interface MessageBubbleProps {
  content: string;
  isUser: boolean;
}

export function MessageBubble({ content, isUser }: MessageBubbleProps) {
  return (
    <div className={isUser ? 'user-message' : 'assistant-message'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

**InputArea** - Auto-expanding textarea with fixed positioning:
```tsx
export function InputArea() {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = () => {
    // Auto-resize logic (max 5 lines)
  };

  return (
    <div className="fixed bottom-0 left-0 right-0">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onInput={handleInput}
        rows={1}
        maxLength={5}
      />
    </div>
  );
}
```

## Styling Guidelines

### Tailwind CSS Conventions

```tsx
// Layout
<div className="flex flex-col h-screen"> {/* Full height container */}
<div className="flex-1 overflow-y-auto"> {/* Scrollable content area */}

// Colors (Saint-Louis theme)
<div className="bg-blue-600"> {/* Primary blue */}
<div className="text-white"> {/* White text on blue */}
<div className="bg-white text-gray-900"> {/* White background, dark text */}

// Spacing
<div className="p-4"> {/* Padding */}
<div className="m-2"> {/* Margin */}
<div className="space-y-2"> {/* Vertical spacing between children */}
```

### Global Styles

Located in `src/styles/globals.css`:
- Custom font imports (if any)
- Tailwind directives
- Custom utility classes

## API Integration

### Chat API Proxy

The frontend uses Next.js API routes to proxy requests to the backend:

```tsx
// src/app/api/chat/route.ts
export async function POST(request: Request) {
  const { message } = await request.json();

  const response = await fetch('http://127.0.0.1:8086/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  return Response.json(await response.json());
}
```

### Client-Side Usage

```tsx
async function sendMessage(message: string) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  const data = await response.json();
  return data.response;
}
```

## Testing Guidelines

### Component Tests

```tsx
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';

describe('MessageBubble', () => {
  it('renders user message correctly', () => {
    render(<MessageBubble content="Hello" isUser={true} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    render(<MessageBubble content="**Bold** text" isUser={false} />);
    expect(screen.getByText('Bold')).toBeInTheDocument();
  });
});
```

### Integration Tests

```tsx
import { renderWithProviders } from '../test-utils';
import { ChatContainer } from '../ChatContainer';

describe('ChatContainer Integration', () => {
  it('sends message and displays response', async () => {
    renderWithProviders(<ChatContainer />);

    const input = screen.getByPlaceholderText(/type your message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Hello');
    await userEvent.click(sendButton);

    // Assert response appears
  });
});
```

## Type Safety

### TypeScript Configuration

- Strict mode enabled in `tsconfig.json`
- Path aliases: `@/` maps to `src/`
- No `any` types allowed

### Component Props

```tsx
interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
}
```

## Performance Considerations

### Code Splitting

```tsx
// Dynamic imports for large components
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <div>Loading...</div>
});
```

### Image Optimization

```tsx
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="School Logo"
  width={200}
  height={100}
  priority // For above-fold images
/>
```

### Memoization

```tsx
import { memo } from 'react';

export const MessageBubble = memo(({ content, isUser }) => {
  // Component logic
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.content === nextProps.content;
});
```

## Common Issues

### Port Conflicts

If port 3086 is in use:
```bash
# Kill process on port 3086
lsof -ti:3086 | xargs kill -9

# Or use different port
PORT=3099 npm run dev
```

### Build Errors

If build fails:
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Test Issues

If tests fail unexpectedly:
```bash
# Clear Jest cache
npm test -- --clearCache

# Update snapshots
npm test -- -u
```

## Deployment Notes

- Production build runs via `npm run build && npm start`
- Static files served by Next.js production server
- Environment variables for API endpoint configuration
- Use `./start.sh` script for production deployments

---

**For project-level guidance, see [CLAUDE.md](../CLAUDE.md)**
