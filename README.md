# Collège Saint-Louis AI Chatbot

An AI-powered chatbot for Collège Saint-Louis that answers questions about the school using information from scraped website data, PDFs, and Google Docs. Built with Next.js, TypeScript, and OpenAI GPT-4.1 nano.

## Features

- 🤖 AI-powered Q&A using OpenAI GPT-4.1 nano
- 📚 RAG (Retrieval Augmented Generation) with school information from multiple sources:
  - Scraped website pages
  - PDF documents (with OCR support)
  - Google Docs
  - External pages
- 💬 Modern, full-page chat interface
- 🌐 Multilingual support (English/French) with automatic translation
- 📄 PDF download links for activities and documents
- ⚡ Fast response times with document caching
- 🔍 Intelligent similarity matching for accurate answers

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- (Optional) Google Service Account JSON key file for Google Docs integration

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# AI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-nano

# Data Folder (optional, defaults to ./data/scraped)
CRAWLER_DATA_FOLDER=./data/scraped

# Google API Configuration (optional, for Google Docs)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@email.com
GOOGLE_PRIVATE_KEY=your_private_key_here
```

### 3. Prepare Data

The chatbot uses data from the `data/scraped/` folder:
- `pages/` - Scraped HTML pages
- `pdf-texts/` - PDF documents converted to text (via OCR)
- `external/` - External pages
- `pdfs/` - Original PDF files

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the chatbot.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/          # Chat API endpoint
│   │   ├── pdf/           # PDF download endpoint
│   │   └── health/        # Health check endpoint
│   ├── admin/
│   │   └── crawler/       # Crawler admin interface
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── components/
│   ├── ChatInterface.tsx   # Main chat UI component
│   └── MessageBubble.tsx  # Message display component
├── lib/
│   ├── documentLoader.ts  # Document loading and processing
│   ├── documentProcessors/ # Document processors (PDF, text, etc.)
│   ├── rag.ts            # RAG implementation (chunking, retrieval)
│   ├── openai.ts         # OpenAI client and chat generation
│   └── crawler/          # Web crawler implementation
├── scripts/
│   ├── crawl-school-website.ts  # Crawler script
│   └── process-pdf-ocr.ts       # PDF OCR processing
└── data/
    └── scraped/          # Scraped data (not committed)
```

## How It Works

1. **Document Loading**: The application loads documents from multiple sources:
   - Scraped HTML pages from the school website
   - PDF documents (with OCR for scanned PDFs)
   - Google Docs (if configured)
   - External pages

2. **Text Chunking**: Documents are split into manageable chunks (1500 characters with 300 character overlap) while preserving structure

3. **Context Retrieval**: When a user asks a question:
   - The query is translated to French for better matching with French documents
   - The system finds the most relevant chunks using intelligent similarity scoring
   - Both original and translated queries are used to ensure comprehensive results

4. **AI Response**: The relevant context is injected into the OpenAI prompt, and GPT-4.1 nano generates a response based on the school information

5. **Language Detection**: The system detects the user's language and responds in the same language

6. **PDF Links**: When relevant PDFs are found, the chatbot provides clickable download links

## API Endpoints

### POST `/api/chat`

Send a chat message and receive an AI response.

**Request:**
```json
{
  "message": "Qui est le directeur?"
}
```

**Response:**
```json
{
  "response": "La directrice du Collège Saint-Louis est..."
}
```

### GET `/api/pdf/[filename]`

Download a PDF file by filename.

### GET `/api/health`

Health check endpoint for deployment monitoring.

## Deployment

### Render

The project includes a `render.yaml` configuration file for easy deployment on Render.

1. Connect your GitHub repository to Render
2. Set environment variables in the Render dashboard
3. Deploy - Render will automatically build and deploy

### Environment Variables for Production

- `OPENAI_API_KEY` - Required
- `OPENAI_MODEL` - Optional (defaults to gpt-4.1-nano)
- `CRAWLER_DATA_FOLDER` - Optional (defaults to ./data/scraped)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Optional (for Google Docs)
- `GOOGLE_PRIVATE_KEY` - Optional (for Google Docs)

## Development

### Build for Production

```bash
npm run build
npm start
```

### Process PDFs with OCR

```bash
npm run process-pdf-ocr
```

### Test RAG Pipeline

```bash
npm run test-rag-pipeline
```

## Troubleshooting

### OpenAI API Errors

- Verify your API key is correct and has sufficient credits
- Check that the model name is available in your OpenAI account
- Ensure your API key has the necessary permissions

### Document Not Loading

- Check that the `data/scraped/` folder exists and contains data
- Verify PDF files are in `data/scraped/pdfs/` and text versions in `data/scraped/pdf-texts/`
- Check the browser console and server logs for error messages

### Translation Issues

- The system uses Google Translate API (free) with OpenAI fallback
- If translation fails, the system will use the original query
- Check server logs for translation errors

## License

This is a private project for Collège Saint-Louis.

## Contact

For questions or issues, please contact the development team.
