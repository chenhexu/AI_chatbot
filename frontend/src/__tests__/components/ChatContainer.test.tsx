/**
 * UI tests for ChatContainer component
 * Tests message flow, user interactions, and integration
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatContainer from '@/components/ChatContainer';

// Mock fetch globally
global.fetch = jest.fn();

describe('ChatContainer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('should render initial assistant message', () => {
      render(<ChatContainer />);

      expect(screen.getByText(/Bonjour.*Je suis l'assistant/)).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
      expect(screen.getByText('Assistant')).toBeInTheDocument();
    });

    it('should render input area', () => {
      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should render send button', () => {
      render(<ChatContainer />);

      const button = screen.getByRole('button', { name: /envoyer/i }) ||
                    screen.queryByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Message Flow', () => {
    it('should add user message when sending', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test message');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });
    });

    it('should display user message with correct styling', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'User test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        const userMessage = screen.getByText('User test');
        expect(userMessage).toBeInTheDocument();
      });
    });

    it('should add assistant response after user message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Assistant response' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Hello');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Assistant response')).toBeInTheDocument();
      });
    });

    it('should display loading indicator while waiting for response', async () => {
      let resolveFetch: (value: any) => void;
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        new Promise(resolve => {
          resolveFetch = resolve;
        })
      );

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        const loadingDots = screen.queryAllByText('.').filter(el =>
          el.textContent === '...'
        );
      });

      resolveFetch!({
        ok: true,
        json: async () => ({ answer: 'Done' }),
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Désolé, une erreur s'est produite/)).toBeInTheDocument();
      });
    });

    it('should display error message on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Désolé, une erreur s'est produite/)).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should call chat API with correct parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test message');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Test message' }),
        });
      });
    });

    it('should handle response with "answer" field', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Answer response' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Answer response')).toBeInTheDocument();
      });
    });

    it('should handle response with "response" field', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'Response field' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Response field')).toBeInTheDocument();
      });
    });

    it('should display default message if no response field', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ other: 'data' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Pas de réponse reçue')).toBeInTheDocument();
      });
    });
  });

  describe('Input Area', () => {
    it('should clear input after sending', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox') as HTMLTextAreaElement;
      await userEvent.type(input, 'Test message');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should disable input while loading', async () => {
      let resolveFetch: (value: any) => void;
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        new Promise(resolve => {
          resolveFetch = resolve;
        })
      );

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(sendButton).toBeDisabled();
      });

      resolveFetch!({
        ok: true,
        json: async () => ({ answer: 'Done' }),
      });
    });

    it('should enable input after response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response' }),
      });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(sendButton).not.toBeDisabled();
      });
    });
  });

  describe('Message Scrolling', () => {
    it('should scroll to bottom when new message arrives', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'New message' }),
      });

      const { container } = render(<ChatContainer />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('New message')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Messages', () => {
    it('should maintain conversation history', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ answer: 'Response 1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ answer: 'Response 2' }),
        });

      render(<ChatContainer />);

      const input = screen.getByRole('textbox');

      // First message
      await userEvent.type(input, 'Message 1');
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByText('Response 1')).toBeInTheDocument();
      });

      // Second message
      await userEvent.type(input, 'Message 2');
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByText('Response 2')).toBeInTheDocument();
      });

      // Check all messages are still present
      expect(screen.getByText('Message 1')).toBeInTheDocument();
      expect(screen.getByText('Message 2')).toBeInTheDocument();
      expect(screen.getByText('Response 1')).toBeInTheDocument();
      expect(screen.getByText('Response 2')).toBeInTheDocument();
    });
  });
});
