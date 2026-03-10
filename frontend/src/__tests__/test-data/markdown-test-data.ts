/**
 * Comprehensive test data for markdown rendering tests
 * This file contains sample questions and expected responses for different markdown types
 */

export interface MarkdownTestCase {
  id: string;
  name: string;
  description: string;
  content: string;
  role: 'user' | 'assistant';
  expectedElements: {
    tag?: string;
    className?: string;
    text?: string;
    count?: number;
    attributes?: Record<string, string>;
  }[];
}

export const markdownTestCases: MarkdownTestCase[] = [
  // TABLE TESTS
  {
    id: 'table-simple',
    name: 'Simple Table',
    description: 'Test rendering of a simple table with headers and rows',
    role: 'assistant',
    content: `
| Programme | Durée | Niveau |
|-----------|-------|--------|
| Mathématiques | 4h | Avancé |
| Français | 3h | Intermédiaire |
| Histoire | 2h | Débutant |
    `,
    expectedElements: [
      { tag: 'table', className: 'min-w-full divide-y' },
      { tag: 'thead', className: 'bg-gray-50' },
      { tag: 'tbody', className: 'bg-white divide-y' },
      { tag: 'th', count: 3 },
      { tag: 'tr', count: 4 }, // 1 header + 3 data rows
      { tag: 'td', count: 9 },
    ],
  },
  {
    id: 'table-complex',
    name: 'Complex Table',
    description: 'Test rendering of a table with merged cells and complex data',
    role: 'assistant',
    content: `
| Classe | Élèves | Moyenne | Résultat |
|--------|--------|---------|----------|
| 6ème A | 25 | 14.5 | Excellent |
| 6ème B | 28 | 12.8 | Bon |
| 5ème A | 22 | 15.2 | Excellent |
| 5ème B | 26 | 11.9 | Satisfaisant |
    `,
    expectedElements: [
      { tag: 'table', className: 'min-w-full divide-y' },
      { tag: 'th', count: 4 },
      { tag: 'td', count: 16 },
    ],
  },
  {
    id: 'table-user',
    name: 'User Message with Table',
    description: 'Test table rendering in user message (blue background)',
    role: 'user',
    content: `
| Item | Status |
|------|--------|
| Test 1 | OK |
| Test 2 | OK |
    `,
    expectedElements: [
      { tag: 'table', className: 'bg-blue-500' },
      { tag: 'thead', className: 'bg-blue-400' },
    ],
  },

  // LIST TESTS
  {
    id: 'list-ordered',
    name: 'Ordered List',
    description: 'Test rendering of numbered list',
    role: 'assistant',
    content: `
Étapes pour s'inscrire:

1. Remplir le formulaire
2. Fournir les documents
3. Passer l'entretien
4. Recevoir la confirmation
    `,
    expectedElements: [
      { tag: 'ol', className: 'list-decimal list-inside' },
      { tag: 'li', count: 4, className: 'text-gray-800' },
    ],
  },
  {
    id: 'list-unordered',
    name: 'Unordered List',
    description: 'Test rendering of bullet points',
    role: 'assistant',
    content: `
Matières disponibles:
- Mathématiques
- Français
- Anglais
- Histoire-Géographie
- Sciences
    `,
    expectedElements: [
      { tag: 'ul', className: 'list-disc list-inside' },
      { tag: 'li', count: 5 },
    ],
  },
  {
    id: 'list-nested',
    name: 'Nested List',
    description: 'Test rendering of nested lists',
    role: 'assistant',
    content: `
Programme d'études:
- Primaire
  - CP
  - CE1
  - CE2
- Collège
  - 6ème
  - 5ème
  - 4ème
  - 3ème
- Lycée
  - Seconde
  - Première
  - Terminale
    `,
    expectedElements: [
      { tag: 'ul', count: 3 },
      { tag: 'li', count: 12 },
    ],
  },
  {
    id: 'list-user',
    name: 'User Message with List',
    description: 'Test list rendering in user message',
    role: 'user',
    content: `
- Item 1
- Item 2
- Item 3
    `,
    expectedElements: [
      { tag: 'li', className: 'text-white' },
    ],
  },

  // TEXT FORMATTING TESTS
  {
    id: 'formatting-bold',
    name: 'Bold Text',
    description: 'Test rendering of bold text',
    role: 'assistant',
    content: `Le **collège Saint-Louis** est un établissement d'excellence.`,
    expectedElements: [
      { tag: 'strong', className: 'font-bold text-gray-900' },
    ],
  },
  {
    id: 'formatting-italic',
    name: 'Italic Text',
    description: 'Test rendering of italic text',
    role: 'assistant',
    content: `L'inscription se fait *avant le 15 septembre*.`,
    expectedElements: [
      { tag: 'em', className: 'italic text-gray-800' },
    ],
  },
  {
    id: 'formatting-bold-italic',
    name: 'Bold and Italic',
    description: 'Test rendering of bold and italic text',
    role: 'assistant',
    content: `***Important***: Veuillez respecter les délais.`,
    expectedElements: [
      { tag: 'em', className: 'italic' },
      { tag: 'strong', className: 'font-bold' },
    ],
  },
  {
    id: 'formatting-strikethrough',
    name: 'Strikethrough',
    description: 'Test rendering of strikethrough text',
    role: 'assistant',
    content: `Le prix ~~500€~~ est maintenant de **450€**.`,
    expectedElements: [
      { tag: 'del' },
    ],
  },
  {
    id: 'formatting-inline-code',
    name: 'Inline Code',
    description: 'Test rendering of inline code',
    role: 'assistant',
    content: 'Utilisez la commande `npm install` pour installer les dépendances.',
    expectedElements: [
      { tag: 'code', className: 'px-1.5 py-0.5 rounded text-sm font-mono font-semibold bg-gray-100 text-red-600' },
    ],
  },
  {
    id: 'formatting-user-inline-code',
    name: 'User Inline Code',
    description: 'Test inline code in user message',
    role: 'user',
    content: 'Test with `code` inside',
    expectedElements: [
      { tag: 'code', className: 'bg-blue-500 text-white' },
    ],
  },

  // HEADER TESTS
  {
    id: 'headers-all',
    name: 'All Header Levels',
    description: 'Test rendering of all header levels (h1-h6)',
    role: 'assistant',
    content: `
# Titre Principal
## Sous-titre
### Section
#### Sous-section
##### Détail
###### Note
    `,
    expectedElements: [
      { tag: 'h1', className: 'text-xl font-bold mt-4 mb-2 text-gray-900' },
      { tag: 'h2', className: 'text-lg font-bold mt-3 mb-2 text-gray-900' },
      { tag: 'h3', className: 'text-base font-bold mt-2 mb-1 text-gray-900' },
      { tag: 'h4', className: 'text-sm font-bold mt-2 mb-1 text-gray-900' },
      { tag: 'h5', className: 'text-sm font-semibold mt-1 mb-1 text-gray-900' },
      { tag: 'h6', className: 'text-xs font-semibold mt-1 mb-1 text-gray-600' },
    ],
  },
  {
    id: 'headers-user',
    name: 'User Headers',
    description: 'Test header styling in user message',
    role: 'user',
    content: `
# Title
## Subtitle
    `,
    expectedElements: [
      { tag: 'h1', className: 'text-white' },
      { tag: 'h2', className: 'text-white' },
    ],
  },

  // CODE BLOCK TESTS
  {
    id: 'code-block-simple',
    name: 'Simple Code Block',
    description: 'Test rendering of multi-line code block',
    role: 'assistant',
    content: `
\`\`\`javascript
function hello() {
  console.log('Hello, World!');
}
\`\`\`
    `,
    expectedElements: [
      { tag: 'pre', className: 'bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 shadow-lg' },
      { tag: 'code', className: 'bg-gray-900 text-gray-100 px-3 py-2 rounded-lg text-sm font-mono block overflow-x-auto' },
    ],
  },
  {
    id: 'code-block-language',
    name: 'Code Block with Language',
    description: 'Test code block with syntax specification',
    role: 'assistant',
    content: `
\`\`\`python
def greet(name):
    return f"Hello, {name}!"

print(greet("Saint-Louis"))
\`\`\`
    `,
    expectedElements: [
      { tag: 'pre' },
      { tag: 'code' },
    ],
  },
  {
    id: 'code-block-multiline',
    name: 'Multi-line Code Block',
    description: 'Test code block with multiple lines',
    role: 'assistant',
    content: `
\`\`\`bash
npm install
npm run dev
npm test
\`\`\`
    `,
    expectedElements: [
      { tag: 'pre' },
    ],
  },

  // IMAGE TESTS
  {
    id: 'image-simple',
    name: 'Simple Image',
    description: 'Test rendering of an image',
    role: 'assistant',
    content: `
![Logo](https://example.com/logo.png)
    `,
    expectedElements: [
      { tag: 'img', attributes: { src: 'https://example.com/logo.png', alt: 'Logo' } },
    ],
  },
  {
    id: 'image-with-alt',
    name: 'Image with Alt Text',
    description: 'Test image with descriptive alt text',
    role: 'assistant',
    content: `
![Photo du collège](https://example.com/college.jpg)
    `,
    expectedElements: [
      { tag: 'img', attributes: { alt: 'Photo du collège' } },
    ],
  },
  {
    id: 'image-with-title',
    name: 'Image with Title',
    description: 'Test image with title attribute',
    role: 'assistant',
    content: `
![Logo](https://example.com/logo.png "Logo Saint-Louis")
    `,
    expectedElements: [
      { tag: 'img' },
    ],
  },

  // BLOCKQUOTE TESTS
  {
    id: 'blockquote-simple',
    name: 'Simple Blockquote',
    description: 'Test rendering of a blockquote',
    role: 'assistant',
    content: `
> L'éducation est la base de tout succès.
    `,
    expectedElements: [
      { tag: 'blockquote', className: 'border-l-4 pl-4 my-4 italic border-gray-300 text-gray-700' },
    ],
  },
  {
    id: 'blockquote-multiline',
    name: 'Multi-line Blockquote',
    description: 'Test blockquote with multiple lines',
    role: 'assistant',
    content: `
> "Le savoir est la seule matière qui ne s'use pas quand on la partage."
>
> — Proverbe africain
    `,
    expectedElements: [
      { tag: 'blockquote' },
    ],
  },
  {
    id: 'blockquote-user',
    name: 'User Blockquote',
    description: 'Test blockquote in user message',
    role: 'user',
    content: `
> This is a quote
    `,
    expectedElements: [
      { tag: 'blockquote', className: 'border-blue-400 text-blue-50' },
    ],
  },

  // LINK TESTS
  {
    id: 'link-external',
    name: 'External Link',
    description: 'Test rendering of external link',
    role: 'assistant',
    content: `
Visitez le [site web du collège](https://saint-louis.fr) pour plus d'informations.
    `,
    expectedElements: [
      { tag: 'a', attributes: { href: 'https://saint-louis.fr', target: '_blank', rel: 'noopener noreferrer' } },
    ],
  },
  {
    id: 'link-internal',
    name: 'Internal Link',
    description: 'Test rendering of internal link',
    role: 'assistant',
    content: `
Voir la [page d'inscription](/inscription).
    `,
    expectedElements: [
      { tag: 'a', attributes: { href: '/inscription' } },
    ],
  },
  {
    id: 'link-user',
    name: 'User Link',
    description: 'Test link styling in user message',
    role: 'user',
    content: `
[Link text](https://example.com)
    `,
    expectedElements: [
      { tag: 'a', className: 'underline font-medium text-blue-100 hover:text-white' },
    ],
  },
  {
    id: 'link-assistant',
    name: 'Assistant Link',
    description: 'Test link styling in assistant message',
    role: 'assistant',
    content: `
[Click here](https://example.com)
    `,
    expectedElements: [
      { tag: 'a', className: 'underline font-medium text-blue-600 hover:text-blue-800' },
    ],
  },

  // COMPLEX TESTS
  {
    id: 'mixed-content',
    name: 'Mixed Content',
    description: 'Test rendering of multiple markdown types together',
    role: 'assistant',
    content: `
# Informations sur le Collège

Le **Collège Saint-Louis** offre *plusieurs programmes*:

## Programmes disponibles
| Niveau | Âge | Durée |
|--------|-----|-------|
| 6ème | 11-12 | 1 an |
| 5ème | 12-13 | 1 an |

### Pour s'inscrire:
1. Télécharger le formulaire
2. Remplir les informations
3. Envoyer à l'administration

> "L'excellence est notre priorité"

Plus d'infos sur [notre site](https://saint-louis.fr)
    `,
    expectedElements: [
      { tag: 'h1' },
      { tag: 'h2' },
      { tag: 'h3' },
      { tag: 'strong' },
      { tag: 'em' },
      { tag: 'table' },
      { tag: 'ol' },
      { tag: 'blockquote' },
      { tag: 'a' },
    ],
  },

  // HTML ESCAPING TESTS
  {
    id: 'html-escaped',
    name: 'HTML Escaping',
    description: 'Test that HTML tags are properly escaped',
    role: 'assistant',
    content: `
Voici du code HTML: &lt;div class="test"&gt;Contenu&lt;/div&gt;

Et un script: &lt;script&gt;alert('test');&lt;/script&gt;
    `,
    expectedElements: [
      { tag: 'p' },
    ],
  },
  {
    id: 'html-not-rendered',
    name: 'HTML Not Rendered',
    description: 'Verify raw HTML is not rendered as actual HTML',
    role: 'assistant',
    content: `
Ceci n'est pas rendu: <div>test</div>
    `,
    expectedElements: [
      { tag: 'p' },
    ],
  },

  // SPECIAL CHARACTERS
  {
    id: 'special-chars',
    name: 'Special Characters',
    description: 'Test rendering of special characters',
    role: 'assistant',
    content: `
Caractères spéciaux: é à ù ç € © ® ™

Mathématiques: ∑ ∫ √ ∞ ≤ ≥ ≠

Français: « citation »
    `,
    expectedElements: [
      { tag: 'p' },
    ],
  },

  // COLOR TESTS
  {
    id: 'color-user-message',
    name: 'User Message Colors',
    description: 'Verify user message has white text on blue background',
    role: 'user',
    content: `User message`,
    expectedElements: [
      { tag: 'div', className: 'bg-blue-600 text-white max-w-md' },
      { tag: 'p', className: 'text-white' },
    ],
  },
  {
    id: 'color-assistant-message',
    name: 'Assistant Message Colors',
    description: 'Verify assistant message has dark text on white background',
    role: 'assistant',
    content: `Assistant message`,
    expectedElements: [
      { tag: 'div', className: 'bg-white text-gray-800 shadow max-w-2xl' },
      { tag: 'p', className: 'text-gray-800' },
    ],
  },

  // SEPARATOR CLEANUP
  {
    id: 'separator-cleanup',
    name: 'Separator Cleanup',
    description: 'Test that NotebookLM separator lines are removed',
    role: 'assistant',
    content: `
Some text before separator
===========================
Some text after separator
    `,
    expectedElements: [
      { tag: 'p' },
    ],
  },

  // EMPTY CONTENT
  {
    id: 'empty-content',
    name: 'Empty Content',
    description: 'Test rendering of empty or whitespace-only content',
    role: 'assistant',
    content: `   `,
    expectedElements: [
      { tag: 'div', className: 'rounded-2xl px-3 py-2' },
    ],
  },
];

