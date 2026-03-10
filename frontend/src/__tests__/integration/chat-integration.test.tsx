/**
 * Integration tests for the chat application
 * Tests full user flows with mock NotebookLM service
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatContainer from '@/components/ChatContainer';

// Mock fetch to simulate API responses
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Chat Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Table Response Integration', () => {
    it('should display table response from NotebookLM', async () => {
      const tableResponse = `
| Programme | Durée | Niveau |
|-----------|-------|--------|
| Mathématiques | 4h | Avancé |
| Français | 3h | Intermédiaire |
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: tableResponse }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Quels sont les programmes disponibles ?');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Programme')).toBeInTheDocument();
        expect(screen.getByText('Mathématiques')).toBeInTheDocument();
        expect(screen.getByText('Français')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(table.className).toContain('bg-white');
    });

    it('should handle multiple tables in one response', async () => {
      const multiTableResponse = `
Table 1:
| A | B |
|---|---|
| 1 | 2 |

Table 2:
| X | Y |
|---|---|
| 3 | 4 |
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: multiTableResponse }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Show me tables');

      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const tables = screen.getAllByRole('table');
        expect(tables.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('List Response Integration', () => {
    it('should display ordered list from NotebookLM', async () => {
      const listResponse = `
Étapes pour s'inscrire:

1. Remplir le formulaire
2. Fournir les documents
3. Passer l'entretien
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: listResponse }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Comment s\'inscrire ?');

      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Remplir le formulaire')).toBeInTheDocument();
        expect(screen.getByText('Fournir les documents')).toBeInTheDocument();
        expect(screen.getByText('Passer l\'entretien')).toBeInTheDocument();
      });

      const list = screen.getByRole('list');
      expect(list.tagName.toLowerCase()).toBe('ol');
    });

    it('should display nested list from NotebookLM', async () => {
      const nestedListResponse = `
Programme:
- Primaire
  - CP
  - CE1
- Collège
  - 6ème
  - 5ème
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: nestedListResponse }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Programme détaillé');

      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('CP')).toBeInTheDocument();
        expect(screen.getByText('6ème')).toBeInTheDocument();
      });
    });
  });

  describe('Formatted Text Integration', () => {
    it('should display bold and italic text', async () => {
      const formattedResponse = `
Le **Collège Saint-Louis** est *excellent*.
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: formattedResponse }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Présentation');

      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Collège Saint-Louis')).toBeInTheDocument();
      });
    });

    it('should display code blocks', async () => {
      const codeResponse = `
\`\`\`javascript
function hello() {
  console.log('Hello');
}
\`\`\`
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: codeResponse }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Show code');

      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/function hello/)).toBeInTheDocument();
        const codeBlock = screen.getByText(/function hello/).closest('pre');
        expect(codeBlock).toBeInTheDocument();
      });
    });
  });

  describe('Link Integration', () => {
    it('should display clickable external links', async () => {
      const linkResponse = `
Visitez [notre site](https://saint-louis.fr) pour plus d'infos.
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: linkResponse }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Site web');

      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const link = screen.getByText('notre site');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://saint-louis.fr');
        expect(link).toHaveAttribute('target', '_blank');
      });
    });
  });

  describe('Conversation Flow Integration', () => {
    it('should maintain conversation context across multiple messages', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ answer: 'Bonjour! Comment puis-je vous aider?' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ answer: 'Les programmes sont: Maths, Français, Anglais' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ answer: 'Maths a 4h par semaine' }),
        });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');

      // Message 1
      await userEvent.type(input, 'Bonjour');
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByText('Bonjour! Comment puis-je vous aider?')).toBeInTheDocument();
      });

      // Message 2
      await userEvent.type(input, 'Quels programmes ?');
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByText(/Maths, Français, Anglais/)).toBeInTheDocument();
      });

      // Message 3
      await userEvent.type(input, 'Et Maths ?');
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByText('Maths a 4h par semaine')).toBeInTheDocument();
      });

      // Verify all messages are present
      expect(screen.getByText('Bonjour')).toBeInTheDocument();
      expect(screen.getByText('Quels programmes ?')).toBeInTheDocument();
      expect(screen.getByText('Et Maths ?')).toBeInTheDocument();
    });
  });

  describe('Error Recovery Integration', () => {
    it('should allow retry after error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ answer: 'Success!' }),
        });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');

      // First attempt - error
      await userEvent.type(input, 'Test');
      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/Désolé, une erreur/)).toBeInTheDocument();
      });

      // Retry
      await userEvent.clear(input);
      await userEvent.type(input, 'Retry');
      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument();
      });
    });
  });

  describe('Special Content Integration', () => {
    it('should display mixed content with headers, lists, and tables', async () => {
      const mixedResponse = `
# Informations

## Programmes
| Matière | Durée |
|---------|-------|
| Maths | 4h |

### Étapes:
1. S'inscrire
2. Payer

> "L'excellence avant tout"
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: mixedResponse }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Informations complètes');

      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByRole('list')).toBeInTheDocument();
        expect(screen.getByRole('blockquote')).toBeInTheDocument();
      });
    });

    it('should handle NotebookLM separator lines', async () => {
      const responseWithSeparators = `
Some text
===========================
More text
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: responseWithSeparators }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Some text')).toBeInTheDocument();
        expect(screen.getByText('More text')).toBeInTheDocument();
      });

      // Verify separators are not displayed
      const separators = screen.queryAllByText('=');
      expect(separators.length).toBe(0);
    });
  });

  describe('Color Contrast Integration', () => {
    it('should maintain proper color contrast in conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: '**Bold** and *italic* text' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test colors');

      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        // User message should have blue background
        const userMessages = screen.getAllByText('Test colors');
        const userBubble = userMessages[0].closest('.bg-blue-600');
        expect(userBubble).toBeInTheDocument();

        // Assistant message should have white background
        const boldText = screen.getByText('Bold');
        const assistantBubble = boldText.closest('.bg-white');
        expect(assistantBubble).toBeInTheDocument();
      });
    });
  });
});
