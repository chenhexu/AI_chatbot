# Collège Saint-Louis AI Chatbot

An AI-powered chatbot for Collège Saint-Louis that answers questions about the school using information from Google Docs and the school website. Built with Next.js, TypeScript, and OpenAI GPT-4.1 nano.

## Features

- 🤖 AI-powered Q&A using OpenAI GPT-4.1 nano
- 📚 RAG (Retrieval Augmented Generation) with school information from Google Docs
- 💬 Modern, full-page chat interface
- 🇫🇷 French language support
- ⚡ Fast response times with document caching

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- Google Service Account JSON key file
- Access to Google Docs containing school information

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# AI Configuration - OpenAI GPT-4.1 nano
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-nano

# Google API Configuration (for Google Docs)
GOOGLE_SERVICE_ACCOUNT_KEY=./path/to/your-service-account-key.json

# Google Docs IDs
GOOGLE_DOC_FULL_ID=your_full_document_id_here
GOOGLE_DOC_TEST_ID=your_test_document_id_here
```

**Important Notes:**
- Replace `your_openai_api_key_here` with your actual OpenAI API key
- Place your Google Service Account JSON key file in the project root and update the path in `GOOGLE_SERVICE_ACCOUNT_KEY`
- The Google Docs IDs should be extracted from the Google Docs URLs (the long string between `/d/` and `/edit`)

### 3. Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Docs API
4. Create a Service Account and download the JSON key file
5. Share your Google Docs with the service account email address (found in the JSON file)
6. Place the JSON file in your project root

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the chatbot.

## Project Structure

```
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # Chat API endpoint
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page
├── components/
│   ├── ChatInterface.tsx         # Main chat UI component
│   └── MessageBubble.tsx         # Message display component
├── lib/
│   ├── googleDocs.ts             # Google Docs API integration
│   ├── openai.ts                 # OpenAI client and chat generation
│   └── rag.ts                    # RAG implementation (chunking, retrieval)
├── .env.local                    # Environment variables (not committed)
├── .env.example                  # Example environment variables
└── package.json                  # Dependencies
```

## How It Works

1. **Document Fetching**: The application fetches content from Google Docs using the Google Docs API
2. **Text Chunking**: Documents are split into manageable chunks (800 characters with 200 character overlap)
3. **Context Retrieval**: When a user asks a question, the system finds the most relevant chunks using keyword matching
4. **AI Response**: The relevant context is injected into the OpenAI prompt, and GPT-4.1 nano generates a response based on the school information
5. **Caching**: Document chunks are cached in memory for 1 hour to improve performance

## API Endpoints

### POST `/api/chat`

Send a chat message and receive an AI response.

**Request:**
```json
{
  "message": "Quand sont les admissions?"
}
```

**Response:**
```json
{
  "response": "Les admissions pour 2026-2027 se déroulent du 8 au 22 septembre..."
}
```

### GET `/api/chat`

Refresh the document cache manually.

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### Google Docs API Errors

- Ensure the service account JSON file path is correct
- Verify the service account email has access to the Google Docs
- Check that the Google Docs API is enabled in Google Cloud Console

### OpenAI API Errors

- Verify your API key is correct and has sufficient credits
- Check that the model name `gpt-4.1-nano` is available in your OpenAI account
- Ensure your API key has the necessary permissions

### Document Not Loading

- Check the Google Docs IDs in your `.env.local` file
- Verify the documents are shared with the service account
- Check the browser console and server logs for error messages

## License

This is a private project for Collège Saint-Louis.

## Contact

For questions or issues, please contact the development team.


