# AI Chatbot Architecture

## Overview

This document describes the architecture of the Collège Saint-Louis AI Chatbot, which uses RAG (Retrieval-Augmented Generation) to answer questions about the school.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                    (components/ChatInterface.tsx)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER                                  │
│                   (app/api/chat/route.ts)                       │
│  • Receives user questions                                      │
│  • Manages document cache                                       │
│  • Coordinates RAG pipeline                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DOCUMENT LOADER LAYER                          │
│                  (lib/documentLoader.ts)                         │
│  • Defines all document sources                                 │
│  • Single entry point for adding new sources                    │
│  • Returns standardized format                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              DOCUMENT PROCESSOR REGISTRY                         │
│            (lib/documentProcessors/index.ts)                    │
│  • Manages all document processors                              │
│  • Routes documents to appropriate processor                    │
│  • Handles errors gracefully                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Google     │  │     PDF      │  │    Excel     │
│   Docs       │  │  Processor   │  │  Processor   │
│  Processor   │  │  (Future)    │  │  (Future)    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   Raw Text (Standardized)     │
        │   { id, content }             │
        └───────────────┬───────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RAG LAYER                                   │
│                      (lib/rag.ts)                                │
│  • Chunking: Splits text into manageable chunks                 │
│  • Indexing: Creates searchable chunks                           │
│  • Retrieval: Finds relevant chunks for queries                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI GENERATION LAYER                            │
│                   (lib/openai.ts)                               │
│  • Builds context from retrieved chunks                          │
│  • Creates prompts for OpenAI                                   │
│  • Generates responses using GPT-4.1 nano                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  AI Response    │
                    │  (in French)    │
                    └─────────────────┘
```

## Component Details

### 1. Document Loader (`lib/documentLoader.ts`)
**Purpose:** Single entry point for all document sources

**Responsibilities:**
- Define all document sources in one place
- Convert any document format to raw text
- Provide standardized output format

**Adding New Sources:**
```typescript
const sources: DocumentSource[] = [
  { id: 'doc-id', type: 'google-doc', name: '...' },
  { id: 'file.pdf', type: 'pdf', name: '...' },      // Just add here!
  { id: 'data.xlsx', type: 'excel', name: '...' },  // No RAG changes needed!
];
```

### 2. Document Processor Registry (`lib/documentProcessors/`)
**Purpose:** Abstraction layer for different document formats

**Structure:**
- `types.ts` - Common interfaces
- `index.ts` - Registry that routes to processors
- `googleDocsProcessor.ts` - Handles Google Docs
- `pdfProcessor.ts` - Handles PDFs (ready for implementation)
- `excelProcessor.ts` - Handles Excel (ready for implementation)
- `textProcessor.ts` - Handles plain text

**Benefits:**
- ✅ Add new document types without touching RAG code
- ✅ Each processor is independent and testable
- ✅ Easy to extend (just implement `DocumentProcessor` interface)

### 3. RAG Layer (`lib/rag.ts`)
**Purpose:** Process raw text into searchable chunks

**Responsibilities:**
- Chunking: Split documents intelligently
- Similarity: Calculate relevance scores
- Retrieval: Find best matching chunks

**Input:** Raw text (doesn't care about source)
**Output:** Ranked chunks with relevance scores

### 4. AI Generation Layer (`lib/openai.ts`)
**Purpose:** Generate answers using retrieved context

**Responsibilities:**
- Build context from chunks
- Create prompts
- Call OpenAI API
- Return formatted responses

## Data Flow

1. **Document Ingestion:**
   ```
   Google Doc/PDF/Excel → Processor → Raw Text
   ```

2. **Chunking:**
   ```
   Raw Text → Chunking Algorithm → Text Chunks (cached)
   ```

3. **Query Processing:**
   ```
   User Question → Similarity Search → Top 5 Chunks
   ```

4. **Response Generation:**
   ```
   Top 5 Chunks + Question → OpenAI → AI Response
   ```

## Benefits of This Architecture

1. **Separation of Concerns:**
   - Document loading is separate from RAG
   - RAG doesn't know about document formats
   - Easy to test each layer independently

2. **Extensibility:**
   - Add new document types by creating a processor
   - No changes needed to RAG or AI layers
   - Just add source to `documentLoader.ts`

3. **Maintainability:**
   - Clear boundaries between layers
   - Easy to understand and modify
   - Beautiful architecture diagram! 📊

4. **Scalability:**
   - Can add many document sources
   - Processors can be optimized independently
   - Cache layer prevents redundant processing

## Future Enhancements

- [ ] Implement PDF processor (using pdf-parse)
- [ ] Implement Excel processor (using xlsx)
- [ ] Add Word document processor
- [ ] Add web scraping processor for URLs
- [ ] Add database connector processor
- [ ] Add file upload capability
- [ ] Add document versioning