/**
 * Test scenarios organized by category
 */
export const testCategories = {
  tables: markdownTestCases.filter(tc => tc.id.includes('table')),
  lists: markdownTestCases.filter(tc => tc.id.includes('list')),
  formatting: markdownTestCases.filter(tc => tc.id.includes('formatting')),
  headers: markdownTestCases.filter(tc => tc.id.includes('headers')),
  code: markdownTestCases.filter(tc => tc.id.includes('code')),
  images: markdownTestCases.filter(tc => tc.id.includes('image')),
  blockquotes: markdownTestCases.filter(tc => tc.id.includes('blockquote')),
  links: markdownTestCases.filter(tc => tc.id.includes('link')),
  colors: markdownTestCases.filter(tc => tc.id.includes('color')),
  complex: markdownTestCases.filter(tc => tc.id.includes('mixed') || tc.id.includes('html') || tc.id.includes('special')),
  edgeCases: markdownTestCases.filter(tc => tc.id.includes('separator') || tc.id.includes('empty')),
};

/**
 * Sample questions for integration testing
 */
export const sampleQuestions = [
  {
    question: 'Quels sont les programmes disponibles ?',
    expectedResponseType: 'table',
  },
  {
    question: 'Comment s\'inscrire ?',
    expectedResponseType: 'list',
  },
  {
    question: 'Quels sont les horaires ?',
    expectedResponseType: 'text',
  },
  {
    question: 'Quelle est la structure des frais ?',
    expectedResponseType: 'table',
  },
  {
    question: 'Qui sont les professeurs ?',
    expectedResponseType: 'list',
  },
];

export default markdownTestCases;
