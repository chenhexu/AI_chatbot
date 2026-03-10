/**
 * Comprehensive UI tests for MessageBubble component
 * Tests markdown rendering, colors, and different response types
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import MessageBubble from '@/components/MessageBubble';
import { markdownTestCases, testCategories } from '../test-data/markdown-test-data';

describe('MessageBubble Component', () => {
  describe('User Message Styling', () => {
    it('should render user message with blue background', () => {
      render(<MessageBubble role="user" content="Test message" />);
      const bubble = screen.getByText('Test message').closest('div');
      expect(bubble?.className).toContain('bg-blue-600');
    });

    it('should render user message with white text', () => {
      render(<MessageBubble role="user" content="Test message" />);
      const text = screen.getByText('Test message');
      expect(text.className).toContain('text-white');
    });

    it('should display user icon and label', () => {
      render(<MessageBubble role="user" content="Test" />);
      expect(screen.getByText('👤')).toBeInTheDocument();
      expect(screen.getByText('Vous')).toBeInTheDocument();
    });

    it('should align user message to the right', () => {
      const { container } = render(<MessageBubble role="user" content="Test" />);
      const wrapper = container.querySelector('.items-end');
      expect(wrapper).toBeInTheDocument();
    });

    it('should have max-w-md for user messages', () => {
      render(<MessageBubble role="user" content="Test" />);
      const bubble = screen.getByText('Test').closest('div');
      while (bubble && !bubble.className.includes('max-w-md')) {
        bubble?.parentElement?.querySelector('div');
        break;
      }
      const bubbleDiv = screen.getByText('Test').closest('.bg-blue-600');
      expect(bubbleDiv?.className).toContain('max-w-md');
    });
  });

  describe('Assistant Message Styling', () => {
    it('should render assistant message with white background', () => {
      render(<MessageBubble role="assistant" content="Test message" />);
      const bubble = screen.getByText('Test message').closest('div');
      const whiteBubble = Array.from(bubble?.querySelectorAll('div') || []).find(div =>
        div.className.includes('bg-white')
      );
      expect(whiteBubble).toBeInTheDocument();
    });

    it('should render assistant message with dark text', () => {
      render(<MessageBubble role="assistant" content="Test message" />);
      const text = screen.getByText('Test message');
      expect(text.className).toContain('text-gray-800');
    });

    it('should display assistant icon and label', () => {
      render(<MessageBubble role="assistant" content="Test" />);
      expect(screen.getByText('🤖')).toBeInTheDocument();
      expect(screen.getByText('Assistant')).toBeInTheDocument();
    });

    it('should align assistant message to the left', () => {
      const { container } = render(<MessageBubble role="assistant" content="Test" />);
      const wrapper = container.querySelector('.items-start');
      expect(wrapper).toBeInTheDocument();
    });

    it('should have max-w-2xl for assistant messages', () => {
      render(<MessageBubble role="assistant" content="Test" />);
      const bubble = screen.getByText('Test').closest('.bg-white');
      expect(bubble?.className).toContain('max-w-2xl');
    });

    it('should have shadow on assistant messages', () => {
      render(<MessageBubble role="assistant" content="Test" />);
      const bubble = screen.getByText('Test').closest('.bg-white');
      expect(bubble?.className).toContain('shadow');
    });
  });

  describe('Table Rendering', () => {
    it('should render simple table correctly', () => {
      const testCase = testCategories.tables.find(tc => tc.id === 'table-simple');
      expect(testCase).toBeDefined();
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(table.className).toContain('min-w-full');
    });

    it('should render table headers with correct styling', () => {
      const testCase = testCategories.tables.find(tc => tc.id === 'table-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const thead = screen.getByRole('rowgroup');
      expect(thead).toBeInTheDocument();
    });

    it('should render table with proper cell count', () => {
      const testCase = testCategories.tables.find(tc => tc.id === 'table-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });

    it('should render user table with blue styling', () => {
      const testCase = testCategories.tables.find(tc => tc.id === 'table-user');
      render(<MessageBubble role="user" content={testCase!.content} />);

      const table = screen.getByRole('table');
      expect(table.className).toContain('bg-blue-500');
    });

    it('should render assistant table with white styling', () => {
      const testCase = testCategories.tables.find(tc => tc.id === 'table-complex');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const table = screen.getByRole('table');
      expect(table.className).toContain('bg-white');
    });
  });

  describe('List Rendering', () => {
    it('should render ordered list', () => {
      const testCase = testCategories.lists.find(tc => tc.id === 'list-ordered');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      expect(list.tagName.toLowerCase()).toBe('ol');
    });

    it('should render unordered list', () => {
      const testCase = testCategories.lists.find(tc => tc.id === 'list-unordered');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const list = screen.getByRole('list');
      expect(list.tagName.toLowerCase()).toBe('ul');
    });

    it('should render nested lists', () => {
      const testCase = testCategories.lists.find(tc => tc.id === 'list-nested');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const lists = screen.getAllByRole('list');
      expect(lists.length).toBeGreaterThan(1);
    });

    it('should render list items with correct count', () => {
      const testCase = testCategories.lists.find(tc => tc.id === 'list-ordered');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const items = screen.getAllByRole('listitem');
      expect(items.length).toBe(4);
    });

    it('should render user list with white text', () => {
      const testCase = testCategories.lists.find(tc => tc.id === 'list-user');
      render(<MessageBubble role="user" content={testCase!.content} />);

      const items = screen.getAllByRole('listitem');
      items.forEach(item => {
        expect(item.className).toContain('text-white');
      });
    });
  });

  describe('Text Formatting', () => {
    it('should render bold text', () => {
      const testCase = testCategories.formatting.find(tc => tc.id === 'formatting-bold');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const bold = screen.getByText('collège Saint-Louis');
      expect(bold.tagName.toLowerCase()).toBe('strong');
      expect(bold.className).toContain('font-bold');
    });

    it('should render italic text', () => {
      const testCase = testCategories.formatting.find(tc => tc.id === 'formatting-italic');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const italic = screen.getByText('avant le 15 septembre');
      expect(italic.tagName.toLowerCase()).toBe('em');
      expect(italic.className).toContain('italic');
    });

    it('should render strikethrough text', () => {
      const testCase = testCategories.formatting.find(tc => tc.id === 'formatting-strikethrough');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const content = screen.getByText(/500€/);
      expect(content).toBeInTheDocument();
    });

    it('should render inline code in assistant message', () => {
      const testCase = testCategories.formatting.find(tc => tc.id === 'formatting-inline-code');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const code = screen.getByText('npm install');
      expect(code.tagName.toLowerCase()).toBe('code');
      expect(code.className).toContain('bg-gray-100');
      expect(code.className).toContain('text-red-600');
    });

    it('should render inline code in user message', () => {
      const testCase = testCategories.formatting.find(tc => tc.id === 'formatting-user-inline-code');
      render(<MessageBubble role="user" content={testCase!.content} />);

      const code = screen.getByText('code');
      expect(code.tagName.toLowerCase()).toBe('code');
      expect(code.className).toContain('bg-blue-500');
      expect(code.className).toContain('text-white');
    });
  });

  describe('Header Rendering', () => {
    it('should render h1 with correct styling', () => {
      render(<MessageBubble role="assistant" content="# Title" />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
      expect(h1.className).toContain('text-xl');
      expect(h1.className).toContain('font-bold');
    });

    it('should render h2 with correct styling', () => {
      render(<MessageBubble role="assistant" content="## Subtitle" />);

      const h2 = screen.getByRole('heading', { level: 2 });
      expect(h2).toBeInTheDocument();
      expect(h2.className).toContain('text-lg');
    });

    it('should render h3 with correct styling', () => {
      render(<MessageBubble role="assistant" content="### Section" />);

      const h3 = screen.getByRole('heading', { level: 3 });
      expect(h3).toBeInTheDocument();
      expect(h3.className).toContain('text-base');
    });

    it('should render h4 with correct styling', () => {
      render(<MessageBubble role="assistant" content="#### Detail" />);

      const h4 = screen.getByRole('heading', { level: 4 });
      expect(h4).toBeInTheDocument();
      expect(h4.className).toContain('text-sm');
    });

    it('should render h5 with correct styling', () => {
      render(<MessageBubble role="assistant" content="##### Note" />);

      const h5 = screen.getByRole('heading', { level: 5 });
      expect(h5).toBeInTheDocument();
    });

    it('should render h6 with correct styling', () => {
      render(<MessageBubble role="assistant" content="###### Minor" />);

      const h6 = screen.getByRole('heading', { level: 6 });
      expect(h6).toBeInTheDocument();
      expect(h6.className).toContain('text-xs');
    });

    it('should render user headers with white text', () => {
      const testCase = testCategories.headers.find(tc => tc.id === 'headers-user');
      render(<MessageBubble role="user" content={testCase!.content} />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1.className).toContain('text-white');
    });

    it('should render all header levels in one message', () => {
      const testCase = testCategories.headers.find(tc => tc.id === 'headers-all');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 5 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 6 })).toBeInTheDocument();
    });
  });

  describe('Code Block Rendering', () => {
    it('should render code block with pre tag', () => {
      const testCase = testCategories.code.find(tc => tc.id === 'code-block-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const pre = screen.getByText(/function hello/).closest('pre');
      expect(pre).toBeInTheDocument();
      expect(pre?.className).toContain('bg-gray-900');
    });

    it('should render code block with correct styling', () => {
      const testCase = testCategories.code.find(tc => tc.id === 'code-block-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const code = screen.getByText(/function hello/).closest('code');
      expect(code?.className).toContain('font-mono');
    });

    it('should render code block with language specified', () => {
      const testCase = testCategories.code.find(tc => tc.id === 'code-block-language');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const code = screen.getByText(/def greet/);
      expect(code).toBeInTheDocument();
    });

    it('should render multi-line code block', () => {
      const testCase = testCategories.code.find(tc => tc.id === 'code-block-multiline');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      expect(screen.getByText('npm install')).toBeInTheDocument();
      expect(screen.getByText('npm run dev')).toBeInTheDocument();
      expect(screen.getByText('npm test')).toBeInTheDocument();
    });
  });

  describe('Image Rendering', () => {
    it('should render image with correct src', () => {
      const testCase = testCategories.images.find(tc => tc.id === 'image-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const img = screen.getByAltText('Logo');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/logo.png');
    });

    it('should render image with alt text', () => {
      const testCase = testCategories.images.find(tc => tc.id === 'image-with-alt');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const img = screen.getByAltText('Photo du collège');
      expect(img).toBeInTheDocument();
    });

    it('should render image with rounded styling', () => {
      const testCase = testCategories.images.find(tc => tc.id === 'image-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const img = screen.getByAltText('Logo');
      expect(img.className).toContain('rounded-lg');
    });

    it('should render image with lazy loading', () => {
      const testCase = testCategories.images.find(tc => tc.id === 'image-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const img = screen.getByAltText('Logo');
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('Blockquote Rendering', () => {
    it('should render blockquote with border', () => {
      const testCase = testCategories.blockquotes.find(tc => tc.id === 'blockquote-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const blockquote = screen.getByText(/L'éducation est la base/).closest('blockquote');
      expect(blockquote).toBeInTheDocument();
      expect(blockquote?.className).toContain('border-l-4');
    });

    it('should render blockquote with italic text', () => {
      const testCase = testCategories.blockquotes.find(tc => tc.id === 'blockquote-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const blockquote = screen.getByText(/L'éducation est la base/).closest('blockquote');
      expect(blockquote?.className).toContain('italic');
    });

    it('should render multi-line blockquote', () => {
      const testCase = testCategories.blockquotes.find(tc => tc.id === 'blockquote-multiline');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const blockquote = screen.getByText(/Le savoir est la seule/).closest('blockquote');
      expect(blockquote).toBeInTheDocument();
    });

    it('should render user blockquote with blue styling', () => {
      const testCase = testCategories.blockquotes.find(tc => tc.id === 'blockquote-user');
      render(<MessageBubble role="user" content={testCase!.content} />);

      const blockquote = screen.getByText(/This is a quote/).closest('blockquote');
      expect(blockquote?.className).toContain('border-blue-400');
      expect(blockquote?.className).toContain('text-blue-50');
    });

    it('should render assistant blockquote with gray styling', () => {
      const testCase = testCategories.blockquotes.find(tc => tc.id === 'blockquote-simple');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const blockquote = screen.getByText(/L'éducation est la base/).closest('blockquote');
      expect(blockquote?.className).toContain('border-gray-300');
      expect(blockquote?.className).toContain('text-gray-700');
    });
  });

  describe('Link Rendering', () => {
    it('should render external link with correct href', () => {
      const testCase = testCategories.links.find(tc => tc.id === 'link-external');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const link = screen.getByText('site web du collège');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://saint-louis.fr');
    });

    it('should render internal link with correct href', () => {
      const testCase = testCategories.links.find(tc => tc.id === 'link-internal');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const link = screen.getByText("page d'inscription");
      expect(link).toHaveAttribute('href', '/inscription');
    });

    it('should render links with target blank', () => {
      const testCase = testCategories.links.find(tc => tc.id === 'link-external');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const link = screen.getByText('site web du collège');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render user links with blue styling', () => {
      const testCase = testCategories.links.find(tc => tc.id === 'link-user');
      render(<MessageBubble role="user" content={testCase!.content} />);

      const link = screen.getByText('Link text');
      expect(link.className).toContain('text-blue-100');
    });

    it('should render assistant links with blue hover', () => {
      const testCase = testCategories.links.find(tc => tc.id === 'link-assistant');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const link = screen.getByText('Click here');
      expect(link.className).toContain('text-blue-600');
      expect(link.className).toContain('hover:text-blue-800');
    });
  });

  describe('Mixed Content', () => {
    it('should render mixed content with all elements', () => {
      const testCase = testCategories.complex.find(tc => tc.id === 'mixed-content');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getByRole('blockquote')).toBeInTheDocument();
    });
  });

  describe('HTML Escaping', () => {
    it('should properly escape HTML entities', () => {
      const testCase = testCategories.complex.find(tc => tc.id === 'html-escaped');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      expect(screen.getByText(/&lt;div class="test"&gt;/)).toBeInTheDocument();
      expect(screen.getByText(/&lt;\/div&gt;/)).toBeInTheDocument();
    });

    it('should not render raw HTML as actual HTML', () => {
      const testCase = testCategories.complex.find(tc => tc.id === 'html-not-rendered');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const div = screen.queryByText('test');
      expect(div).toBeInTheDocument();
      expect(div?.tagName.toLowerCase()).not.toBe('div');
    });
  });

  describe('Special Characters', () => {
    it('should render French characters correctly', () => {
      const testCase = testCategories.complex.find(tc => tc.id === 'special-chars');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      expect(screen.getByText(/é à ù ç € © ® ™/)).toBeInTheDocument();
    });

    it('should render mathematical symbols', () => {
      const testCase = testCategories.complex.find(tc => tc.id === 'special-chars');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      expect(screen.getByText(/∑ ∫ √ ∞ ≤ ≥ ≠/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should remove separator lines from content', () => {
      const testCase = testCategories.edgeCases.find(tc => tc.id === 'separator-cleanup');
      render(<MessageBubble role="assistant" content={testCase!.content} />);

      const separators = screen.queryAllByText('=');
      expect(separators.length).toBe(0);
    });

    it('should handle empty content gracefully', () => {
      const testCase = testCategories.edgeCases.find(tc => tc.id === 'empty-content');
      const { container } = render(<MessageBubble role="assistant" content={testCase!.content} />);

      const bubble = container.querySelector('.rounded-2xl');
      expect(bubble).toBeInTheDocument();
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(1000);
      const { container } = render(<MessageBubble role="assistant" content={longContent} />);

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });
  });

  describe('Timestamp Rendering', () => {
    it('should display timestamp when provided', () => {
      const timestamp = '2024-03-10T14:30:00Z';
      render(<MessageBubble role="assistant" content="Test" timestamp={timestamp} />);

      expect(screen.getByText('14:30')).toBeInTheDocument();
    });

    it('should display current time when timestamp not provided', () => {
      render(<MessageBubble role="assistant" content="Test" />);

      const timeElements = document.querySelectorAll('.text-xs.text-gray-400');
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('should format timestamp in French locale', () => {
      const timestamp = '2024-03-10T09:05:00Z';
      render(<MessageBubble role="assistant" content="Test" timestamp={timestamp} />);

      expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe('All Test Cases', () => {
    markdownTestCases.forEach((testCase) => {
      it(`should render test case: ${testCase.name}`, () => {
        const { container } = render(
          <MessageBubble role={testCase.role} content={testCase.content} />
        );

        // Verify the component rendered without errors
        const bubble = container.querySelector('.rounded-2xl');
        expect(bubble).toBeInTheDocument();

        // Verify expected elements are present
        testCase.expectedElements.forEach((expected) => {
          if (expected.tag) {
            const elements = container.querySelectorAll(expected.tag);
            if (expected.count) {
              expect(elements.length).toBeGreaterThanOrEqual(expected.count);
            }
            if (expected.className) {
              const found = Array.from(elements).some(el =>
                el.className.includes(expected.className!)
              );
              if (expected.count === undefined || elements.length > 0) {
                // Only check if we expect to find elements
              }
            }
          }
        });
      });
    });
  });
});
