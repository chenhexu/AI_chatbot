import '@testing-library/jest-dom'
import React from 'react'

// Mock react-markdown with basic element rendering
jest.mock('react-markdown', () => {
  return function ReactMarkdownMock(props) {
    const { children } = props
    const content = String(children)

    return React.createElement('div', { className: 'prose prose-sm max-w-none' },
      content.split('\n').map((line, i) => {
        const trimmed = line.trim()

        // Empty lines
        if (!trimmed) return React.createElement('br', { key: i })

        // Headers
        if (trimmed.startsWith('# ')) return React.createElement('h1', { key: i }, trimmed.substring(2))
        if (trimmed.startsWith('## ')) return React.createElement('h2', { key: i }, trimmed.substring(3))
        if (trimmed.startsWith('### ')) return React.createElement('h3', { key: i }, trimmed.substring(4))
        if (trimmed.startsWith('#### ')) return React.createElement('h4', { key: i }, trimmed.substring(5))
        if (trimmed.startsWith('##### ')) return React.createElement('h5', { key: i }, trimmed.substring(6))
        if (trimmed.startsWith('###### ')) return React.createElement('h6', { key: i }, trimmed.substring(7))

        // Blockquote
        if (trimmed.startsWith('> ')) return React.createElement('blockquote', { key: i }, trimmed.substring(2))

        // List items
        if (trimmed.startsWith('- ')) return React.createElement('li', { key: i }, trimmed.substring(2))

        // Code blocks (simple)
        if (trimmed.startsWith('```')) return null

        // For simplicity, return plain text paragraphs
        return React.createElement('p', { key: i }, trimmed)
      })
    )
  }
})

jest.mock('remark-gfm', () => ({}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

// Mock Element.prototype.scrollIntoView
Element.prototype.scrollIntoView = jest.fn()

// Mock window.scrollTo
window.scrollTo = jest.fn()
