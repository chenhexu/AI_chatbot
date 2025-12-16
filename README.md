# Collège Saint-Louis AI Chatbot

An AI-powered chatbot for Collège Saint-Louis that answers questions about the school using information from scraped website data, PDFs, and Google Docs. Built with Next.js, TypeScript, OpenAI GPT-4.1 nano, and PostgreSQL.

## Features

- 🤖 AI-powered Q&A using OpenAI GPT-4.1 nano
- 📚 RAG (Retrieval Augmented Generation) with school information from multiple sources:
  - Scraped website pages
  - PDF documents (with OCR support)
  - Google Docs
  - External pages
- 💾 PostgreSQL database for document storage (no filesystem needed in production)
- 💬 Modern, full-page chat interface
- 🌐 Multilingual support (English/French) with automatic translation
- 📄 PDF download links for activities and documents
- ⚡ Fast response times with document caching
- 🔍 Intelligent similarity matching for accurate answers

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- PostgreSQL database (for production) or local filesystem (for development)
- (Optional) Google Service Account JSON key file for Google Docs integration

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# AI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-nano

# Database (for production - Render will set this automatically)
DATABASE_URL=postgresql://user:password@host:port/database

# Data Folder (for development, optional)
CRAWLER_DATA_FOLDER=./data/scraped

# Google API Configuration (optional, for Google Docs)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@email.com
GOOGLE_PRIVATE_KEY=your_private_key_here
```

### 3. Database Setup

#### For Production (Render):
1. The `render.yaml` file is configured to automatically create a PostgreSQL database
2. The `DATABASE_URL` will be automatically set by Render
3. Run the migration script after first deployment (see below)

#### For Development:
1. Install PostgreSQL locally or use a cloud database
2. Set `DATABASE_URL` in your `.env.local`
3. Run the migration script to import your local data

### 4. Migrate Data to Database

If you have existing data in `data/scraped/`, migrate it to the database:

```bash
npm run migrate-db
```

This will:
- Create the database schema
- Import all documents from `data/scraped/`
- Process them into chunks
- Store everything in PostgreSQL

### 5. Run the Development Server

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
│   ├── ChatInterface.tsx  # Main chat UI component
│   └── MessageBubble.tsx  # Message display component
├── lib/
│   ├── database/          # Database layer
│   │   ├── client.ts      # PostgreSQL connection
│   │   ├── documentStore.ts # Document storage functions
│   │   └── schema.sql     # Database schema
│   ├── documentLoader.ts  # Document loading and processing
│   ├── documentProcessors/ # Document processors (PDF, text, etc.)
│   ├── rag.ts            # RAG implementation (chunking, retrieval)
│   ├── openai.ts         # OpenAI client and chat generation
│   └── crawler/          # Web crawler implementation
├── scripts/
│   ├── crawl-school-website.ts  # Crawler script
│   ├── process-pdf-ocr.ts       # PDF OCR processing
│   └── migrate-to-database.ts  # Database migration script
└── data/
    └── scraped/          # Scraped data (development only, not committed)
```

## How It Works

1. **Document Storage**: Documents are stored in PostgreSQL database (production) or filesystem (development)
   - Documents table: stores full document content and metadata
   - Chunks table: stores processed text chunks for RAG

2. **Document Loading**: The application loads documents from:
   - Database (production) - fast and reliable
   - Filesystem (development fallback) - for local testing

3. **Text Chunking**: Documents are split into manageable chunks (1500 characters with 300 character overlap) while preserving structure

4. **Context Retrieval**: When a user asks a question:
   - The query is translated to French for better matching with French documents
   - The system finds the most relevant chunks using intelligent similarity scoring
   - Both original and translated queries are used to ensure comprehensive results

5. **AI Response**: The relevant context is injected into the OpenAI prompt, and GPT-4.1 nano generates a response based on the school information

6. **Language Detection**: The system detects the user's language and responds in the same language

7. **PDF Links**: When relevant PDFs are found, the chatbot provides clickable download links

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
2. Render will automatically:
   - Create a PostgreSQL database
   - Set the `DATABASE_URL` environment variable
   - Build and deploy your application
3. After first deployment, run the migration:
   ```bash
   npm run migrate-db
   ```
   (You can do this via Render's shell or locally with `DATABASE_URL` set)

### Environment Variables for Production

- `OPENAI_API_KEY` - Required
- `OPENAI_MODEL` - Optional (defaults to gpt-4.1-nano)
- `DATABASE_URL` - Automatically set by Render (PostgreSQL)
- `CRAWLER_DATA_FOLDER` - Optional (only for development)
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

### Migrate Data to Database

```bash
npm run migrate-db
```

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is set correctly
- Check that PostgreSQL is running and accessible
- Ensure the database schema is initialized (run migration script)

### OpenAI API Errors

- Verify your API key is correct and has sufficient credits
- Check that the model name is available in your OpenAI account
- Ensure your API key has the necessary permissions

### Document Not Loading

- **Production**: Check database connection and ensure data was migrated
- **Development**: Check that the `data/scraped/` folder exists and contains data
- Check the browser console and server logs for error messages

### Translation Issues

- The system uses Google Translate API (free) with OpenAI fallback
- If translation fails, the system will use the original query
- Check server logs for translation errors

## License

This is a private project for Collège Saint-Louis.

## Contact

For questions or issues, please contact the development team.
