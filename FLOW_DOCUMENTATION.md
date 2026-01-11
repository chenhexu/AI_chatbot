# Question to Response Flow

This document describes the complete flow from when a user asks a question to when they receive a response.

## Overview

The system uses a **RAG (Retrieval-Augmented Generation)** architecture with **subject-based classification** to optimize retrieval speed and accuracy.

## Complete Flow

### 1. **User Submits Question** 
   - User types a question in the chat interface
   - Frontend sends POST request to `/api/chat` with `{ message: string, provider?: 'openai' | 'gemini' }`

### 2. **Query Subject Classification** (Optional, ~300ms)
   - **Function**: `classifyQuerySubject(message)` in `lib/subjectClassifier.ts`
   - **Model**: Google Gemini (fast and free)
   - **Purpose**: Determine which document categories (subjects) are most relevant to the query
   - **Subjects**: `general`, `academics`, `calendar`, `staff`, `students`, `parents`, `recipes`, `events`, `admissions`, `sports`, `other`
   - **Note**: `low_confidence` chunks are automatically excluded from search
   - **Result**: Array of 1-3 relevant subjects (e.g., `['calendar', 'general']`)
   - **Fallback**: If classification fails or is disabled (`ENABLE_SUBJECT_FILTER=false`), uses all chunks

### 3. **Load Chunks from Database** (Optimized)
   - **Function**: `loadAllChunks(querySubjects)` in `lib/database/documentStore.ts`
   - **Database Query**: 
     - If subjects provided: `SELECT ... FROM chunks WHERE subject IN (?, ?, ...) AND (subject != 'low_confidence' OR subject IS NULL)`
     - If no subjects: `SELECT ... FROM chunks WHERE (subject != 'low_confidence' OR subject IS NULL)`
   - **Filtering**: 
     - Only loads chunks matching the classified subjects (much faster than loading all chunks)
     - Always excludes `low_confidence` chunks from search results
   - **Fallback**: If filtered result has < 10 chunks, loads all chunks (except low_confidence)
   - **Result**: Array of `TextChunk[]` objects containing text, source, index, pdfUrl

### 4. **Find Relevant Chunks** (Similarity Matching)
   - **Function**: `findRelevantChunks(chunks, query, maxChunks=5)` in `lib/rag.ts`
   - **Process**:
     - Calculates similarity score for each chunk using `calculateSimilarity(query, chunk.text)`
     - Scoring considers:
       - Exact phrase matches
       - Key phrase matches  
       - Word matches
       - Structured data (dates, times, lists)
       - Match position (start/end of chunk gets bonus for context)
     - Sorts chunks by score (descending)
     - Selects top 5 chunks
     - Adds neighboring chunks if matches are at boundaries (for context)
   - **Result**: 3-8 most relevant chunks (top 5 + neighbors)

### 5. **Build Context String**
   - **Function**: `buildContextString(chunks)` in `lib/rag.ts`
   - **Process**: Combines selected chunks into a formatted context string
   - **Format**: Each chunk includes source, text, and optional PDF link
   - **Limit**: Truncated to ~1M characters (250K tokens) if too large

### 6. **Generate AI Response** (RAG)
   - **Function**: `generateChatResponse(message, chunks, requestId, provider)` in `lib/openai.ts`
   - **Provider**: OpenAI (GPT-4o-mini) or Gemini
   - **System Prompt**: Includes:
     - Instructions to answer in French
     - Context from relevant chunks
     - List of available PDF documents
     - Formatting guidelines
   - **User Message**: Original user question
   - **Process**: 
     - Sends system prompt + context + user message to AI
     - AI generates response based on retrieved context
   - **Result**: Formatted answer in French with relevant information

### 7. **Return Response**
   - **Response**: `{ response: string, provider: string }`
   - **Frontend**: Displays the response in the chat interface

## Performance Optimizations

1. **Subject Classification**: Reduces chunk search space from ~1366 chunks to ~100-300 chunks per query
2. **Database Indexing**: `idx_chunks_subject` index speeds up subject-based queries
3. **Caching**: Chunks are cached in memory for 1 hour (though subject filtering requires fresh queries)
4. **Low Confidence Exclusion**: `low_confidence` chunks are never included in search results (need manual review)

## Example Flow

**User asks**: "Quand commence l'école?"

1. Query classified as: `['calendar', 'general']`
2. Database query: Loads ~150 chunks with `subject IN ('calendar', 'general')`
3. Similarity matching: Finds top 5 chunks about school start dates
4. Context built: Combines those 5 chunks into context string
5. AI generates: "L'école commence le 1er septembre..."
6. Response returned to user

## Key Files

- `app/api/chat/route.ts` - Main API endpoint
- `lib/subjectClassifier.ts` - Query and chunk classification
- `lib/database/documentStore.ts` - Database chunk loading
- `lib/rag.ts` - Similarity matching and context building
- `lib/openai.ts` - AI response generation

